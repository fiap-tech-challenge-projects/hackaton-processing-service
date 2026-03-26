import { Injectable } from '@nestjs/common'
import { LlmAnalysisResponse } from '@application/ports/llm.port'
import { ComponentVO } from '@domain/value-objects/component.vo'
import { RiskVO } from '@domain/value-objects/risk.vo'
import { RecommendationVO } from '@domain/value-objects/recommendation.vo'
import { ComponentType } from '@shared/constants/component-types'
import { RiskSeverity, RiskCategory } from '@shared/constants/risk-categories'
import { ValidationResult } from './output-validator.service'

export interface PostProcessedResult {
  components: ComponentVO[]
  risks: RiskVO[]
  recommendations: RecommendationVO[]
  summary: string
  confidence: number
}

@Injectable()
export class PostProcessorService {
  process(llmResponse: LlmAnalysisResponse, validationResult: ValidationResult): PostProcessedResult {
    const components = this.buildComponents(llmResponse.components)
    const risks = this.classifyRisks(llmResponse.risks, components)
    const recommendations = this.buildRecommendations(llmResponse.recommendations)

    return {
      components,
      risks,
      recommendations,
      summary: llmResponse.summary,
      confidence: validationResult.confidence,
    }
  }

  private buildComponents(
    raw: LlmAnalysisResponse['components'],
  ): ComponentVO[] {
    return raw.map(
      (c) =>
        new ComponentVO(
          c.name,
          c.type as ComponentType,
          c.description,
          c.connections,
        ),
    )
  }

  private classifyRisks(
    raw: LlmAnalysisResponse['risks'],
    components: ComponentVO[],
  ): RiskVO[] {
    return raw.map((risk) => {
      const severity = this.applyBusinessRules(risk, components)
      return new RiskVO(
        risk.title,
        risk.description,
        severity,
        risk.category as RiskCategory,
        risk.affectedComponents,
      )
    })
  }

  private applyBusinessRules(
    risk: LlmAnalysisResponse['risks'][0],
    components: ComponentVO[],
  ): RiskSeverity {
    const titleLower = risk.title.toLowerCase()
    const descLower = risk.description.toLowerCase()

    // Business rule: Single point of failure without redundancy -> critical
    if (
      (titleLower.includes('single point of failure') || titleLower.includes('spof')) &&
      (descLower.includes('no redundancy') || descLower.includes('without redundancy'))
    ) {
      return 'critical'
    }

    // Business rule: No authentication between services -> high (at minimum)
    if (
      (titleLower.includes('no authentication') || titleLower.includes('missing authentication')) &&
      risk.severity === 'medium'
    ) {
      return 'high'
    }

    // Business rule: If >3 critical components affected, escalate severity
    const criticalComponentTypes: ComponentVO['type'][] = ['gateway', 'database', 'load_balancer']
    const affectedCritical = risk.affectedComponents.filter((name) => {
      const comp = components.find((c) => c.name === name)
      return comp && criticalComponentTypes.includes(comp.type)
    })

    if (affectedCritical.length >= 3 && risk.severity === 'high') {
      return 'critical'
    }

    return risk.severity as RiskSeverity
  }

  private buildRecommendations(
    raw: LlmAnalysisResponse['recommendations'],
  ): RecommendationVO[] {
    return raw.map(
      (r) =>
        new RecommendationVO(
          r.title,
          r.description,
          r.priority,
          r.effort,
          r.relatedRisks,
        ),
    )
  }
}
