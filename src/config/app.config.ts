export const appConfig = () => ({
  port: parseInt(process.env.PORT || '3002', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',

  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },

  dynamodb: {
    endpoint: process.env.DYNAMODB_ENDPOINT,
    tableName: process.env.DYNAMODB_TABLE_NAME,
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT,
    bucketName: process.env.S3_BUCKET_NAME || 'hackaton-uploads',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  },

  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
  },

  llm: {
    provider: process.env.LLM_PROVIDER || 'ollama',
    claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL || 'llava',
  },
})

export type AppConfig = ReturnType<typeof appConfig>
