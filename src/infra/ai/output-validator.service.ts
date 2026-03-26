import { Injectable } from '@nestjs/common'
import { COMPONENT_TYPES } from '@shared/constants/component-types'
import { RISK_CATEGORIES, RISK_SEVERITIES } from '@shared/constants/risk-categories'
import { LlmAnalysisResponse } from '@application/ports/llm.port'

export interface ValidationCheck {
  name: string
  passed: boolean
  details?: any
}

export interface ValidationResult {
  isValid: boolean
  checks: ValidationCheck[]
  confidence: number
  parsed?: LlmAnalysisResponse
}

const PRIORITY_VALUES = ['high', 'medium', 'low']
const EFFORT_VALUES = ['low', 'medium', 'high']

@Injectable()
export class OutputValidatorService {
  validate(rawContent: string): ValidationResult {
    const checks: ValidationCheck[] = []
    let parsed: any = null

    // 1. Parse JSON (handle markdown code blocks)
    const jsonParseCheck = this.parseJson(rawContent)
    checks.push(jsonParseCheck.check)

    if (!jsonParseCheck.check.passed) {
      return { isValid: false, checks, confidence: 0 }
    }

    parsed = jsonParseCheck.data

    // 2. Check for error response from LLM
    if (parsed.error) {
      checks.push({
        name: 'error_response',
        passed: false,
        details: { error: parsed.error, message: parsed.message },
      })
      return { isValid: false, checks, confidence: 0 }
    }

    // 3. Required fields
    checks.push(this.validateRequiredFields(parsed))

    // 4. Enum values
    checks.push(this.validateEnumValues(parsed))

    // 5. Unique components
    checks.push(this.validateUniqueComponents(parsed))

    // 6. Risk references valid component names
    checks.push(this.validateRiskReferences(parsed))

    // 7. Hallucination detection
    checks.push(this.detectHallucinations(parsed))

    const isValid = checks.every((c) => c.passed)
    const confidence = this.calculateConfidence(checks)

    return { isValid, checks, confidence, parsed: isValid ? (parsed as LlmAnalysisResponse) : undefined }
  }

  private parseJson(rawContent: string): { check: ValidationCheck; data: any } {
    try {
      // Strip markdown code blocks if present
      let content = rawContent.trim()
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      }

      const data = JSON.parse(content)
      return {
        check: { name: 'json_parse', passed: true, details: {} },
        data,
      }
    } catch (err: any) {
      return {
        check: { name: 'json_parse', passed: false, details: { error: err.message } },
        data: null,
      }
    }
  }

  private validateRequiredFields(data: any): ValidationCheck {
    const required = ['components', 'risks', 'recommendations', 'summary']
    const missing = required.filter((f) => !(f in data))
    return {
      name: 'required_fields',
      passed: missing.length === 0,
      details: { missing },
    }
  }

  private validateEnumValues(data: any): ValidationCheck {
    const invalidComponents: string[] = []
    const invalidRisks: string[] = []
    const invalidRecommendations: string[] = []

    for (const comp of data.components || []) {
      if (!COMPONENT_TYPES.includes(comp.type)) {
        invalidComponents.push(`${comp.name}: invalid type "${comp.type}"`)
      }
    }

    for (const risk of data.risks || []) {
      if (!RISK_SEVERITIES.includes(risk.severity)) {
        invalidRisks.push(`${risk.title}: invalid severity "${risk.severity}"`)
      }
      if (!RISK_CATEGORIES.includes(risk.category)) {
        invalidRisks.push(`${risk.title}: invalid category "${risk.category}"`)
      }
    }

    for (const rec of data.recommendations || []) {
      if (!PRIORITY_VALUES.includes(rec.priority)) {
        invalidRecommendations.push(`${rec.title}: invalid priority "${rec.priority}"`)
      }
      if (!EFFORT_VALUES.includes(rec.effort)) {
        invalidRecommendations.push(`${rec.title}: invalid effort "${rec.effort}"`)
      }
    }

    const allInvalid = [...invalidComponents, ...invalidRisks, ...invalidRecommendations]
    return {
      name: 'enum_values',
      passed: allInvalid.length === 0,
      details: { invalid: allInvalid },
    }
  }

  private validateUniqueComponents(data: any): ValidationCheck {
    const names = (data.components || []).map((c: any) => c.name)
    const unique = new Set(names)
    const duplicates = names.filter((n: string, i: number) => names.indexOf(n) !== i)
    return {
      name: 'unique_components',
      passed: unique.size === names.length,
      details: { duplicates },
    }
  }

  private validateRiskReferences(data: any): ValidationCheck {
    const componentNames = new Set((data.components || []).map((c: any) => c.name))
    const invalidRefs: string[] = []

    for (const risk of data.risks || []) {
      for (const affected of risk.affectedComponents || []) {
        if (!componentNames.has(affected)) {
          invalidRefs.push(`Risk "${risk.title}" references unknown component "${affected}"`)
        }
      }
    }

    return {
      name: 'risk_references',
      passed: invalidRefs.length === 0,
      details: { invalidRefs },
    }
  }

  private detectHallucinations(data: any): ValidationCheck {
    const componentCount = (data.components || []).length
    const hasGenericDescriptions = this.checkGenericDescriptions(data)

    // Heuristic: >50 components is suspicious
    const tooManyComponents = componentCount > 50

    return {
      name: 'hallucination_check',
      passed: !tooManyComponents && !hasGenericDescriptions,
      details: { componentCount, hasGenericDescriptions, tooManyComponents },
    }
  }

  private checkGenericDescriptions(data: any): boolean {
    const genericPhrases = [
      'this component',
      'the service',
      'handles requests',
      'manages data',
      'processes information',
    ]

    const descriptions = [
      ...(data.components || []).map((c: any) => c.description?.toLowerCase() || ''),
      ...(data.risks || []).map((r: any) => r.description?.toLowerCase() || ''),
    ]

    const genericCount = descriptions.filter((d) =>
      genericPhrases.every((phrase) => d.includes(phrase)),
    ).length

    // If more than half the descriptions are generic, flag it
    return descriptions.length > 0 && genericCount / descriptions.length > 0.5
  }

  private calculateConfidence(checks: ValidationCheck[]): number {
    if (checks.length === 0) return 0
    const passed = checks.filter((c) => c.passed).length
    return passed / checks.length
  }
}
