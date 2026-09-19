import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createHandler } from './handler';
import { createDynamoStore } from './store';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TableName = process.env.PREFERENCES_TABLE;
if (!TableName) throw new Error('PREFERENCES_TABLE is required.');

export const handler = createHandler(createDynamoStore(client, TableName));
