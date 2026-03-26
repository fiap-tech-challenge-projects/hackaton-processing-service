import { Module } from '@nestjs/common'
import { RabbitMqPublisherService } from './rabbitmq-publisher.service'
import { RabbitMqConsumerService } from './rabbitmq-consumer.service'
import { EVENT_PUBLISHER } from '@application/ports/event-publisher.port'

@Module({
  providers: [
    {
      provide: EVENT_PUBLISHER,
      useClass: RabbitMqPublisherService,
    },
    RabbitMqConsumerService,
  ],
  exports: [EVENT_PUBLISHER, RabbitMqConsumerService],
})
export class MessagingModule {}
