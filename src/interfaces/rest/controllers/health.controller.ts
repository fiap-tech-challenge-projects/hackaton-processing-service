import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        service: { type: 'string', example: 'processing-service' },
        timestamp: { type: 'string', example: '2026-03-26T00:00:00.000Z' },
        uptime: { type: 'number', example: 123.45 },
      },
    },
  })
  check() {
    return {
      status: 'ok',
      service: 'processing-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }
  }
}
