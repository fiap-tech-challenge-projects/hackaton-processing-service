import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.enableCors()

  const apiPrefix = process.env.API_PREFIX || '/api/v1'
  app.setGlobalPrefix(apiPrefix)

  const config = new DocumentBuilder()
    .setTitle('Processing Service API')
    .setDescription('AI-powered Processing Service for architecture diagram analysis')
    .setVersion('1.0')
    .addTag('health', 'Health check endpoints')
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document)

  const port = process.env.PORT || 3002
  await app.listen(port)

  console.log(`Processing Service is running on: http://localhost:${port}${apiPrefix}`)
  console.log(`Swagger docs available at: http://localhost:${port}${apiPrefix}/docs`)
}

bootstrap()
