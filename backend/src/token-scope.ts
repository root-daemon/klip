/** Native Cognito API sign-in doesn't request OAuth scopes. Grant our scope only after email verification. */
interface TokenEvent {
  version: string;
  triggerSource: string;
  request: { userAttributes: Record<string, string> };
  response: {
    claimsAndScopeOverrideDetails?: {
      accessTokenGeneration?: { scopesToAdd?: string[] };
    };
  };
}
export async function handler(event: TokenEvent): Promise<TokenEvent> {
  if (event.version !== '2' || !['TokenGeneration_Authentication', 'TokenGeneration_RefreshTokens', 'TokenGeneration_HostedAuth'].includes(event.triggerSource)) {
    throw new Error('Unsupported token generation event.');
  }
  if (event.request.userAttributes.email_verified !== 'true') throw new Error('Email verification is required.');
  event.response.claimsAndScopeOverrideDetails = {
    accessTokenGeneration: { scopesToAdd: ['klip/preferences'] },
  };
  return event;
}
