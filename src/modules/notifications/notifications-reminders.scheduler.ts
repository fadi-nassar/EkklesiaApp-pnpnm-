import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  NOTIFICATIONS_REMINDERS_JOB_ID,
  NOTIFICATIONS_REMINDERS_QUEUE,
} from './notifications.constants.js';

@Injectable()
export class NotificationsRemindersScheduler implements OnModuleInit {
  private readonly logger = new Logger(NotificationsRemindersScheduler.name);

  constructor(
    @InjectQueue(NOTIFICATIONS_REMINDERS_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // upserting by the same scheduler id on every boot replaces the existing schedule instead of duplicating it
    await this.queue.upsertJobScheduler(
      NOTIFICATIONS_REMINDERS_JOB_ID,
      { pattern: '0 18 * * *', tz: 'Asia/Beirut' },
      { name: NOTIFICATIONS_REMINDERS_JOB_ID },
    );
    this.logger.log('Scheduled daily notification reminders job for 18:00 Asia/Beirut');
  }
}
