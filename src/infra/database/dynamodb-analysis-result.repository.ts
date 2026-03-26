import { Injectable } from '@nestjs/common'
import { DynamoDBClient, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { IAnalysisResultRepository } from '@domain/repositories/analysis-result.repository'
import { AnalysisResult } from '@domain/entities/analysis-result.entity'
import { ComponentVO } from '@domain/value-objects/component.vo'
import { RiskVO } from '@domain/value-objects/risk.vo'
import { RecommendationVO } from '@domain/value-objects/recommendation.vo'
import { ComponentType } from '@shared/constants/component-types'
import { RiskCategory, RiskSeverity } from '@shared/constants/risk-categories'

@Injectable()
export class DynamoDbAnalysisResultRepository implements IAnalysisResultRepository {
  private readonly tableName: string

  constructor(private readonly dynamoClient: DynamoDBClient) {
    const env = process.env.NODE_ENV || 'development'
    this.tableName = process.env.DYNAMODB_TABLE_NAME || `hackaton-analysis-results-${env}`
  }

  async save(result: AnalysisResult): Promise<void> {
    const item = {
      analysisId: result.analysisId,
      createdAt: result.createdAt.toISOString(),
      id: result.id,
      components: result.components.map((c) => c.toJSON()),
      risks: result.risks.map((r) => r.toJSON()),
      recommendations: result.recommendations.map((r) => r.toJSON()),
      summary: result.summary,
      rawLlmResponse: result.rawLlmResponse,
      metadata: result.metadata,
      validation: result.validation,
      updatedAt: result.updatedAt.toISOString(),
    }

    await this.dynamoClient.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(item, { removeUndefinedValues: true }),
      }),
    )
  }

  async findByAnalysisId(analysisId: string): Promise<AnalysisResult | null> {
    const result = await this.dynamoClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'analysisId = :analysisId',
        ExpressionAttributeValues: {
          ':analysisId': { S: analysisId },
        },
        ScanIndexForward: false,
        Limit: 1,
      }),
    )

    if (!result.Items || result.Items.length === 0) {
      return null
    }

    return this.mapToDomain(unmarshall(result.Items[0]))
  }

  private mapToDomain(data: any): AnalysisResult {
    const components = (data.components || []).map(
      (c: any) =>
        new ComponentVO(c.name, c.type as ComponentType, c.description, c.connections || []),
    )

    const risks = (data.risks || []).map(
      (r: any) =>
        new RiskVO(
          r.title,
          r.description,
          r.severity as RiskSeverity,
          r.category as RiskCategory,
          r.affectedComponents || [],
        ),
    )

    const recommendations = (data.recommendations || []).map(
      (r: any) =>
        new RecommendationVO(r.title, r.description, r.priority, r.effort, r.relatedRisks || []),
    )

    return new AnalysisResult(
      data.id,
      data.analysisId,
      components,
      risks,
      recommendations,
      data.summary,
      data.rawLlmResponse,
      data.metadata,
      data.validation,
      new Date(data.createdAt),
      new Date(data.updatedAt),
    )
  }
}
