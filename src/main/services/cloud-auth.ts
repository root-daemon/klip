import { createHash, randomBytes } from 'crypto';
import { createServer } from 'http';
import { CLOUD_SCOPE } from '../../shared/cloud';

export interface CloudConfig { apiUrl: string; authDomain: string; clientId: string }
export const CLOUD_CALLBACK = 'http://localhost:43827/callback';

export function parseCloudConfig(value: unknown): CloudConfig {
  if (!value || typeof value !== 'object') throw new Error('Invalid cloud configuration.');
  const c = value as CloudConfig;
  function https(value: string): string {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error('Cloud endpoints must be HTTPS origins.');
    }
    return url.origin;
  }
  if (typeof c.clientId !== 'string' || !/^[a-z0-9]{1,128}$/.test(c.clientId)) throw new Error('Invalid cloud client ID.');
  return { apiUrl: https(c.apiUrl), authDomain: https(c.authDomain), clientId: c.clientId };
}

/** Temporary loopback listener; no remotely reachable interface or custom URL protocol. */
export async function beginAuthorization(config: CloudConfig, timeoutMs = 180_000) {
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const url = new URL('/oauth2/authorize', config.authDomain);
  url.search = new URLSearchParams({
    response_type: 'code', client_id: config.clientId, redirect_uri: CLOUD_CALLBACK,
    scope: `openid email ${CLOUD_SCOPE}`, state, prompt: 'login',
    code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url'),
  }).toString();
  let resolveCode!: (code: string) => void;
  let rejectCode!: (error: Error) => void;
  const code = new Promise<string>((resolve, reject) => { resolveCode = resolve; rejectCode = reject; });
  // Cancellation can happen while the external browser is still opening.
  void code.catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;
  let settled = false;
  const finish = (error?: Error, authorizationCode?: string) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    server.close();
    server.closeAllConnections();
    if (error) rejectCode(error); else resolveCode(authorizationCode!);
  };
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    let callback: URL;
    try { callback = new URL(req.url ?? '/', CLOUD_CALLBACK); }
    catch { res.writeHead(400).end('Invalid callback.'); return; }
    if (req.method !== 'GET' || callback.pathname !== '/callback' || req.headers.host !== 'localhost:43827') {
      res.writeHead(404).end('Not found.'); return;
    }
    if (callback.searchParams.get('state') !== state) {
      res.writeHead(400).end('Invalid sign-in state. Return to KLIP and try again.'); return;
    }
    const authorizationCode = callback.searchParams.get('code');
    const failed = callback.searchParams.has('error') || !authorizationCode;
    // Let the browser receive the response before closing its connection.
    res.once('finish', () => finish(failed ? new Error('Sign-in was cancelled or denied.') : undefined, authorizationCode ?? undefined));
    res.end(failed ? 'Sign-in was not completed. Return to KLIP.' : 'Sign-in received. You can return to KLIP.');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen({ port: 43827, host: '127.0.0.1', exclusive: true }, () => { server.removeListener('error', reject); resolve(); });
  });
  server.on('error', () => finish(new Error('The sign-in callback failed.')));
  timer = setTimeout(() => finish(new Error('Sign-in timed out. Try again.')), timeoutMs);
  return { url: url.toString(), verifier, code, cancel: () => finish(new Error('Sign-in cancelled.')) };
}

interface Session { accessToken: string; refreshToken: string; expiresAt: number; email: string }

/** Tokens remain in main-process memory and are never sent to renderer or disk. */
export class CloudAuth {
  private session: Session | null = null;
  private refreshing: Promise<string> | null = null;
  constructor(readonly config: CloudConfig, private readonly request: typeof fetch = fetch) {}
  get email(): string | undefined { return this.session?.email; }
  get signedIn(): boolean { return this.session !== null; }

  private async token(parameters: Record<string, string>) {
    const response = await this.request(`${this.config.authDomain}/oauth2/token`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.config.clientId, ...parameters }),
      signal: AbortSignal.timeout(15_000), redirect: 'error',
    });
    if (!response.ok) throw new Error('Could not authenticate. Please sign in again.');
    const data = await response.json();
    if (typeof data.access_token !== 'string' || !data.access_token ||
        typeof data.expires_in !== 'number' || !Number.isFinite(data.expires_in) || data.expires_in <= 0 ||
        data.token_type?.toLowerCase() !== 'bearer') throw new Error('Invalid authentication response.');
    return data as { access_token: string; refresh_token?: string; expires_in: number };
  }

  async complete(code: string, verifier: string): Promise<void> {
    const tokens = await this.token({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: CLOUD_CALLBACK });
    if (!tokens.refresh_token) throw new Error('Sign-in did not return a refresh token.');
    const response = await this.request(`${this.config.authDomain}/oauth2/userInfo`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(15_000), redirect: 'error',
    });
    if (!response.ok) throw new Error('Could not load your account. Please sign in again.');
    const user = await response.json();
    if (typeof user.sub !== 'string' || typeof user.email !== 'string') throw new Error('Invalid account response.');
    this.session = { accessToken: tokens.access_token, refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000, email: user.email };
  }

  async accessToken(): Promise<string> {
    const session = this.session;
    if (!session) throw new Error('Sign in first.');
    if (session.expiresAt > Date.now() + 30_000) return session.accessToken;
    if (!this.refreshing) {
      this.refreshing = this.token({ grant_type: 'refresh_token', refresh_token: session.refreshToken }).then(tokens => {
        if (this.session !== session) throw new Error('The account session changed.');
        this.session = { ...session, accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? session.refreshToken, expiresAt: Date.now() + tokens.expires_in * 1000 };
        return tokens.access_token;
      }).catch(error => {
        if (this.session === session) this.session = null;
        throw error;
      }).finally(() => { this.refreshing = null; });
    }
    return this.refreshing;
  }

  async signOut(): Promise<void> {
    const session = this.session;
    this.session = null;
    if (!session) return;
    const response = await this.request(`${this.config.authDomain}/oauth2/revoke`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.config.clientId, token: session.refreshToken }),
      signal: AbortSignal.timeout(15_000), redirect: 'error',
    });
    if (!response.ok) throw new Error('Signed out locally, but session revocation failed.');
  }
}
