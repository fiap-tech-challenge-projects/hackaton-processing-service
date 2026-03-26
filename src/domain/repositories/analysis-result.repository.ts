import { AnalysisResult } from '@domain/entities/analysis-result.entity'

export interface IAnalysisResultRepository {
  save(result: AnalysisResult): Promise<void>
  findByAnalysisId(analysisId: string): Promise<AnalysisResult | null>
}

export const ANALYSIS_RESULT_REPOSITORY = Symbol('IAnalysisResultRepository')
