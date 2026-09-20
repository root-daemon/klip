import { describe, expect, test } from 'bun:test';
import { createHash } from 'crypto';
import { beginAuthorization, CloudAuth, parseCloudConfig } from '../src/main/services/cloud-auth';
import { CloudPreferencesClient } from '../src/main/services/cloud-preferences';
import { parsePreferences, pickPreferences } from '../src/shared/cloud';

const config = { apiUrl: 'https://api.example.com', authDomain: 'https://auth.example.com', clientId: 'client123' };
const preferences = { replyTone: 'friendly' as const, reasoningDepth: 'off' as const,
  voiceSpeed: 1, voiceStability: 0.5, speakReplies: true, isClickyCursorEnabled: true };
function transport(handler: (url: string, init?: RequestInit) => Promise<Response>): typeof fetch {
  return handler as unknown as typeof fetch;
}

describe('cloud authentication', () => {
  test('rejects plaintext endpoints and embedded credentials', () => {
    expect(parseCloudConfig(config)).toEqual(config);
    for (const apiUrl of ['http://example.com', 'https://user:password@example.com', 'https://example.com/?key=secret', 'https://example.com/path']) {
      expect(() => parseCloudConfig({ ...config, apiUrl })).toThrow();
    }
  });
  test('loopback login binds PKCE and state, ignoring a forged callback', async () => {
    const login = await beginAuthorization(config, 5000);
    try {
      const url = new URL(login.url);
      expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(login.verifier).digest('base64url'));
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('prompt')).toBe('login');
      const callback = new URL(url.searchParams.get('redirect_uri')!);
      callback.search = new URLSearchParams({ state: 'forged', code: 'bad' }).toString();
      expect((await fetch(callback)).status).toBe(400);
      callback.search = new URLSearchParams({ state: url.searchParams.get('state')!, code: 'valid' }).toString();
      expect((await fetch(callback)).status).toBe(200);
      expect(await login.code).toBe('valid');
    } finally { login.cancel(); }
  });
  test('cancellation and timeout release the callback port', async () => {
    const login = await beginAuthorization(config);
    login.cancel();
    await expect(login.code).rejects.toThrow('cancelled');
    const retry = await beginAuthorization(config, 10);
    await expect(retry.code).rejects.toThrow('timed out');
    const final = await beginAuthorization(config); final.cancel();
    await expect(final.code).rejects.toThrow('cancelled');
  });
  test('denied login releases the listener and a port collision is reported', async () => {
    const login = await beginAuthorization(config);
    try {
      let duplicate: Awaited<ReturnType<typeof beginAuthorization>> | undefined;
      try { await expect(beginAuthorization(config).then(result => { duplicate = result; })).rejects.toThrow(); }
      finally { duplicate?.cancel(); }
      const authorization = new URL(login.url);
      const callback = new URL(authorization.searchParams.get('redirect_uri')!);
      callback.search = new URLSearchParams({ state: authorization.searchParams.get('state')!, error: 'access_denied' }).toString();
      await fetch(callback);
      await expect(login.code).rejects.toThrow('denied');
    } finally { login.cancel(); }
  });
  test('refresh rotates tokens once for concurrent callers and sign-out revokes the latest token', async () => {
    const grants: URLSearchParams[] = [];
    let revoked = '';
    const auth = new CloudAuth(config, transport(async (url, init) => {
      if (url.endsWith('/userInfo')) return Response.json({ sub: 'alice', email: 'alice@example.com' });
      const body = new URLSearchParams(init?.body as URLSearchParams);
      if (url.endsWith('/revoke')) { revoked = body.get('token')!; return new Response(null, { status: 200 }); }
      grants.push(body);
      return Response.json({ access_token: grants.length === 1 ? 'old' : 'new', refresh_token: grants.length === 1 ? 'refresh1' : 'refresh2',
        token_type: 'Bearer', expires_in: grants.length === 1 ? 1 : 300 });
    }));
    await auth.complete('code', 'verifier');
    expect(auth.email).toBe('alice@example.com');
    expect(grants[0].get('code_verifier')).toBe('verifier');
    expect(await Promise.all([auth.accessToken(), auth.accessToken()])).toEqual(['new', 'new']);
    expect(grants.length).toBe(2);
    expect(grants[1].get('refresh_token')).toBe('refresh1');
    await auth.signOut(); expect(revoked).toBe('refresh2'); expect(auth.signedIn).toBe(false);
    await expect(auth.accessToken()).rejects.toThrow('Sign in first');
  });
  test('failed refresh clears the session and failed revocation still signs out locally', async () => {
    let fail = false;
    const auth = new CloudAuth(config, transport(async url => {
      if (fail) return new Response(null, { status: 400 });
      if (url.endsWith('/userInfo')) return Response.json({ sub: 'a', email: 'a@example.com' });
      return Response.json({ access_token: 'a', refresh_token: 'r', token_type: 'Bearer', expires_in: 1 });
    }));
    await auth.complete('c', 'v'); fail = true;
    await expect(auth.accessToken()).rejects.toThrow(); expect(auth.signedIn).toBe(false);
    fail = false; await auth.complete('c', 'v'); fail = true;
    await expect(auth.signOut()).rejects.toThrow(); expect(auth.signedIn).toBe(false);
  });
});

describe('preference sync client', () => {
  test('only sends portable preferences and the previously read version', async () => {
    const fullSettings = { ...preferences, apiKey: 'secret', chatHistory: ['private'], autoTypeEnabled: true };
    expect(pickPreferences(fullSettings)).toEqual(preferences);
    expect(() => parsePreferences(fullSettings)).toThrow();
    let saved: unknown;
    const client = new CloudPreferencesClient(config.apiUrl, async () => 'access-token', transport(async (_url, init) => {
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer access-token');
      if (init?.method === 'GET') return Response.json({ preferences, version: 3 });
      saved = JSON.parse(init?.body as string);
      return Response.json({ preferences, version: 4 });
    }));
    await expect(client.save(fullSettings)).rejects.toThrow('Restore');
    await client.read(); await client.save(fullSettings);
    expect(saved).toEqual({ preferences, version: 3 });
    client.clear(); expect(client.hasSavedPreferences).toBe(false);
    await expect(client.save(preferences)).rejects.toThrow('Restore');
  });
  test('reports stale saves without retrying and rejects invalid server responses', async () => {
    let calls = 0;
    const client = new CloudPreferencesClient(config.apiUrl, async () => 'token', transport(async () => {
      calls++;
      return calls === 1 ? Response.json({ preferences, version: 1 }) : new Response(null, { status: 409 });
    }));
    await client.read(); await expect(client.save(preferences)).rejects.toThrow('another device');
    expect(calls).toBe(2);
    const invalid = new CloudPreferencesClient(config.apiUrl, async () => 'token', transport(async () => Response.json({ preferences: { ...preferences, autoTypeEnabled: true }, version: 1 })));
    await expect(invalid.read()).rejects.toThrow();
  });
});
