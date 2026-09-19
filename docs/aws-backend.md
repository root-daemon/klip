# AWS accounts and preference sync

KLIP's optional AWS backend adds browser-based account creation/sign-in and explicit preference save/restore. The desktop app still works without AWS configuration. No AWS resources are deployed by building or testing the project.

## Architecture

```text
Electron settings panel → restricted preload IPC → Electron main process
                                                     ├─ Cognito managed login (system browser)
                                                     └─ access token → API Gateway JWT authorizer
                                                                          → Lambda → DynamoDB
```

Cognito manages email verification, password recovery and optional authenticator MFA. The public desktop client uses OAuth authorization code + S256 PKCE, random state and a temporary localhost callback. It has no client secret or AWS credentials. The access token authorizes only the `klip/preferences` scope. API Gateway validates signature, issuer, client audience, expiry and scope; Lambda also requires an access token and derives the storage key from its verified `sub` claim.

Tokens live only in Electron main-process memory. They never enter the renderer, localStorage, logs or the settings file. Refresh tokens rotate, expire after one day, and are revoked on sign-out. Access tokens expire after five minutes. Restarting KLIP requires signing in again. Sign-out clears local tokens even if revocation cannot reach Cognito. API Gateway's JWT validation does not check Cognito revocation, so an already-issued access token can remain usable until expiry. Sign-in explicitly prompts for credentials; the external browser's Cognito cookie is not cleared by local sign-out.

## What syncs

Only these portable preferences are accepted by the client and backend:

- Reply tone and reasoning depth
- Voice speed and stability
- Spoken replies on/off
- Companion cursor visibility

Provider selection/model IDs, voice IDs, API keys, chat history, screenshots, local model connections, shortcuts, window positions, launch-at-login and auto-typing permissions stay local. This prevents restoring settings that require unavailable credentials or granting desktop privileges on a new device.

Open **General → Account & preferences** and sign in. **Save to cloud** explicitly replaces the account's saved preference set with this device's preferences. **Restore from cloud** downloads and applies the saved set in one local file write. Signing in alone does not change preferences. On a second device, sign in to the same account and choose Restore. Changes are not uploaded in the background.

If another device saves after this device's last read, saving returns a conflict. Restore first, then make your changes and save again. A lost write response can similarly require restoring before another save; the backend does not retry a conflicting write or silently merge it.

## Data model

Authorization boundary: the partition key is the authenticated Cognito subject, never a client-supplied user ID. The API exposes only `/preferences`; there is no route for reading another user's document.

| Access pattern | DynamoDB operation | Consistency / guard | Result |
| --- | --- | --- | --- |
| Load my preferences | `GetItem`, key `{userId: sub}` | Strongly consistent | Zero or one document |
| First save | `PutItem`, same key | `attribute_not_exists(userId)` | Version 1 |
| Replace saved preferences | `PutItem`, same key | Existing version must equal submitted version | Version increments |

One table, no sort key or indexes. Each item contains `userId` (Cognito UUID), `version` (integer), and the six allowlisted preference fields in a `preferences` map; the expected item is below 1 KB. Requests are capped at 4 KB before validation. Traffic volume is not yet known; the initial API throttle is 10 requests/second with a burst of 20, not a per-user quota or spend cap. Capacity is on-demand. No scans, TTL, Streams, fan-out consumers, cross-region replication or background jobs are needed for these access patterns.

DynamoDB uses its default AWS-owned encryption key and TLS in transit. PITR and deletion protection are enabled. The table and user pool are retained on stack removal/replacement; retained resources continue to exist and incur applicable charges. Lambda can only GetItem/PutItem on this table. CloudWatch access logs omit identities, tokens and payloads and expire after 14 days. Lambda error, API 5xx and DynamoDB write-throttle alarms are included; operators should connect alarm notifications and set account budgets and service monitoring before production. No monthly estimate is asserted without a region and expected account/request volume. Cognito Essentials, API Gateway, Lambda, database storage/requests, PITR and logs can incur charges.

## Build and test

Use Bun from the repository root:

```sh
bun install --frozen-lockfile
bun install --cwd backend --frozen-lockfile
bun test tests backend/tests
bun run typecheck
bun run --cwd backend typecheck
bun run build
bun run --cwd backend build
uvx --from cfn-lint cfn-lint backend/template.yaml
```

`uvx` runs the CloudFormation/SAM schema validator locally. The backend build bundles its AWS SDK dependencies into `backend/dist/index.js` for the Node.js 22 Lambda runtime. Tests cover OAuth callbacks/PKCE/cancellation, refresh rotation, credential exclusion, authorization, account isolation, invalid payloads and stale writes.

