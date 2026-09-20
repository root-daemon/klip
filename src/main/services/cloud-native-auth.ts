import type { CloudConfig } from './cloud-auth';
import type { CloudAuthInput, CloudAuthStep } from '../../shared/cloud';

interface Session { accessToken: string; refreshToken: string; expiresAt: number; email: string }
interface Challenge { session: string; username: string }
interface CognitoTokens { AccessToken?: string; RefreshToken?: string; ExpiresIn?: number; TokenType?: string }
interface CognitoResponse {
  __type?: string;
  AuthenticationResult?: CognitoTokens;
  ChallengeName?: string;
  Session?: string;
  ChallengeParameters?: { USERNAME?: string };
  UserAttributes?: Array<{ Name: string; Value: string }>;
  UserConfirmed?: boolean;
}
class CognitoError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
const messages: Record<string, string> = {
  NotAuthorizedException: 'Email, password, or session is invalid. Please sign in again.',
  UserNotFoundException: 'Email or password is incorrect.',
  UsernameExistsException: 'An account with this email already exists. Sign in or reset your password.',
  InvalidPasswordException: 'Use at least 12 characters, including uppercase, lowercase, a number, and a symbol.',
  CodeMismatchException: 'That code is incorrect. Please try again.',
  ExpiredCodeException: 'That code has expired. Request a new code.',
  LimitExceededException: 'Too many attempts. Please wait before trying again.',
  TooManyRequestsException: 'Too many attempts. Please wait before trying again.',
  UserNotConfirmedException: 'Verify your email before signing in.',
  PasswordResetRequiredException: 'Reset your password before signing in.',
};

