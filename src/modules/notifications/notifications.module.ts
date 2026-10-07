import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { Notification, NotificationSchema } from './schema/notification.schema.js';
import { Event, EventSchema } from '../events/schema/event.schema.js';
import { Booking, BookingSchema } from '../bookings/schema/booking.schema.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsRemindersService } from './notifications-reminders.service.js';
import { NotificationsRemindersProcessor } from './notifications-reminders.processor.js';
import { NotificationsRemindersScheduler } from './notifications-reminders.scheduler.js';
import { NOTIFICATIONS_REMINDERS_QUEUE } from './notifications.constants.js';
import { FollowsModule } from '../follows/follows.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      // read-only access for the reminders job; schemas only, not the owning modules, to avoid circular imports
      { name: Event.name, schema: EventSchema },
      { name: Booking.name, schema: BookingSchema },
    ]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = new URL(configService.getOrThrow<string>('REDIS_URL'));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port) || 6379,
            username: url.username || undefined,
            password: url.password || undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: NOTIFICATIONS_REMINDERS_QUEUE }),
    FollowsModule,
    AuthModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRemindersService,
    NotificationsRemindersProcessor,
    NotificationsRemindersScheduler,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
