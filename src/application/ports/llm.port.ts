export interface LlmAnalysisResponse {
  components: Array<{
    name: string
    type: string
    description: string
    connections: string[]
  }>
  risks: Array<{
    title: string
    description: string
    severity: 'critical' | 'high' | 'medium' | 'low'
    category: string
    affectedComponents: string[]
  }>
  recommendations: Array<{
    title: string
    description: string
    priority: 'high' | 'medium' | 'low'
    effort: 'low' | 'medium' | 'high'
    relatedRisks: string[]
  }>
  summary: string
}

export interface ILlmService {
  analyzeImage(
    imageBuffer: Buffer,
    mimeType: string,
    prompt: string,
  ): Promise<{
    content: string
    model: string
    tokensUsed?: number
  }>
  getProviderName(): string
}

export const LLM_SERVICE = Symbol('LLM_SERVICE')
