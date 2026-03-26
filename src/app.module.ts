import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DatabaseModule } from '@infra/database/database.module'
import { StorageModule } from '@infra/storage/storage.module'
import { LlmModule } from '@infra/ai/llm/llm.module'
import { RabbitMqPublisherService } from '@infra/messaging/rabbitmq-publisher.service'
import { RabbitMqConsumerService } from '@infra/messaging/rabbitmq-consumer.service'
import { HealthController } from '@interfaces/rest/controllers/health.controller'
import { ProcessAnalysisUseCase } from '@application/use-cases/process-analysis.use-case'
import { PreProcessorService } from '@infra/ai/pre-processor.service'
import { PromptService } from '@infra/ai/prompt.service'
import { OutputValidatorService } from '@infra/ai/output-validator.service'
import { PostProcessorService } from '@infra/ai/post-processor.service'
import { ANALYSIS_RESULT_REPOSITORY } from '@domain/repositories/analysis-result.repository'
import { EVENT_PUBLISHER } from '@application/ports/event-publisher.port'
import { STORAGE_SERVICE } from '@application/ports/storage.port'
import { LLM_SERVICE } from '@application/ports/llm.port'
import { appConfig } from '@config/app.config'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
    DatabaseModule,
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
      provide: EVENT_PUBLISHER,
      useClass: RabbitMqPublisherService,
    },
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
        LLM_SERVICE,
        STORAGE_SERVICE,
        ANALYSIS_RESULT_REPOSITORY,
        EVENT_PUBLISHER,
        PreProcessorService,
        PromptService,
        OutputValidatorService,
        PostProcessorService,
      ],
    },
    RabbitMqConsumerService,
  ],
  exports: [ProcessAnalysisUseCase],
})
export class AppModule {}
