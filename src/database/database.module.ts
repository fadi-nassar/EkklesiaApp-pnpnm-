import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { redisProvider, REDIS_CLIENT } from './redis.provider.js';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
    }),
  ],
  providers: [redisProvider],
  exports: [MongooseModule, REDIS_CLIENT],
})
export class DatabaseModule {}
