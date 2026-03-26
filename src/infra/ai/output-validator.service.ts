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

    // 2. Check for error response from LLM (NOT_ARCHITECTURE_DIAGRAM, LOW_QUALITY_IMAGE)
    if (parsed.error && !parsed.components) {
      // If the LLM says it's not a diagram, create a minimal valid response
      const errorResult: LlmAnalysisResponse = {
        components: [],
        risks: [{ title: parsed.error, description: parsed.message || 'LLM could not analyze the image', severity: 'low' as any, category: 'maintainability', affectedComponents: [] }],
        recommendations: [],
        summary: parsed.message || `LLM returned error: ${parsed.error}`,
      }
      return { isValid: true, checks: [{ name: 'error_response', passed: true, details: { llmError: parsed.error } }], confidence: 0.1, parsed: errorResult }
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

    return {
      isValid,
      checks,
      confidence,
      parsed: isValid ? (parsed as LlmAnalysisResponse) : undefined,
    }
  }

  private parseJson(rawContent: string): { check: ValidationCheck; data: any } {
    // Strategy 1: Direct parse
    try {
      const data = JSON.parse(rawContent.trim())
      return { check: { name: 'json_parse', passed: true, details: { strategy: 'direct' } }, data }
    } catch {}

    // Strategy 2: Strip markdown code blocks
    try {
      const codeBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (codeBlockMatch) {
        const data = JSON.parse(codeBlockMatch[1].trim())
        return { check: { name: 'json_parse', passed: true, details: { strategy: 'code_block' } }, data }
      }
    } catch {}

    // Strategy 3: Find first { to last } (extract JSON from surrounding text)
    try {
      const firstBrace = rawContent.indexOf('{')
      const lastBrace = rawContent.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const jsonStr = rawContent.substring(firstBrace, lastBrace + 1)
        const data = JSON.parse(jsonStr)
        return { check: { name: 'json_parse', passed: true, details: { strategy: 'extract_braces' } }, data }
      }
    } catch {}

    // Strategy 4: Build minimal valid response from text analysis
    try {
      const components = this.extractComponentsFromText(rawContent)
      if (components.length > 0) {
        const data = {
          components,
          risks: [{ title: 'Analysis from unstructured LLM response', description: 'LLM did not return structured JSON. Components were extracted from text.', severity: 'low', category: 'maintainability', affectedComponents: [] }],
          recommendations: [{ title: 'Use structured LLM provider', description: 'Consider using a more capable model that can output structured JSON.', priority: 'medium', effort: 'low', relatedRisks: [] }],
          summary: rawContent.substring(0, 500),
        }
        return { check: { name: 'json_parse', passed: true, details: { strategy: 'text_extraction', warning: 'Extracted from unstructured text' } }, data }
      }
    } catch {}

    return {
      check: { name: 'json_parse', passed: false, details: { error: 'Could not extract valid JSON from LLM response', responsePreview: rawContent.substring(0, 200) } },
      data: null,
    }
  }

  private extractComponentsFromText(text: string): any[] {
    // Simple heuristic: look for common architecture component keywords
    const componentKeywords = [
      'api gateway', 'load balancer', 'database', 'cache', 'queue', 'message broker',
      'service', 'server', 'client', 'frontend', 'backend', 'microservice',
      'redis', 'postgresql', 'mongodb', 'rabbitmq', 'kafka', 'nginx', 'docker',
      'kubernetes', 's3', 'cdn', 'dns', 'firewall', 'proxy',
    ]
    const found: any[] = []
    const lowerText = text.toLowerCase()
    for (const keyword of componentKeywords) {
      if (lowerText.includes(keyword) && !found.some(c => c.name.toLowerCase() === keyword)) {
        found.push({
          name: keyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          type: keyword.includes('database') || keyword.includes('sql') || keyword.includes('mongo') || keyword.includes('redis') ? 'database' :
                keyword.includes('queue') || keyword.includes('broker') || keyword.includes('rabbit') || keyword.includes('kafka') ? 'queue' :
                keyword.includes('gateway') || keyword.includes('proxy') || keyword.includes('nginx') ? 'gateway' :
                keyword.includes('cache') || keyword.includes('cdn') ? 'cache' :
                keyword.includes('s3') || keyword.includes('storage') ? 'storage' : 'service',
          description: `Identified from text analysis: ${keyword}`,
          connections: [],
        })
      }
    }
    return found
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
      genericPhrases.some((phrase) => d.includes(phrase)),
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
