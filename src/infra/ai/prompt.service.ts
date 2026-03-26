import { Injectable } from '@nestjs/common'

const PROMPT_V1 = `You are an expert software architect analyzing architecture diagrams.

TASK: Analyze the provided architecture diagram and extract:
1. All software components/services visible in the diagram
2. Architectural risks and potential issues
3. Improvement recommendations

OUTPUT FORMAT: You MUST respond with valid JSON matching this exact schema:
{
  "components": [
    {
      "name": "string (component name as shown in diagram)",
      "type": "string (one of: service, database, queue, gateway, cache, storage, external, load_balancer, cdn, other)",
      "description": "string (brief description of the component's role)",
      "connections": ["string (names of connected components)"]
    }
  ],
  "risks": [
    {
      "title": "string (risk title)",
      "description": "string (detailed description)",
      "severity": "string (one of: critical, high, medium, low)",
      "category": "string (one of: security, scalability, reliability, performance, maintainability, cost)",
      "affectedComponents": ["string (component names)"]
    }
  ],
  "recommendations": [
    {
      "title": "string (recommendation title)",
      "description": "string (detailed recommendation)",
      "priority": "string (one of: high, medium, low)",
      "effort": "string (one of: low, medium, high)",
      "relatedRisks": ["string (risk titles)"]
    }
  ],
  "summary": "string (2-3 sentence executive summary of the architecture)"
}

RULES:
- Only identify components that are VISIBLE in the diagram
- Do NOT invent or assume components that are not shown
- Base risks on what you can observe, not hypothetical scenarios
- Keep descriptions concise and technical
- If the image is not an architecture diagram, respond with:
  {"error": "NOT_ARCHITECTURE_DIAGRAM", "message": "The provided image does not appear to be a software architecture diagram"}
- If the image quality is too low to analyze, respond with:
  {"error": "LOW_QUALITY_IMAGE", "message": "The image quality is insufficient for reliable analysis"}`

const PROMPTS: Record<string, string> = {
  v1: PROMPT_V1,
}

@Injectable()
export class PromptService {
  getPrompt(version: string = 'v1'): string {
    const prompt = PROMPTS[version]
    if (!prompt) {
      throw new Error(`Unknown prompt version: ${version}`)
    }
    return prompt
  }

  getLatestVersion(): string {
    return 'v1'
  }

  listVersions(): string[] {
    return Object.keys(PROMPTS)
  }
}
