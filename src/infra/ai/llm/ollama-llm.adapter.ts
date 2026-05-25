import { ILlmService } from '@application/ports/llm.port'
import { COMPONENT_TYPES } from '@shared/constants/component-types'
import { RISK_CATEGORIES, RISK_SEVERITIES } from '@shared/constants/risk-categories'

interface OllamaMessage {
  role: string
  content: string
  images?: string[]
}

interface OllamaChatResponse {
  model: string
  message: {
    role: string
    content: string
  }
}

// Local models (llava) emit free-form text or out-of-vocabulary enum values,
// which fail OutputValidatorService and trigger the "schema validation after 3
// retries" failure. Passing this JSON Schema as Ollama's `format` constrains
// generation to the exact shape and allowed enums the validator expects.
const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    components: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: [...COMPONENT_TYPES] },
          description: { type: 'string' },
          connections: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'type', 'description', 'connections'],
      },
    },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          severity: { type: 'string', enum: [...RISK_SEVERITIES] },
          category: { type: 'string', enum: [...RISK_CATEGORIES] },
          affectedComponents: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'description', 'severity', 'category', 'affectedComponents'],
      },
    },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          effort: { type: 'string', enum: ['low', 'medium', 'high'] },
          relatedRisks: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'description', 'priority', 'effort', 'relatedRisks'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['components', 'risks', 'recommendations', 'summary'],
}

export class OllamaLlmAdapter implements ILlmService {
  private readonly baseUrl: string
  private readonly model: string

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    this.model = process.env.OLLAMA_MODEL || 'llava'
  }

  async analyzeImage(
    imageBuffer: Buffer,
    _mimeType: string,
    prompt: string,
  ): Promise<{ content: string; model: string; tokensUsed?: number }> {
    const base64Image = imageBuffer.toString('base64')

    const body = {
      model: this.model,
      messages: [
        {
          role: 'user',
          content: prompt,
          images: [base64Image],
        } as OllamaMessage,
      ],
      stream: false,
      format: ANALYSIS_SCHEMA,
      // Non-zero temperature is deliberate: the schema already guarantees a valid
      // shape + enums, but OutputValidatorService also applies heuristic checks
      // (e.g. hallucination_check on generic descriptions). With temperature 0 the
      // model is deterministic, so a response that trips a heuristic fails all 3
      // retries identically. Some variance lets the retry loop recover.
      options: { temperature: 0.7 },
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as OllamaChatResponse

    return {
      content: data.message?.content || '',
      model: data.model || this.model,
    }
  }

  getProviderName(): string {
    return 'ollama'
  }
}
