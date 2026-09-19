import { describe, expect, test } from 'bun:test';
import { createHandler, VersionConflict, type ApiEvent, type PreferenceStore } from '../src/handler';
import { CLOUD_SCOPE, type PreferenceDocument } from '../../src/shared/cloud';

const preferences = { replyTone: 'friendly' as const, reasoningDepth: 'off' as const,
  voiceSpeed: 1, voiceStability: 0.5, speakReplies: true, isClickyCursorEnabled: true };
const event = (user = 'alice', method = 'GET', body?: unknown): ApiEvent => ({
  routeKey: `${method} /preferences`, body: body === undefined ? undefined : JSON.stringify(body),
  requestContext: { authorizer: { jwt: { claims: { sub: user, token_use: 'access', scope: CLOUD_SCOPE } } } },
});
function setup() {
  const records = new Map<string, PreferenceDocument>();
  const store: PreferenceStore = {
    async read(id) { return records.get(id) ?? { preferences: null, version: 0 }; },
    async write(id, document, expected) {
      if ((records.get(id)?.version ?? 0) !== expected) throw new VersionConflict();
      records.set(id, document);
    },
  };
  return { handler: createHandler(store), records };
}

describe('authenticated preference API', () => {
  test('rejects absent identity, ID tokens, and missing scope before accessing storage', async () => {
    const handler = createHandler({ read: () => { throw new Error('must not read'); }, write: () => { throw new Error('must not write'); } });
    for (const claims of [{}, { sub: 'a', token_use: 'id', scope: CLOUD_SCOPE }, { sub: 'a', token_use: 'access', scope: 'openid' }]) {
      const request = event(); request.requestContext.authorizer!.jwt!.claims = claims;
      expect((await handler(request)).statusCode).toBe(401);
    }
  });
  test('creates and restores a document only for the authenticated account', async () => {
    const { handler } = setup();
    expect(JSON.parse((await handler(event())).body)).toEqual({ preferences: null, version: 0 });
    expect((await handler(event('alice', 'PUT', { preferences, version: 0 }))).statusCode).toBe(200);
    expect(JSON.parse((await handler(event('alice'))).body)).toEqual({ preferences, version: 1 });
    expect(JSON.parse((await handler(event('bob'))).body)).toEqual({ preferences: null, version: 0 });
    expect((await handler(event('bob', 'PUT', { preferences, version: 0, userId: 'alice' }))).statusCode).toBe(400);
  });
  test('a concurrent or stale save cannot overwrite another device', async () => {
    const { handler } = setup();
    const writes = await Promise.all([
      handler(event('alice', 'PUT', { preferences, version: 0 })),
      handler(event('alice', 'PUT', { preferences: { ...preferences, replyTone: 'concise' }, version: 0 })),
    ]);
    expect(writes.map(r => r.statusCode).sort()).toEqual([200, 409]);
    expect((await handler(event('alice', 'PUT', { preferences, version: 1 }))).statusCode).toBe(200);
    expect((await handler(event('alice', 'PUT', { preferences, version: 1 }))).statusCode).toBe(409);
  });
  test('rejects malformed payloads, secrets and invalid preference values', async () => {
    const { handler, records } = setup();
    for (const body of [null, [], {}, { preferences, version: -1 }, { preferences, version: 1.5 },
      { preferences: { ...preferences, apiKey: 'secret' }, version: 0 },
      { preferences: { ...preferences, voiceSpeed: 20 }, version: 0 },
      { preferences: { ...preferences, speakReplies: 'true' }, version: 0 }]) {
      expect((await handler(event('alice', 'PUT', body))).statusCode).toBe(400);
    }
    const malformed = event('alice', 'PUT'); malformed.body = '{';
    expect((await handler(malformed)).statusCode).toBe(400);
    malformed.body = 'a'.repeat(4097);
    expect((await handler(malformed)).statusCode).toBe(413);
    expect(records.size).toBe(0);
  });
  test('accepts API Gateway base64 payloads and rejects unknown routes', async () => {
    const { handler } = setup();
    const request = event('alice', 'PUT', { preferences, version: 0 });
    request.body = Buffer.from(request.body!).toString('base64'); request.isBase64Encoded = true;
    expect((await handler(request)).statusCode).toBe(200);
    expect((await handler(event('alice', 'DELETE'))).statusCode).toBe(404);
  });
  test('returns a safe retryable response on storage failure', async () => {
    const handler = createHandler({ async read() { throw new Error('sensitive internal details'); }, async write() {} });
    const result = await handler(event());
    expect(result.statusCode).toBe(503);
    expect(result.body).not.toContain('sensitive');
  });
});
