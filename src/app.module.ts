import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validate } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { InstitutionsModule } from './modules/institutions/institutions.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { SchedulesModule } from './modules/schedules/schedules.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { HomeFeedModule } from './modules/home-feed/home-feed.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    DatabaseModule,
    HealthModule,
    InstitutionsModule,
    AuthModule,
    SchedulesModule,
    EventsModule,
    HomeFeedModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
