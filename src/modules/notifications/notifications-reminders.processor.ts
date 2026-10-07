import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { NotificationsRemindersService } from './notifications-reminders.service.js';
import { NOTIFICATIONS_REMINDERS_QUEUE } from './notifications.constants.js';

@Processor(NOTIFICATIONS_REMINDERS_QUEUE)
export class NotificationsRemindersProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsRemindersProcessor.name);

  constructor(private readonly remindersService: NotificationsRemindersService) {
    super();
  }

  async process(_job: Job): Promise<void> {
    this.logger.log('Running daily notification reminders job');
    await this.remindersService.runDailyReminders();
  }
}
