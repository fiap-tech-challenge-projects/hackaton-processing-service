import Anthropic from '@anthropic-ai/sdk'
import { ILlmService } from '@application/ports/llm.port'

export class ClaudeLlmAdapter implements ILlmService {
  private readonly client: Anthropic

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }

  async analyzeImage(
    imageBuffer: Buffer,
    mimeType: string,
    prompt: string,
  ): Promise<{ content: string; model: string; tokensUsed?: number }> {
    const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514'

    const response = await this.client.messages.create({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as any,
                data: imageBuffer.toString('base64'),
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    })

    const textBlock = response.content.find((c) => c.type === 'text')
    const content = textBlock && textBlock.type === 'text' ? textBlock.text : ''

    return {
      content,
      model: response.model,
      tokensUsed: response.usage?.output_tokens,
    }
  }

  getProviderName(): string {
    return 'claude'
  }
}
