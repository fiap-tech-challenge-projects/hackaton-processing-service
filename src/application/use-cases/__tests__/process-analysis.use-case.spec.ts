import { ProcessAnalysisUseCase } from '../process-analysis.use-case'
import { ILlmService } from '@application/ports/llm.port'
import { IStorageService } from '@application/ports/storage.port'
import { IEventPublisher } from '@application/ports/event-publisher.port'
import { IAnalysisResultRepository } from '@domain/repositories/analysis-result.repository'
import { PreProcessorService } from '@infra/ai/pre-processor.service'
import { PromptService } from '@infra/ai/prompt.service'
import { OutputValidatorService } from '@infra/ai/output-validator.service'
import { PostProcessorService } from '@infra/ai/post-processor.service'
import { AnalysisRequestedEventPayload } from '@application/dtos/analysis-result.dto'
import { ComponentVO } from '@domain/value-objects/component.vo'
import { RiskVO } from '@domain/value-objects/risk.vo'
import { RecommendationVO } from '@domain/value-objects/recommendation.vo'

const makeMocks = () => {
  const llmService: jest.Mocked<ILlmService> = {
    analyzeImage: jest.fn(),
    getProviderName: jest.fn().mockReturnValue('mock-llm'),
  }

  const storageService: jest.Mocked<IStorageService> = {
    download: jest.fn(),
  }

  const eventPublisher: jest.Mocked<IEventPublisher> = {
    publishAnalysisProcessed: jest.fn().mockResolvedValue(undefined),
    publishAnalysisFailed: jest.fn().mockResolvedValue(undefined),
  }

  const analysisResultRepository: jest.Mocked<IAnalysisResultRepository> = {
    save: jest.fn().mockResolvedValue(undefined),
    findByAnalysisId: jest.fn().mockResolvedValue(null),
  }

  const preProcessorService = {
    process: jest.fn(),
  } as unknown as jest.Mocked<PreProcessorService>

  const promptService = {
    getPrompt: jest.fn().mockReturnValue('analyze this architecture'),
    getLatestVersion: jest.fn().mockReturnValue('v1'),
  } as unknown as jest.Mocked<PromptService>

  const outputValidatorService = {
    validate: jest.fn(),
  } as unknown as jest.Mocked<OutputValidatorService>

  const postProcessorService = {
    process: jest.fn(),
  } as unknown as jest.Mocked<PostProcessorService>

  return {
    llmService,
    storageService,
    eventPublisher,
    analysisResultRepository,
    preProcessorService,
    promptService,
    outputValidatorService,
    postProcessorService,
  }
}

const makeValidAnalysisPayload = (): AnalysisRequestedEventPayload => ({
  analysisId: 'analysis-123',
  fileName: 'architecture.png',
  fileUrl: 'uploads/architecture.png',
  fileType: 'image/png',
  fileSize: 102400,
  correlationId: 'corr-456',
})

const makeValidPostProcessed = () => ({
  components: [
    new ComponentVO('API Gateway', 'gateway', 'Entry point', ['Service A']),
  ],
  risks: [
    new RiskVO('SPOF Risk', 'Single point of failure', 'high', 'reliability', ['API Gateway']),
  ],
  recommendations: [
    new RecommendationVO('Add Load Balancer', 'Distribute load', 'high', 'medium', ['SPOF Risk']),
  ],
  summary: 'Simple microservices architecture.',
  confidence: 0.9,
})

