import { expect, test } from 'bun:test';
import { handler } from '../src/token-scope';

test('grants preference scope on native login, refresh and legacy OAuth for verified users only', async () => {
  for (const triggerSource of ['TokenGeneration_Authentication', 'TokenGeneration_RefreshTokens', 'TokenGeneration_HostedAuth']) {
    const event = { version: '2', triggerSource, request: { userAttributes: { email_verified: 'true' } }, response: {} };
    const result = await handler(event);
    expect(result.response.claimsAndScopeOverrideDetails?.accessTokenGeneration?.scopesToAdd).toEqual(['klip/preferences']);
    await expect(handler({ ...event, request: { userAttributes: { email_verified: 'false' } } })).rejects.toThrow('Email verification');
  }
  await expect(handler({ version: '2', triggerSource: 'TokenGeneration_ClientCredentials', request: { userAttributes: {} }, response: {} })).rejects.toThrow();
});
