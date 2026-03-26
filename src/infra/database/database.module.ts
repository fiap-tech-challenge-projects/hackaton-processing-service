import { Module } from '@nestjs/common'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDbAnalysisResultRepository } from './dynamodb-analysis-result.repository'
import { ANALYSIS_RESULT_REPOSITORY } from '@domain/repositories/analysis-result.repository'

@Module({
  providers: [
    {
      provide: 'DynamoDBClient',
      useFactory: () => {
        const endpoint = process.env.DYNAMODB_ENDPOINT
        return new DynamoDBClient({
          region: process.env.AWS_REGION || 'us-east-1',
          ...(endpoint && { endpoint }),
        })
      },
    },
    {
      provide: ANALYSIS_RESULT_REPOSITORY,
      useFactory: (dynamoClient: DynamoDBClient) =>
        new DynamoDbAnalysisResultRepository(dynamoClient),
      inject: ['DynamoDBClient'],
    },
  ],
  exports: [ANALYSIS_RESULT_REPOSITORY],
})
export class DatabaseModule {}
