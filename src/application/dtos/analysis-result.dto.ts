export interface AnalysisRequestedEventPayload {
  analysisId: string
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: number
  correlationId?: string
}
