import OpenAI from 'openai'
import { ILlmService } from '@application/ports/llm.port'

export class OpenAiLlmAdapter implements ILlmService {
  private readonly client: OpenAI

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  async analyzeImage(
    imageBuffer: Buffer,
    mimeType: string,
    prompt: string,
  ): Promise<{ content: string; model: string; tokensUsed?: number }> {
    const model = process.env.OPENAI_MODEL || 'gpt-4o'
    const base64Image = imageBuffer.toString('base64')
    const dataUrl = `data:${mimeType};base64,${base64Image}`

    const response = await this.client.chat.completions.create({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: dataUrl },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    })

    const content = response.choices[0]?.message?.content || ''

    return {
      content,
      model: response.model,
      tokensUsed: response.usage?.completion_tokens,
    }
  }

  getProviderName(): string {
    return 'openai'
  }
}
