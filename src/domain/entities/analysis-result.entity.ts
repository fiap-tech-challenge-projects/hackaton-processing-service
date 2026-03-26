import { BaseEntity } from '@shared/base/base.entity'
import { ComponentVO } from '@domain/value-objects/component.vo'
import { RiskVO } from '@domain/value-objects/risk.vo'
import { RecommendationVO } from '@domain/value-objects/recommendation.vo'

export interface AnalysisMetadata {
  model: string
  promptVersion: string
  processingTimeMs: number
  confidence: number
  temperature?: number
  maxTokens?: number
}

export interface ValidationInfo {
  isValid: boolean
  checks: Array<{ name: string; passed: boolean; details?: any }>
}

export class AnalysisResult extends BaseEntity {
  constructor(
    id: string,
    public readonly analysisId: string,
    public readonly components: ComponentVO[],
    public readonly risks: RiskVO[],
    public readonly recommendations: RecommendationVO[],
    public readonly summary: string,
    public readonly rawLlmResponse: string,
    public readonly metadata: AnalysisMetadata,
    public readonly validation: ValidationInfo,
    createdAt: Date,
    updatedAt: Date,
  ) {
    super(id, createdAt, updatedAt)
  }

  static create(params: {
    id: string
    analysisId: string
    components: ComponentVO[]
    risks: RiskVO[]
    recommendations: RecommendationVO[]
    summary: string
    rawLlmResponse: string
    metadata: AnalysisMetadata
    validation: ValidationInfo
  }): AnalysisResult {
    const now = new Date()
    return new AnalysisResult(
      params.id,
      params.analysisId,
      params.components,
      params.risks,
      params.recommendations,
      params.summary,
      params.rawLlmResponse,
      params.metadata,
      params.validation,
      now,
      now,
    )
  }
}
