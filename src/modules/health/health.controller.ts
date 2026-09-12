import { Controller, Get, Inject, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../database/redis.provider.js';

@ApiTags('health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  @Get()
  async check() {
    const mongoStatus = this.mongoConnection.readyState === 1 ? 'up' : 'down';

    let redisStatus: 'up' | 'down' = 'down';
    try {
      const pong = await this.redisClient.ping();
      redisStatus = pong === 'PONG' ? 'up' : 'down';
    } catch {
      redisStatus = 'down';
    }

    return {
      status: mongoStatus === 'up' && redisStatus === 'up' ? 'ok' : 'error',
      mongo: mongoStatus,
      redis: redisStatus,
      timestamp: new Date().toISOString(),
    };
  }
}
