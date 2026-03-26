import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import * as amqplib from 'amqplib'
import { ProcessAnalysisUseCase } from '@application/use-cases/process-analysis.use-case'
import { AnalysisRequestedEventPayload } from '@application/dtos/analysis-result.dto'

const QUEUE_NAME = 'analysis.requested'
const EXCHANGE_NAME = 'analysis.events'
const ROUTING_KEY = 'analysis.requested'

@Injectable()
export class RabbitMqConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqConsumerService.name)
  private connection: amqplib.ChannelModel | null = null
  private channel: amqplib.Channel | null = null

  constructor(private readonly processAnalysisUseCase: ProcessAnalysisUseCase) {}

  async onModuleInit(): Promise<void> {
    await this.connectAndConsume()
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect()
  }

  private async connectAndConsume(): Promise<void> {
    const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'

    try {
      this.connection = await amqplib.connect(rabbitmqUrl)
      this.channel = await this.connection.createChannel()

      await this.channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true })
      await this.channel.assertQueue(QUEUE_NAME, { durable: true })
      await this.channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, ROUTING_KEY)

      // Process one message at a time
      this.channel.prefetch(1)

      this.logger.log(`Consuming messages from queue: ${QUEUE_NAME}`)

      await this.channel.consume(QUEUE_NAME, async (msg) => {
        if (!msg) return

        try {
          const content = msg.content.toString()
          const event = JSON.parse(content)
          const payload: AnalysisRequestedEventPayload = event.payload ?? event

          this.logger.log(`Received analysis.requested for analysisId=${payload.analysisId}`)

          await this.processAnalysisUseCase.execute(payload)

          this.channel?.ack(msg)
          this.logger.log(`Acknowledged message for analysisId=${payload.analysisId}`)
        } catch (error: any) {
          this.logger.error(`Failed to process message: ${error.message}`, error.stack)
          // Nack without requeue to avoid infinite loop
          this.channel?.nack(msg, false, false)
        }
      })

      this.connection.on('error', (err) => {
        this.logger.error(`RabbitMQ connection error: ${err.message}`)
        this.scheduleReconnect(rabbitmqUrl)
      })

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed (consumer), reconnecting...')
        this.scheduleReconnect(rabbitmqUrl)
      })
    } catch (error: any) {
      this.logger.error(`Failed to connect to RabbitMQ: ${error.message}`)
      this.scheduleReconnect(rabbitmqUrl)
    }
  }

  private scheduleReconnect(rabbitmqUrl: string): void {
    this.connection = null
    this.channel = null
    setTimeout(() => this.connectAndConsume(), 5000)
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