describe('ProcessAnalysisUseCase', () => {
  let useCase: ProcessAnalysisUseCase
  let mocks: ReturnType<typeof makeMocks>

  beforeEach(() => {
    mocks = makeMocks()
    useCase = new ProcessAnalysisUseCase(
      mocks.llmService,
      mocks.storageService,
      mocks.analysisResultRepository,
      mocks.eventPublisher,
      mocks.preProcessorService,
      mocks.promptService,
      mocks.outputValidatorService,
      mocks.postProcessorService,
    )
  })

  describe('execute - happy path', () => {
    beforeEach(() => {
      const imageBuffer = Buffer.from('fake-image-data')
      mocks.storageService.download.mockResolvedValue(imageBuffer)

      mocks.preProcessorService.process.mockResolvedValue({
        buffer: imageBuffer,
        mimeType: 'image/png',
        dimensions: { width: 800, height: 600 },
      })

      mocks.llmService.analyzeImage.mockResolvedValue({
        content: '{"components":[],"risks":[],"recommendations":[],"summary":"test"}',
        model: 'claude-sonnet-4',
        tokensUsed: 1234,
      })

      mocks.outputValidatorService.validate.mockReturnValue({
        isValid: true,
        checks: [{ name: 'json_parse', passed: true }],
        confidence: 1,
        parsed: {
          components: [],
          risks: [],
          recommendations: [],
          summary: 'test',
        },
      })

      mocks.postProcessorService.process.mockReturnValue(makeValidPostProcessed())
    })

    it('should download the file from storage', async () => {
      await useCase.execute(makeValidAnalysisPayload())

      expect(mocks.storageService.download).toHaveBeenCalledWith('uploads/architecture.png')
    })

    it('should pre-process the downloaded file', async () => {
      const payload = makeValidAnalysisPayload()
      await useCase.execute(payload)

      expect(mocks.preProcessorService.process).toHaveBeenCalledWith(
        expect.any(Buffer),
        'image/png',
      )
    })

    it('should call LLM with the processed image and prompt', async () => {
      await useCase.execute(makeValidAnalysisPayload())

      expect(mocks.llmService.analyzeImage).toHaveBeenCalledWith(
        expect.any(Buffer),
        'image/png',
        'analyze this architecture',
      )
    })

    it('should persist the analysis result', async () => {
      await useCase.execute(makeValidAnalysisPayload())

      expect(mocks.analysisResultRepository.save).toHaveBeenCalledTimes(1)

      const savedResult = mocks.analysisResultRepository.save.mock.calls[0][0]
      expect(savedResult.analysisId).toBe('analysis-123')
    })

    it('should publish analysis.processed event on success', async () => {
      await useCase.execute(makeValidAnalysisPayload())

      expect(mocks.eventPublisher.publishAnalysisProcessed).toHaveBeenCalledTimes(1)
      expect(mocks.eventPublisher.publishAnalysisFailed).not.toHaveBeenCalled()

      const publishedPayload = mocks.eventPublisher.publishAnalysisProcessed.mock.calls[0][0]
      expect(publishedPayload.analysisId).toBe('analysis-123')
      expect(publishedPayload.model).toBe('claude-sonnet-4')
      expect(publishedPayload.processingTimeMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('execute - storage failure', () => {
    it('should publish analysis.failed when storage download fails', async () => {
      mocks.storageService.download.mockRejectedValue(new Error('S3 connection timeout'))

      await useCase.execute(makeValidAnalysisPayload())

      expect(mocks.eventPublisher.publishAnalysisFailed).toHaveBeenCalledTimes(1)
      expect(mocks.eventPublisher.publishAnalysisProcessed).not.toHaveBeenCalled()
      expect(mocks.analysisResultRepository.save).not.toHaveBeenCalled()

      const failedPayload = mocks.eventPublisher.publishAnalysisFailed.mock.calls[0][0]
      expect(failedPayload.analysisId).toBe('analysis-123')
      expect(failedPayload.message).toContain('S3 connection timeout')
    })
  })

  describe('execute - LLM validation failure with retry', () => {
    it('should retry LLM call up to 3 times when validation fails', async () => {
      const imageBuffer = Buffer.from('fake-image-data')
      mocks.storageService.download.mockResolvedValue(imageBuffer)
      mocks.preProcessorService.process.mockResolvedValue({
        buffer: imageBuffer,
        mimeType: 'image/png',
        dimensions: { width: 800, height: 600 },
      })

      mocks.llmService.analyzeImage.mockResolvedValue({
        content: 'invalid json',
        model: 'claude-sonnet-4',
      })

      mocks.outputValidatorService.validate.mockReturnValue({
        isValid: false,
        checks: [{ name: 'json_parse', passed: false, details: { error: 'Unexpected token' } }],
        confidence: 0,
      })

      await useCase.execute(makeValidAnalysisPayload())

      // Should have been called exactly 3 times (MAX_RETRIES)
      expect(mocks.llmService.analyzeImage).toHaveBeenCalledTimes(3)
    })

    it('should publish analysis.failed after all retries are exhausted', async () => {
      const imageBuffer = Buffer.from('fake-image-data')
      mocks.storageService.download.mockResolvedValue(imageBuffer)
      mocks.preProcessorService.process.mockResolvedValue({
        buffer: imageBuffer,
        mimeType: 'image/png',
        dimensions: { width: 800, height: 600 },
      })

      mocks.llmService.analyzeImage.mockResolvedValue({
        content: 'not valid json',
        model: 'claude-sonnet-4',
      })

      mocks.outputValidatorService.validate.mockReturnValue({
        isValid: false,
        checks: [{ name: 'json_parse', passed: false }],
        confidence: 0,
      })

      await useCase.execute(makeValidAnalysisPayload())

      expect(mocks.eventPublisher.publishAnalysisFailed).toHaveBeenCalledTimes(1)
      expect(mocks.eventPublisher.publishAnalysisProcessed).not.toHaveBeenCalled()
      expect(mocks.analysisResultRepository.save).not.toHaveBeenCalled()
    })

    it('should succeed on the second attempt if first LLM call fails validation', async () => {
      const imageBuffer = Buffer.from('fake-image-data')
      mocks.storageService.download.mockResolvedValue(imageBuffer)
      mocks.preProcessorService.process.mockResolvedValue({
        buffer: imageBuffer,
        mimeType: 'image/png',
        dimensions: { width: 800, height: 600 },
      })

      mocks.llmService.analyzeImage.mockResolvedValue({
        content: '{"components":[],"risks":[],"recommendations":[],"summary":"ok"}',
        model: 'claude-sonnet-4',
      })

      const parsedResponse = {
        components: [],
        risks: [],
        recommendations: [],
        summary: 'ok',
      }

      // First call: invalid; second call: valid
      mocks.outputValidatorService.validate
        .mockReturnValueOnce({
          isValid: false,
          checks: [{ name: 'json_parse', passed: false }],
          confidence: 0,
        })
        .mockReturnValueOnce({
          isValid: true,
          checks: [{ name: 'json_parse', passed: true }],
          confidence: 1,
          parsed: parsedResponse,
        })

      mocks.postProcessorService.process.mockReturnValue(makeValidPostProcessed())

      await useCase.execute(makeValidAnalysisPayload())

      expect(mocks.llmService.analyzeImage).toHaveBeenCalledTimes(2)
      expect(mocks.analysisResultRepository.save).toHaveBeenCalledTimes(1)
      expect(mocks.eventPublisher.publishAnalysisProcessed).toHaveBeenCalledTimes(1)
    })
  })

  describe('execute - persistence failure', () => {
    it('should publish analysis.failed when DynamoDB save fails', async () => {
      const imageBuffer = Buffer.from('fake-image-data')
      mocks.storageService.download.mockResolvedValue(imageBuffer)
      mocks.preProcessorService.process.mockResolvedValue({
        buffer: imageBuffer,
        mimeType: 'image/png',
        dimensions: { width: 800, height: 600 },
      })

      mocks.llmService.analyzeImage.mockResolvedValue({
        content: '{}',
        model: 'claude-sonnet-4',
      })

      mocks.outputValidatorService.validate.mockReturnValue({
        isValid: true,
        checks: [{ name: 'json_parse', passed: true }],
        confidence: 1,
        parsed: { components: [], risks: [], recommendations: [], summary: 'ok' },
      })

      mocks.postProcessorService.process.mockReturnValue(makeValidPostProcessed())

      mocks.analysisResultRepository.save.mockRejectedValue(
        new Error('DynamoDB throughput exceeded'),
      )

      await useCase.execute(makeValidAnalysisPayload())

      expect(mocks.eventPublisher.publishAnalysisFailed).toHaveBeenCalledTimes(1)
      expect(mocks.eventPublisher.publishAnalysisProcessed).not.toHaveBeenCalled()
    })
  })

  describe('execute - pre-processing failure', () => {
    it('should publish analysis.failed when pre-processing fails', async () => {
      const imageBuffer = Buffer.from('tiny')
      mocks.storageService.download.mockResolvedValue(imageBuffer)
      mocks.preProcessorService.process.mockRejectedValue(
        new Error('Image too small: 50x50. Minimum is 200x200.'),
      )

      await useCase.execute(makeValidAnalysisPayload())

      expect(mocks.eventPublisher.publishAnalysisFailed).toHaveBeenCalledTimes(1)
      expect(mocks.llmService.analyzeImage).not.toHaveBeenCalled()
    })
  })
})
