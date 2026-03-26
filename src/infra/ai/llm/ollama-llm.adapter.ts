import { ILlmService } from '@application/ports/llm.port'

interface OllamaMessage {
  role: string
  content: string
  images?: string[]
}

interface OllamaChatResponse {
  model: string
  message: {
    role: string
    content: string
  }
}

export class OllamaLlmAdapter implements ILlmService {
  private readonly baseUrl: string
  private readonly model: string

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    this.model = process.env.OLLAMA_MODEL || 'llava'
  }

  async analyzeImage(
    imageBuffer: Buffer,
    _mimeType: string,
    prompt: string,
  ): Promise<{ content: string; model: string; tokensUsed?: number }> {
    const base64Image = imageBuffer.toString('base64')

    const body = {
      model: this.model,
      messages: [
        {
          role: 'user',
          content: prompt,
          images: [base64Image],
        } as OllamaMessage,
      ],
      stream: false,
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as OllamaChatResponse

    return {
      content: data.message?.content || '',
      model: data.model || this.model,
    }
  }

  getProviderName(): string {
    return 'ollama'
  }
}
