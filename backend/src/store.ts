import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { VersionConflict, type PreferenceStore } from './handler';
import { parseDocument } from '../../src/shared/cloud';

export function createDynamoStore(client: DynamoDBDocumentClient, TableName: string): PreferenceStore {
  return {
    async read(userId) {
      const result = await client.send(new GetCommand({ TableName, Key: { userId }, ConsistentRead: true }));
      return result.Item ? parseDocument(result.Item) : { preferences: null, version: 0 };
    },
    async write(userId, document, expectedVersion) {
      try {
        await client.send(new PutCommand({
          TableName, Item: { userId, ...document },
          ConditionExpression: expectedVersion === 0 ? 'attribute_not_exists(userId)' : '#version = :expected',
          ...(expectedVersion > 0 ? {
            ExpressionAttributeNames: { '#version': 'version' },
            ExpressionAttributeValues: { ':expected': expectedVersion },
          } : {}),
        }));
      } catch (error) {
        if (error instanceof Error && error.name === 'ConditionalCheckFailedException') throw new VersionConflict();
        throw error;
      }
    },
  };
}