/** Public Cognito API calls over TLS. Passwords are never retained; tokens stay in main-process memory. */
export class NativeCloudAuth {
  private session: Session | null = null;
  private challenge: Challenge | null = null;
  private refreshing: Promise<string> | null = null;
  private controller = new AbortController();
  private readonly endpoint: string;
  constructor(readonly config: CloudConfig, private readonly request: typeof fetch = fetch) {
    const region = new URL(config.authDomain).hostname.match(/^[a-z0-9-]+\.auth\.([a-z0-9-]+)\.amazoncognito\.com$/)?.[1];
    if (!region) throw new Error('Native sign-in requires the regional Cognito domain in cloud configuration.');
    this.endpoint = `https://cognito-idp.${region}.amazonaws.com/`;
  }
  get signedIn() { return this.session !== null; }
  get email() { return this.session?.email; }
  cancel() {
    this.controller.abort();
    this.controller = new AbortController();
    this.challenge = null;
  }
  private async call(operation: string, body: Record<string, unknown>): Promise<CognitoResponse> {
    const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(15_000)]);
    const response = await this.request(this.endpoint, {
      method: 'POST', redirect: 'error', signal,
      headers: { 'content-type': 'application/x-amz-json-1.1', 'x-amz-target': `AWSCognitoIdentityProviderService.${operation}` },
      body: JSON.stringify(body),
    });
    const data: CognitoResponse = await response.json();
    signal.throwIfAborted();
    if (!response.ok) {
      const code = typeof data?.__type === 'string' ? data.__type.split('#').pop()! : 'Unknown';
      throw new CognitoError(code, messages[code] ?? 'Could not complete this request. Please try again.');
    }
    if (!data || typeof data !== 'object') throw new Error('Invalid authentication response.');
    return data;
  }
  private field(input: CloudAuthInput | undefined, key: keyof CloudAuthInput): string {
    const value = input?.[key];
    if (typeof value !== 'string' || !value || value.length > (key === 'password' ? 256 : 320)) {
      throw new Error(`Enter a valid ${key}.`);
    }
    if (key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new Error('Enter a valid email address.');
    if (key === 'code' && !/^\d{6}$/.test(value.trim())) throw new Error('Enter the six-digit code.');
    return key === 'password' ? value : value.trim();
  }
  private tokens(value: CognitoTokens | undefined): { accessToken: string; refreshToken: string; expiresAt: number } {
    if (!value || typeof value.AccessToken !== 'string' || !value.AccessToken ||
        typeof value.RefreshToken !== 'string' || !value.RefreshToken ||
        typeof value.ExpiresIn !== 'number' || !Number.isFinite(value.ExpiresIn) || value.ExpiresIn <= 0 ||
        value.TokenType?.toLowerCase() !== 'bearer') throw new Error('Invalid authentication response.');
    return { accessToken: value.AccessToken, refreshToken: value.RefreshToken, expiresAt: Date.now() + value.ExpiresIn * 1000 };
  }
  private async complete(data: CognitoResponse, username: string): Promise<CloudAuthStep | undefined> {
    if (data.ChallengeName) {
      if (data.ChallengeName !== 'SOFTWARE_TOKEN_MFA' || typeof data.Session !== 'string') {
        throw new Error('This account requires an unsupported sign-in challenge. Contact support.');
      }
      this.challenge = { session: data.Session, username: data.ChallengeParameters?.USERNAME ?? username };
      return 'mfa';
    }
    const tokens = this.tokens(data.AuthenticationResult);
    const user = await this.call('GetUser', { AccessToken: tokens.accessToken });
    const email = user.UserAttributes?.find((a: { Name: string }) => a.Name === 'email')?.Value;
    if (typeof email !== 'string') throw new Error('Could not load your account email.');
    this.session = { ...tokens, email };
    this.challenge = null;
  }
  async signIn(input?: CloudAuthInput): Promise<CloudAuthStep | undefined> {
    if (this.signedIn) throw new Error('Sign out before switching accounts.');
    this.challenge = null;
    const username = this.field(input, 'email');
    try {
      const data = await this.call('InitiateAuth', { ClientId: this.config.clientId, AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: { USERNAME: username, PASSWORD: this.field(input, 'password') } });
      return await this.complete(data, username);
    } catch (error) {
      if (error instanceof CognitoError && error.code === 'UserNotConfirmedException') return 'confirm-sign-up';
      if (error instanceof CognitoError && error.code === 'PasswordResetRequiredException') return 'forgot-password';
      throw error;
    }
  }
  async mfa(input?: CloudAuthInput) {
    const challenge = this.challenge;
    if (!challenge) throw new Error('Sign in again to request a new authentication challenge.');
    return this.complete(await this.call('RespondToAuthChallenge', {
      ClientId: this.config.clientId, ChallengeName: 'SOFTWARE_TOKEN_MFA', Session: challenge.session,
      ChallengeResponses: { USERNAME: challenge.username, SOFTWARE_TOKEN_MFA_CODE: this.field(input, 'code') },
    }), challenge.username);
  }
  async signUp(input?: CloudAuthInput): Promise<CloudAuthStep> {
    const email = this.field(input, 'email');
    const data = await this.call('SignUp', { ClientId: this.config.clientId, Username: email,
      Password: this.field(input, 'password'), UserAttributes: [{ Name: 'email', Value: email }] });
    return data.UserConfirmed ? 'sign-in' : 'confirm-sign-up';
  }
  async confirmSignUp(input?: CloudAuthInput) {
    await this.call('ConfirmSignUp', { ClientId: this.config.clientId, Username: this.field(input, 'email'), ConfirmationCode: this.field(input, 'code') });
  }
  async resend(input?: CloudAuthInput) {
    await this.call('ResendConfirmationCode', { ClientId: this.config.clientId, Username: this.field(input, 'email') });
  }
  async forgotPassword(input?: CloudAuthInput) {
    await this.call('ForgotPassword', { ClientId: this.config.clientId, Username: this.field(input, 'email') });
  }
  async resetPassword(input?: CloudAuthInput) {
    await this.call('ConfirmForgotPassword', { ClientId: this.config.clientId, Username: this.field(input, 'email'),
      ConfirmationCode: this.field(input, 'code'), Password: this.field(input, 'password') });
  }
  async accessToken(): Promise<string> {
    const session = this.session;
    if (!session) throw new Error('Sign in first.');
    if (session.expiresAt > Date.now() + 30_000) return session.accessToken;
    if (!this.refreshing) {
      this.refreshing = this.call('GetTokensFromRefreshToken', { ClientId: this.config.clientId, RefreshToken: session.refreshToken }).then(data => {
        if (this.session !== session) throw new Error('The account session changed.');
        const tokens = this.tokens(data.AuthenticationResult);
        this.session = { ...session, ...tokens };
        return tokens.accessToken;
      }).catch(error => {
        if (this.session === session) this.session = null;
        throw error;
      }).finally(() => { this.refreshing = null; });
    }
    return this.refreshing;
  }
  async signOut() {
    const session = this.session;
    this.session = null;
    this.cancel();
    if (session) await this.call('RevokeToken', { ClientId: this.config.clientId, Token: session.refreshToken });
  }
}
