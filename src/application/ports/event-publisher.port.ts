import { LlmAnalysisResponse } from './llm.port'

export interface AnalysisProcessedPayload {
  analysisId: string
  resultId: string
  components: LlmAnalysisResponse['components']
  risks: LlmAnalysisResponse['risks']
  recommendations: LlmAnalysisResponse['recommendations']
  summary: string
  model: string
  promptVersion: string
  confidence: number
  processingTimeMs: number
}

export interface AnalysisFailedPayload {
  analysisId: string
  error: string
  message: string
  retryCount: number
}

export interface IEventPublisher {
  publishAnalysisProcessed(payload: AnalysisProcessedPayload): Promise<void>
  publishAnalysisFailed(payload: AnalysisFailedPayload): Promise<void>
}

export const EVENT_PUBLISHER = Symbol('IEventPublisher')
