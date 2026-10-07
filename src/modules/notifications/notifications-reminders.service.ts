import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event, EventDocument } from '../events/schema/event.schema.js';
import { Booking, BookingDocument } from '../bookings/schema/booking.schema.js';
import { NotificationsService } from './notifications.service.js';
import { FollowsService } from '../follows/follows.service.js';
import { getDayRangeInTimeZone } from '../../common/utils/timezone.util.js';

const TIME_ZONE = 'Asia/Beirut';

@Injectable()
export class NotificationsRemindersService {
  private readonly logger = new Logger(NotificationsRemindersService.name);

  constructor(
    @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly followsService: FollowsService,
  ) {}

  async runDailyReminders(): Promise<void> {
    const { start: todayStart } = getDayRangeInTimeZone(0, TIME_ZONE);
    const { start: tomorrowStart, end: tomorrowEnd } = getDayRangeInTimeZone(1, TIME_ZONE);

    await this.notifyEventReminders(tomorrowStart, tomorrowEnd, todayStart);
    await this.notifyBookingReminders(tomorrowStart, tomorrowEnd, todayStart);
  }

  private async notifyEventReminders(
    tomorrowStart: Date,
    tomorrowEnd: Date,
    since: Date,
  ): Promise<void> {
    const events = await this.eventModel
      .find({ startsAt: { $gte: tomorrowStart, $lt: tomorrowEnd } })
      .exec();

    for (const event of events) {
      try {
        const followerIds = await this.followsService.getFollowerIds(
          event.institutionId.toString(),
        );
        const alreadyNotified = await this.notificationsService.findAlreadyNotified(
          'event_reminder',
          (event as any)._id.toString(),
          followerIds,
          since,
        );
        const recipients = followerIds.filter((id) => !alreadyNotified.has(id));
        await this.notificationsService.createMany(recipients, {
          type: 'event_reminder',
          title: `Reminder: ${event.title} is tomorrow`,
          body: `${event.title} starts tomorrow.`,
          refId: (event as any)._id.toString(),
        });
      } catch (error) {
        this.logger.error(
          `Failed to send event reminder for event ${(event as any)._id}`,
          error as Error,
        );
      }
    }
  }

  private async notifyBookingReminders(
    tomorrowStart: Date,
    tomorrowEnd: Date,
    since: Date,
  ): Promise<void> {
    const bookings = await this.bookingModel
      .find({ status: 'approved', startsAt: { $gte: tomorrowStart, $lt: tomorrowEnd } })
      .exec();

    for (const booking of bookings) {
      try {
        const userId = booking.userId.toString();
        const alreadyNotified = await this.notificationsService.findAlreadyNotified(
          'booking_reminder',
          (booking as any)._id.toString(),
          [userId],
          since,
        );
        if (alreadyNotified.has(userId)) {
          continue;
        }
        await this.notificationsService.createMany([userId], {
          type: 'booking_reminder',
          title: `Reminder: your ${booking.bookingType} booking is tomorrow`,
          body: `Your ${booking.bookingType} booking starts tomorrow.`,
          refId: (booking as any)._id.toString(),
        });
      } catch (error) {
        this.logger.error(
          `Failed to send booking reminder for booking ${(booking as any)._id}`,
          error as Error,
        );
      }
    }
  }
}
