import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Redis => {
    const url = configService.get<string>('REDIS_URL');
    if (!url) {
      throw new Error('REDIS_URL is not defined');
    }
    return new Redis(url);
  },
};
