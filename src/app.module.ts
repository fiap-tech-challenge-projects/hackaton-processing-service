import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DatabaseModule } from '@infra/database/database.module'
import { MessagingModule } from '@infra/messaging/messaging.module'
import { StorageModule } from '@infra/storage/storage.module'
import { LlmModule } from '@infra/ai/llm/llm.module'
import { HealthController } from '@interfaces/rest/controllers/health.controller'
import { ProcessAnalysisUseCase } from '@application/use-cases/process-analysis.use-case'
import { PreProcessorService } from '@infra/ai/pre-processor.service'
import { PromptService } from '@infra/ai/prompt.service'
import { OutputValidatorService } from '@infra/ai/output-validator.service'
import { PostProcessorService } from '@infra/ai/post-processor.service'
import { ANALYSIS_RESULT_REPOSITORY } from '@domain/repositories/analysis-result.repository'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    MessagingModule,
    StorageModule,
    LlmModule,
  ],
  controllers: [HealthController],
  providers: [
    PreProcessorService,
    PromptService,
    OutputValidatorService,
    PostProcessorService,
    {
      provide: ProcessAnalysisUseCase,
      useFactory: (
        llmService: any,
        storageService: any,
        analysisResultRepository: any,
        eventPublisher: any,
        preProcessor: PreProcessorService,
        promptService: PromptService,
        outputValidator: OutputValidatorService,
        postProcessor: PostProcessorService,
      ) =>
        new ProcessAnalysisUseCase(
          llmService,
          storageService,
          analysisResultRepository,
          eventPublisher,
          preProcessor,
          promptService,
          outputValidator,
          postProcessor,
        ),
      inject: [
        'LLM_SERVICE',
        'IStorageService',
        ANALYSIS_RESULT_REPOSITORY,
        'IEventPublisher',
        PreProcessorService,
        PromptService,
        OutputValidatorService,
        PostProcessorService,
      ],
    },
  ],
  exports: [ProcessAnalysisUseCase],
})
export class AppModule {}
