import { describe, expect, test } from 'bun:test';
import { NativeCloudAuth } from '../src/main/services/cloud-native-auth';

const config = { apiUrl: 'https://api.example.com', authDomain: 'https://klip-dev.auth.us-east-1.amazoncognito.com', clientId: 'client123' };
const credentials = { email: 'user@example.com', password: 'Example!123456' };
const tokens = (suffix = '1', expires = 300) => ({ AccessToken: `access-${suffix}`, RefreshToken: `refresh-${suffix}`, TokenType: 'Bearer', ExpiresIn: expires });
function setup(handler: (operation: string, body: any, init: RequestInit) => unknown | Promise<unknown>) {
  const calls: Array<{ operation: string; body: any }> = [];
  const request = (async (url: string, init: RequestInit) => {
    expect(url).toBe('https://cognito-idp.us-east-1.amazonaws.com/');
    expect(init.redirect).toBe('error');
    const operation = (init.headers as Record<string, string>)['x-amz-target'].split('.').pop()!;
    const body = JSON.parse(init.body as string);
    calls.push({ operation, body });
    const result = await handler(operation, body, init);
    return result instanceof Response ? result : Response.json(result);
  }) as unknown as typeof fetch;
  return { auth: new NativeCloudAuth(config, request), calls };
}
const user = { UserAttributes: [{ Name: 'email', Value: credentials.email }] };

describe('native account authentication', () => {
  test('signs in with Cognito and exposes only status/email; refreshes once and revokes rotated refresh token', async () => {
    const { auth, calls } = setup(op => {
      if (op === 'InitiateAuth') return { AuthenticationResult: tokens('1', 1) };
      if (op === 'GetUser') return user;
      if (op === 'GetTokensFromRefreshToken') return { AuthenticationResult: tokens('2') };
      return {};
    });
    expect(await auth.signIn(credentials)).toBeUndefined();
    expect(auth.signedIn).toBe(true);
    expect(auth.email).toBe(credentials.email);
    expect(calls[0].body).toEqual({ ClientId: config.clientId, AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: credentials.email, PASSWORD: credentials.password } });
    expect(await Promise.all([auth.accessToken(), auth.accessToken()])).toEqual(['access-2', 'access-2']);
    expect(calls.filter(c => c.operation === 'GetTokensFromRefreshToken')).toHaveLength(1);
    await auth.signOut();
    expect(auth.signedIn).toBe(false);
    expect(calls.at(-1)?.body).toEqual({ ClientId: config.clientId, Token: 'refresh-2' });
  });
  test('verification and password recovery use distinct native API operations', async () => {
    const { auth, calls } = setup(() => ({}));
    expect(await auth.signUp(credentials)).toBe('confirm-sign-up');
    await auth.confirmSignUp({ email: credentials.email, code: '123456' });
    await auth.resend(credentials);
    await auth.forgotPassword(credentials);
    await auth.resetPassword({ ...credentials, code: '654321' });
    expect(calls.map(c => c.operation)).toEqual(['SignUp', 'ConfirmSignUp', 'ResendConfirmationCode', 'ForgotPassword', 'ConfirmForgotPassword']);
    expect(calls[1].body).not.toHaveProperty('Password');
    expect(calls[4].body.ConfirmationCode).toBe('654321');
    expect(auth.signedIn).toBe(false);
  });
  test('unconfirmed users are routed to verification; provider errors do not expose raw messages', async () => {
    let error = 'UserNotConfirmedException';
    const { auth } = setup(() => Response.json({ __type: error, message: 'secret internal detail' }, { status: 400 }));
    expect(await auth.signIn(credentials)).toBe('confirm-sign-up');
    error = 'NotAuthorizedException';
    await expect(auth.signIn(credentials)).rejects.toThrow('Email, password, or session is invalid');
    expect(auth.signedIn).toBe(false);
  });
  test('authenticator challenge keeps Cognito session and canonical username in the main process', async () => {
    const { auth, calls } = setup(op => {
      if (op === 'InitiateAuth') return { ChallengeName: 'SOFTWARE_TOKEN_MFA', Session: 'private-session', ChallengeParameters: { USERNAME: 'canonical-user' } };
      if (op === 'RespondToAuthChallenge') return { AuthenticationResult: tokens() };
      return user;
    });
    expect(await auth.signIn(credentials)).toBe('mfa');
    expect(auth.signedIn).toBe(false);
    await auth.mfa({ code: '123456' });
    expect(calls[1].body).toEqual({ ClientId: config.clientId, ChallengeName: 'SOFTWARE_TOKEN_MFA', Session: 'private-session', ChallengeResponses: { USERNAME: 'canonical-user', SOFTWARE_TOKEN_MFA_CODE: '123456' } });
    expect(auth.signedIn).toBe(true);
  });
  test('cancelling a pending sign-in cannot establish a session', async () => {
    let finish!: (value: unknown) => void;
    const { auth } = setup(() => new Promise(resolve => { finish = resolve; }));
    const result = auth.signIn(credentials);
    auth.cancel();
    finish({ AuthenticationResult: tokens() });
    await expect(result).rejects.toThrow();
    expect(auth.signedIn).toBe(false);
  });
  test('rejects malformed inputs before sending credentials; untrusted domain cannot receive passwords', async () => {
    expect(() => new NativeCloudAuth({ ...config, authDomain: 'https://example.com' })).toThrow();
    const { auth, calls } = setup(() => ({}));
    await expect(auth.signIn({ email: 'bad', password: 'test' })).rejects.toThrow();
    await expect(auth.confirmSignUp({ email: credentials.email, code: '12' })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
  test('a failed token refresh clears the session', async () => {
    const { auth } = setup(op => op === 'InitiateAuth' ? { AuthenticationResult: tokens('1', 1) } :
      op === 'GetUser' ? user : Response.json({ __type: 'NotAuthorizedException' }, { status: 400 }));
    await auth.signIn(credentials);
    await expect(auth.accessToken()).rejects.toThrow();
    expect(auth.signedIn).toBe(false);
  });
});
