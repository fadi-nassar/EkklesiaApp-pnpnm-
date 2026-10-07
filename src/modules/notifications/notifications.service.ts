import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './schema/notification.schema.js';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  refId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async createMany(userIds: string[], payload: NotificationPayload): Promise<void> {
    if (userIds.length === 0) {
      return;
    }
    await this.notificationModel.insertMany(
      userIds.map((userId) => ({
        userId: new Types.ObjectId(userId),
        type: payload.type,
        title: payload.title,
        body: payload.body,
        refId: payload.refId ? new Types.ObjectId(payload.refId) : undefined,
      })),
    );
  }

  async list(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ items: Notification[]; page: number; limit: number; total: number }> {
    const filter = { userId: new Types.ObjectId(userId) };
    const [items, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments(filter),
    ]);
    return { items, page, limit, total };
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      read: false,
    });
    return { count };
  }

  async markRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.notificationModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
      { read: true },
      { new: true },
    );
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    return notification;
  }

  async markAllRead(userId: string): Promise<{ modifiedCount: number }> {
    const result = await this.notificationModel.updateMany(
      { userId: new Types.ObjectId(userId), read: false },
      { read: true },
    );
    return { modifiedCount: result.modifiedCount };
  }

  // userIds (from `candidateUserIds`) already notified for this type+refId since `since`
  async findAlreadyNotified(
    type: NotificationType,
    refId: string,
    candidateUserIds: string[],
    since: Date,
  ): Promise<Set<string>> {
    if (candidateUserIds.length === 0) {
      return new Set();
    }
    const existing = await this.notificationModel
      .find({
        type,
        refId: new Types.ObjectId(refId),
        userId: { $in: candidateUserIds.map((id) => new Types.ObjectId(id)) },
        createdAt: { $gte: since },
      })
      .select('userId')
      .exec();
    return new Set(existing.map((n) => n.userId.toString()));
  }
}
