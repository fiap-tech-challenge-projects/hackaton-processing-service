import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import * as amqplib from 'amqplib'
import {
  IEventPublisher,
  AnalysisProcessedPayload,
  AnalysisFailedPayload,
} from '@application/ports/event-publisher.port'

const EXCHANGE_NAME = 'hackaton-events'
const ROUTING_KEY_PROCESSED = 'analysis.processed'
const ROUTING_KEY_FAILED = 'analysis.failed'

@Injectable()
export class RabbitMqPublisherService implements IEventPublisher, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqPublisherService.name)
  private connection: amqplib.ChannelModel | null = null
  private channel: amqplib.Channel | null = null

  async onModuleInit(): Promise<void> {
    await this.connect()
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect()
  }

  async publishAnalysisProcessed(payload: AnalysisProcessedPayload): Promise<void> {
    const event = this.buildEventEnvelope('analysis.processed', payload.analysisId, payload)
    await this.publish(ROUTING_KEY_PROCESSED, event)
    this.logger.log(`Published analysis.processed for analysisId=${payload.analysisId}`)
  }

  async publishAnalysisFailed(payload: AnalysisFailedPayload): Promise<void> {
    const event = this.buildEventEnvelope('analysis.failed', payload.analysisId, payload)
    await this.publish(ROUTING_KEY_FAILED, event)
    this.logger.log(`Published analysis.failed for analysisId=${payload.analysisId}`)
  }

  private buildEventEnvelope(eventType: string, correlationId: string, payload: unknown): object {
    return {
      eventType,
      timestamp: new Date().toISOString(),
      correlationId,
      source: 'processing-service',
      version: '1.0',
      payload,
    }
  }

  private async publish(routingKey: string, message: object): Promise<void> {
    if (!this.channel) {
      await this.connect()
    }

    if (!this.channel) {
      this.logger.error('RabbitMQ channel not available, dropping message')
      return
    }

    try {
      const content = Buffer.from(JSON.stringify(message))
      this.channel.publish(EXCHANGE_NAME, routingKey, content, {
        contentType: 'application/json',
        persistent: true,
      })
    } catch (error: any) {
      this.logger.error(`Failed to publish message to ${routingKey}: ${error.message}`)
      // Attempt reconnect on next publish
      this.channel = null
      this.connection = null
    }
  }

  private async connect(): Promise<void> {
    const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'

    try {
      this.connection = await amqplib.connect(rabbitmqUrl)
      this.channel = await this.connection.createChannel()

      await this.channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true })

      this.logger.log('Connected to RabbitMQ (publisher)')

      this.connection.on('error', (err) => {
        this.logger.error(`RabbitMQ connection error: ${err.message}`)
        this.connection = null
        this.channel = null
      })

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed (publisher)')
        this.connection = null
        this.channel = null
      })
    } catch (error: any) {
      this.logger.error(`Failed to connect to RabbitMQ: ${error.message}`)
      this.connection = null
      this.channel = null
    }
  }

  private async disconnect(): Promise<void> {
    try {
      await this.channel?.close()
      await this.connection?.close()
    } catch {
      // Ignore errors during shutdown
    }
  }
}
