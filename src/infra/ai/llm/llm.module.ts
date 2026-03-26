import { Module } from '@nestjs/common'
import { ClaudeLlmAdapter } from './claude-llm.adapter'
import { OpenAiLlmAdapter } from './openai-llm.adapter'
import { OllamaLlmAdapter } from './ollama-llm.adapter'
import { LLM_SERVICE } from '@application/ports/llm.port'

@Module({
  providers: [
    {
      provide: LLM_SERVICE,
      useFactory: () => {
        const provider = process.env.LLM_PROVIDER || 'ollama'
        switch (provider) {
          case 'claude':
            return new ClaudeLlmAdapter()
          case 'openai':
            return new OpenAiLlmAdapter()
          case 'ollama':
          default:
            return new OllamaLlmAdapter()
        }
      },
    },
  ],
  exports: [LLM_SERVICE],
})
export class LlmModule {}
