import { CLOUD_SCOPE, parsePreferences, type PreferenceDocument } from '../../src/shared/cloud';

export interface PreferenceStore {
  read(userId: string): Promise<PreferenceDocument>;
  write(userId: string, document: PreferenceDocument, expectedVersion: number): Promise<void>;
}
export class VersionConflict extends Error {}

// The function is invoked only through the JWT-authorized API Gateway routes.
export interface ApiEvent {
  routeKey: string;
  body?: string | null;
  isBase64Encoded?: boolean;
  requestContext: { authorizer?: { jwt?: { claims?: Record<string, unknown> } } };
}

export function createHandler(store: PreferenceStore) {
  return async (event: ApiEvent) => {
    const reply = (statusCode: number, body: unknown) => ({
      statusCode,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify(body),
    });
    const claims = event.requestContext?.authorizer?.jwt?.claims;
    const userId = claims?.sub;
    if (typeof userId !== 'string' || !userId || claims?.token_use !== 'access' ||
        typeof claims.scope !== 'string' || !claims.scope.split(' ').includes(CLOUD_SCOPE)) {
      return reply(401, { error: 'Sign in to access preferences.' });
    }
    try {
      if (event.routeKey === 'GET /preferences') return reply(200, await store.read(userId));
      if (event.routeKey !== 'PUT /preferences') return reply(404, { error: 'Not found.' });
      const body = event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString('utf8') : event.body ?? '';
      if (Buffer.byteLength(body) > 4096) return reply(413, { error: 'Request is too large.' });
      let document: PreferenceDocument;
      let version: number;
      try {
        const parsed = JSON.parse(body);
        if (!parsed || Object.keys(parsed).sort().join(',') !== 'preferences,version' ||
            !Number.isSafeInteger(parsed.version) || parsed.version < 0 || parsed.version >= Number.MAX_SAFE_INTEGER) {
          throw new Error('Invalid request.');
        }
        version = parsed.version;
        document = { preferences: parsePreferences(parsed.preferences), version: version + 1 };
      } catch {
        return reply(400, { error: 'Provide valid preferences and a non-negative integer version.' });
      }
      await store.write(userId, document, version);
      return reply(200, document);
    } catch (error) {
      if (error instanceof VersionConflict) return reply(409, { error: 'Cloud preferences changed. Restore them before saving again.' });
      // Do not log tokens, payloads or user identifiers.
      console.error('Preference storage request failed.');
      return reply(503, { error: 'Cloud preferences are temporarily unavailable.' });
    }
  };
}
