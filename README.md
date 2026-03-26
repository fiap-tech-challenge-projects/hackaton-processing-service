# Processing Service

AI-powered processing service for architecture diagram analysis. Consumes analysis requests from RabbitMQ, sends diagram images to a configurable LLM provider for evaluation, stores results in DynamoDB, and publishes completion events.

## Tech Stack

- **Runtime:** NestJS 11, TypeScript 5
- **Database:** DynamoDB (AWS SDK v3)
- **Storage:** S3 / MinIO (for reading diagram images)
- **Messaging:** RabbitMQ (amqplib)
- **AI:** Anthropic SDK, OpenAI SDK, Ollama (HTTP)
- **Image Processing:** Sharp

## Architecture

Clean Architecture with port/adapter pattern for LLM providers:

```
src/
  domain/          # Entities, value objects, domain interfaces
  application/     # Use cases, DTOs, ports (including LLM port)
  infra/
    ai/llm/        # Claude, OpenAI, Ollama adapters
    database/      # DynamoDB repository
    messaging/     # RabbitMQ consumer & publisher
    storage/       # S3 storage adapter
  interfaces/      # Controllers
  shared/          # Filters, interceptors, utilities
  config/          # Configuration
```

## Event-Driven Flow

1. **Consumes** `analysis.requested` from RabbitMQ
2. Downloads the diagram from S3
3. Sends the image to the configured LLM for analysis
4. Stores the structured result in DynamoDB
5. **Produces** `analysis.processed` on success or `analysis.failed` on error

## LLM Providers

The service supports three LLM backends, selected via the `LLM_PROVIDER` environment variable:

| Provider         | Value    | Model Variable | Default Model              |
| ---------------- | -------- | -------------- | -------------------------- |
| Anthropic Claude | `claude` | `CLAUDE_MODEL` | `claude-sonnet-4-20250514` |
| OpenAI           | `openai` | `OPENAI_MODEL` | `gpt-4o`                   |
| Ollama (local)   | `ollama` | `OLLAMA_MODEL` | `llava`                    |

## Environment Variables

| Variable                | Description                                      | Required    | Default                             |
| ----------------------- | ------------------------------------------------ | ----------- | ----------------------------------- |
| `NODE_ENV`              | Environment                                      | No          | `development`                       |
| `PORT`                  | Server port                                      | No          | `3002`                              |
| `API_PREFIX`            | API route prefix                                 | No          | `/api/v1`                           |
| `AWS_REGION`            | AWS region                                       | No          | `us-east-1`                         |
| `AWS_ACCESS_KEY_ID`     | AWS access key                                   | Yes         | -                                   |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key                                   | Yes         | -                                   |
| `DYNAMODB_ENDPOINT`     | DynamoDB endpoint (local dev)                    | No          | -                                   |
| `DYNAMODB_TABLE_NAME`   | DynamoDB table name                              | No          | `hackaton-analysis-results-{env}`   |
| `S3_ENDPOINT`           | S3/MinIO endpoint                                | No          | -                                   |
| `S3_BUCKET`             | S3 bucket name                                   | No          | `diagrams`                          |
| `S3_FORCE_PATH_STYLE`   | Force path-style URLs (MinIO)                    | No          | `false`                             |
| `RABBITMQ_URL`          | RabbitMQ connection string                       | No          | `amqp://guest:guest@localhost:5672` |
| **`LLM_PROVIDER`**      | **LLM backend: `claude`, `openai`, or `ollama`** | **No**      | **`ollama`**                        |
| `ANTHROPIC_API_KEY`     | Anthropic API key (when using Claude)            | Conditional | -                                   |
| `CLAUDE_MODEL`          | Claude model name                                | No          | `claude-sonnet-4-20250514`          |
| `OPENAI_API_KEY`        | OpenAI API key (when using OpenAI)               | Conditional | -                                   |
| `OPENAI_MODEL`          | OpenAI model name                                | No          | `gpt-4o`                            |
| `OLLAMA_BASE_URL`       | Ollama server URL                                | No          | `http://localhost:11434`            |
| `OLLAMA_MODEL`          | Ollama model name                                | No          | `llava`                             |

## Running Locally

```bash
# No .env.example shipped; create your own .env from the table above
npm install
npm run start:dev
```

For local development with Ollama, make sure Ollama is running and the `llava` model is pulled:

```bash
ollama pull llava
```

## Tests

```bash
npm test              # Unit tests
npm run test:cov      # With coverage
npm run test:e2e      # End-to-end tests
```

## Docker

```bash
docker build -t processing-service .
docker run -p 3002:3002 --env-file .env processing-service
```

## License

UNLICENSED
