import { expect, test } from 'bun:test';
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient, waitUntilTableExists } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createDynamoStore } from '../src/store';
import { VersionConflict } from '../src/handler';

const endpoint = process.env.KLIP_DYNAMODB_TEST_ENDPOINT;
test.skipIf(!endpoint)('DynamoDB enforces account isolation and atomic version checks', async () => {
  const url = new URL(endpoint!);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Integration tests only use local DynamoDB.');
  const client = new DynamoDBClient({ endpoint, region: 'us-east-1', credentials: { accessKeyId: 'local', secretAccessKey: 'local' } });
  const TableName = `klip-test-${crypto.randomUUID()}`;
  await client.send(new CreateTableCommand({ TableName, BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [{ AttributeName: 'userId', AttributeType: 'S' }], KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }] }));
  try {
    await waitUntilTableExists({ client, maxWaitTime: 20, minDelay: 1 }, { TableName });
    const store = createDynamoStore(DynamoDBDocumentClient.from(client), TableName);
    const document = { version: 1, preferences: { replyTone: 'friendly' as const, reasoningDepth: 'off' as const,
      voiceSpeed: 1, voiceStability: 0.5, speakReplies: true, isClickyCursorEnabled: true } };
    const competing = await Promise.allSettled([store.write('alice', document, 0), store.write('alice', document, 0)]);
    expect(competing.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const failure = competing.find(r => r.status === 'rejected') as PromiseRejectedResult;
    expect(failure.reason).toBeInstanceOf(VersionConflict);
    expect(await store.read('alice')).toEqual(document);
    expect(await store.read('bob')).toEqual({ preferences: null, version: 0 });
    await store.write('alice', { ...document, version: 2 }, 1);
    await expect(store.write('alice', { ...document, version: 2 }, 1)).rejects.toBeInstanceOf(VersionConflict);
    await expect(store.write('bob', { ...document, version: 2 }, 1)).rejects.toBeInstanceOf(VersionConflict);
    expect((await store.read('alice')).version).toBe(2);
  } finally {
    await client.send(new DeleteTableCommand({ TableName }));
    client.destroy();
  }
}, 30_000);
