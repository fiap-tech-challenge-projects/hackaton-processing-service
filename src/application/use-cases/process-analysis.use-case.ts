import { Injectable, Logger } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { ILlmService, LLM_SERVICE } from '@application/ports/llm.port'
import { IStorageService } from '@application/ports/storage.port'
import { IEventPublisher } from '@application/ports/event-publisher.port'
import {
  IAnalysisResultRepository,
  ANALYSIS_RESULT_REPOSITORY,
} from '@domain/repositories/analysis-result.repository'
import { AnalysisResult } from '@domain/entities/analysis-result.entity'
import { PreProcessorService } from '@infra/ai/pre-processor.service'
import { PromptService } from '@infra/ai/prompt.service'
import { OutputValidatorService } from '@infra/ai/output-validator.service'
import { PostProcessorService } from '@infra/ai/post-processor.service'
import { AnalysisRequestedEventPayload } from '@application/dtos/analysis-result.dto'

const MAX_RETRIES = 3

@Injectable()
export class ProcessAnalysisUseCase {
  private readonly logger = new Logger(ProcessAnalysisUseCase.name)

  constructor(
    private readonly llmService: ILlmService,
    private readonly storageService: IStorageService,
    private readonly analysisResultRepository: IAnalysisResultRepository,
    private readonly eventPublisher: IEventPublisher,
    private readonly preProcessor: PreProcessorService,
    private readonly promptService: PromptService,
    private readonly outputValidator: OutputValidatorService,
    private readonly postProcessor: PostProcessorService,
  ) {}

  async execute(payload: AnalysisRequestedEventPayload): Promise<void> {
    const startTime = Date.now()
    const { analysisId, fileUrl, fileType } = payload

    this.logger.log(`Starting analysis for ${analysisId}`)

    let fileBuffer: Buffer
    try {
      fileBuffer = await this.storageService.download(fileUrl)
    } catch (err: any) {
      await this.publishFailure(analysisId, 'STORAGE_DOWNLOAD_ERROR', err.message, 0)
      return
    }

    let processedImage: Awaited<ReturnType<PreProcessorService['process']>>
    try {
      processedImage = await this.preProcessor.process(fileBuffer, fileType)
    } catch (err: any) {
      await this.publishFailure(analysisId, err.code || 'PRE_PROCESS_ERROR', err.message, 0)
      return
    }

    const promptVersion = this.promptService.getLatestVersion()
    const prompt = this.promptService.getPrompt(promptVersion)

    let llmResponse: { content: string; model: string; tokensUsed?: number } | null = null
    let validationResult: ReturnType<OutputValidatorService['validate']> | null = null
    let retryCount = 0

    while (retryCount < MAX_RETRIES) {
      try {
        this.logger.log(`Calling LLM (attempt ${retryCount + 1})`)
        llmResponse = await this.llmService.analyzeImage(
          processedImage.buffer,
          processedImage.mimeType,
          prompt,
        )

        validationResult = this.outputValidator.validate(llmResponse.content)

        if (validationResult.isValid) {
          break
        }

        this.logger.warn(
          `LLM response invalid on attempt ${retryCount + 1}: ${validationResult.checks
            .filter((c) => !c.passed)
            .map((c) => c.name)
            .join(', ')}`,
        )
        retryCount++

        if (retryCount < MAX_RETRIES) {
          await this.delay(1000 * Math.pow(2, retryCount - 1))
        }
      } catch (err: any) {
        this.logger.error(`LLM call failed on attempt ${retryCount + 1}: ${err.message}`)
        retryCount++

        if (retryCount < MAX_RETRIES) {
          await this.delay(1000 * Math.pow(2, retryCount - 1))
        }
      }
    }

    if (
      !llmResponse ||
      !validationResult ||
      !validationResult.isValid ||
      !validationResult.parsed
    ) {
      await this.publishFailure(
        analysisId,
        'LLM_RESPONSE_INVALID',
        `LLM response failed schema validation after ${retryCount} retries`,
        retryCount,
      )
      return
    }

    const postProcessed = this.postProcessor.process(validationResult.parsed, validationResult)

    const processingTimeMs = Date.now() - startTime
    const resultId = uuidv4()

    const analysisResult = AnalysisResult.create({
      id: resultId,
      analysisId,
      components: postProcessed.components,
      risks: postProcessed.risks,
      recommendations: postProcessed.recommendations,
      summary: postProcessed.summary,
      rawLlmResponse: llmResponse.content,
      metadata: {
        model: llmResponse.model,
        promptVersion,
        processingTimeMs,
        confidence: postProcessed.confidence,
        temperature: 0,
        maxTokens: 4096,
      },
      validation: {
        isValid: validationResult.isValid,
        checks: validationResult.checks,
      },
    })

    try {
      await this.analysisResultRepository.save(analysisResult)
      this.logger.log(`Result saved to DynamoDB: ${resultId}`)
    } catch (err: any) {
      this.logger.error(`Failed to save result: ${err.message}`)
      await this.publishFailure(analysisId, 'PERSISTENCE_ERROR', err.message, retryCount)
      return
    }

    await this.eventPublisher.publishAnalysisProcessed({
      analysisId,
      resultId,
      components: postProcessed.components.map((c) => c.toJSON()),
      risks: postProcessed.risks.map((r) => r.toJSON()),
      recommendations: postProcessed.recommendations.map((r) => r.toJSON()),
      summary: postProcessed.summary,
      model: llmResponse.model,
      promptVersion,
      confidence: postProcessed.confidence,
      processingTimeMs,
    })

    this.logger.log(`Analysis complete for ${analysisId} in ${processingTimeMs}ms`)
  }

  private async publishFailure(
    analysisId: string,
    error: string,
    message: string,
    retryCount: number,
  ): Promise<void> {
    try {
      await this.eventPublisher.publishAnalysisFailed({ analysisId, error, message, retryCount })
    } catch (err: any) {
      this.logger.error(`Failed to publish failure event: ${err.message}`)
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