The DynamoDB adapter integration test is skipped unless a local endpoint is set. It never uses real AWS credentials or an AWS endpoint. To run it against DynamoDB Local:

```sh
docker run --rm -d --name klip-dynamodb-test -p 127.0.0.1:8000:8000 amazon/dynamodb-local:latest -jar DynamoDBLocal.jar -inMemory -sharedDb
KLIP_DYNAMODB_TEST_ENDPOINT=http://127.0.0.1:8000 bun test tests backend/tests
docker stop klip-dynamodb-test
```

The integration test creates an isolated table, races conditional writes, checks account separation and cleans up its table. CI runs it with a DynamoDB Local service alongside builds and template validation.

## Deploy

Prerequisites: AWS CLI credentials for your intended account/region and AWS SAM CLI. Choose a separate stack and globally unique Cognito domain prefix for each environment. Deployment creates billable resources.

```sh
bun install --cwd backend --frozen-lockfile
bun run --cwd backend build
sam validate --lint --template-file backend/template.yaml
sam deploy --guided --template-file backend/template.yaml
```

Set a stack name such as `klip-dev`, your AWS region, and the `DomainPrefix` parameter. Allow SAM to create the Lambda execution role (`CAPABILITY_IAM`) and resolve its artifact bucket. Keep change-set confirmation enabled to review the concrete resources before execution. No `sam build` is needed: Bun already created the bundle referenced by `CodeUri`.

After deployment, retrieve the `ApiUrl`, `AuthDomain` and `ClientId` stack outputs. Cognito managed-login branding is included in the template, so no separate console branding step is needed. Cognito's default email sender is suitable for initial testing; production email delivery/quotas and account recovery should be verified for the chosen account and region.

## Configure the desktop

Set all three environment variables **on the Electron process** before starting it:

```sh
export KLIP_CLOUD_API_URL='https://YOUR_API.execute-api.YOUR_REGION.amazonaws.com'
export KLIP_CLOUD_AUTH_DOMAIN='https://YOUR_PREFIX.auth.YOUR_REGION.amazoncognito.com'
export KLIP_CLOUD_CLIENT_ID='YOUR_CLIENT_ID'
bun run dev
# In a second terminal with the same exported variables:
bun run start
```

Alternatively, create `klip-cloud.json` in Electron's `app.getPath('userData')` directory (typically `~/Library/Application Support/klip` on macOS, `%APPDATA%/klip` on Windows or `~/.config/klip` on Linux; packaged app naming may differ):

```json
{
  "apiUrl": "https://YOUR_API.execute-api.YOUR_REGION.amazonaws.com",
  "authDomain": "https://YOUR_PREFIX.auth.YOUR_REGION.amazoncognito.com",
  "clientId": "YOUR_CLIENT_ID"
}
```

These are public endpoint identifiers, not secrets. Environment variables take precedence as a complete configuration; do not supply only one. Both endpoints must be HTTPS origins without paths or query strings. Restart the app after configuring it. The localhost callback is fixed at `http://localhost:43827/callback`; that port must be free. Cancellation, denied login and a three-minute timeout close the temporary listener. If you change the port, update both the client and stack callback URLs.

## Deployment smoke test

1. Confirm unauthenticated GET/PUT `/preferences` requests return 401/403.
2. Create and verify a test account using the desktop's browser sign-in. Confirm password recovery works.
3. Save preferences on device A, sign in with the same account on B, and restore. Confirm the live cursor and General/Mind/Voice controls update.
4. Sign in with a different account; confirm it has no access to the first account's saved preferences.
5. With both devices signed in, save from A and attempt a stale save from B. B must show a conflict and require Restore.
6. Leave a session idle for over five minutes, then restore to exercise a real Cognito refresh. Sign out and confirm cloud actions are unavailable while local AI continues to work.
7. Cancel sign-in, deny authorization, and try with port 43827 occupied; errors must be visible and a later sign-in must work.

Local tests cannot certify live Cognito email delivery, AWS account permissions, managed-login availability or deployed API authorizer behavior. Complete this checklist after deploying to the intended test account.

## Later phases

Managed AI access through Bedrock, usage accounting/enforcement, billing, chat sync and persistent encrypted account sessions are separate follow-ups. This milestone provisions only account authentication and preference sync.

Implementation references: [Cognito authorization + PKCE](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html), [refresh tokens](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-the-refresh-token.html), [API Gateway JWT authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html).
