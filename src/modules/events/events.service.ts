import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event, EventDocument } from './schema/event.schema.js';
import {
  Institution,
  InstitutionDocument,
} from '../institutions/schemas/institution.schema.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
import { SearchEventsDto } from './dto/search-events.dto.js';
import { escapeRegex } from '../../common/utils/escape-regex.js';
import { FollowsService } from '../follows/follows.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectModel(Event.name)
    private readonly eventModel: Model<EventDocument>,
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
    private readonly followsService: FollowsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(institutionId: string, dto: CreateEventDto): Promise<Event> {
    const institution = await this.institutionModel.findById(institutionId);
    if (!institution) {
      throw new NotFoundException(
        `Institution with ID ${institutionId} not found.`,
      );
    }

    const created = new this.eventModel({
      institutionId,
      title: dto.title,
      description: dto.description,
      image: dto.image,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
    });
    const saved = await created.save();

    try {
      const followerIds = await this.followsService.getFollowerIds(institutionId);
      await this.notificationsService.createMany(followerIds, {
        type: 'event_created',
        title: `New event: ${saved.title}`,
        body: `${institution.name} just posted a new event: ${saved.title}.`,
        refId: (saved as any)._id.toString(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to notify followers of new event ${(saved as any)._id}`,
        error as Error,
      );
    }

    return saved;
  }

  async findAllForInstitution(
    institutionId: string,
    query: { from?: string; to?: string },
  ): Promise<Event[]> {
    const fromDate = query.from ? new Date(query.from) : new Date(0);
    const toDate = query.to ? new Date(query.to) : new Date(8640000000000000);
    return this.getUpcomingEvents(institutionId, fromDate, toDate);
  }

  async getUpcomingEvents(
    institutionId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<Event[]> {
    return this.eventModel
      .find({
        institutionId,
        startsAt: { $gte: fromDate, $lte: toDate },
      })
      .sort({ startsAt: 1 })
      .exec();
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.eventModel.findById(id);
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found.`);
    }
    return event;
  }

  async update(
    institutionId: string,
    id: string,
    dto: UpdateEventDto,
  ): Promise<Event> {
    const event = await this.eventModel.findOne({ _id: id, institutionId });
    if (!event) {
      throw new NotFoundException(
        `Event with ID ${id} not found for this institution.`,
      );
    }

    if (dto.title !== undefined) {
      event.title = dto.title;
    }
    if (dto.description !== undefined) {
      event.description = dto.description;
    }
    if (dto.image !== undefined) {
      event.image = dto.image;
    }
    if (dto.startsAt !== undefined) {
      event.startsAt = new Date(dto.startsAt);
    }
    if (dto.endsAt !== undefined) {
      event.endsAt = new Date(dto.endsAt);
    }

    return event.save();
  }

  async remove(institutionId: string, id: string): Promise<void> {
    const result = await this.eventModel.deleteOne({ _id: id, institutionId });
    if (result.deletedCount === 0) {
      throw new NotFoundException(
        `Event with ID ${id} not found for this institution.`,
      );
    }
  }

  async search(query: SearchEventsDto): Promise<{
    items: Event[];
    page: number;
    limit: number;
    total: number;
  }> {
    const startsAt: any = {
      $gte: query.from ? new Date(query.from) : new Date(),
    };
    if (query.to) {
      startsAt.$lte = new Date(query.to);
    }
    const filter: any = { startsAt };
    if (query.institutionId) {
      filter.institutionId = query.institutionId;
    }
    if (query.search) {
      filter.title = { $regex: escapeRegex(query.search), $options: 'i' };
    }
    const [items, total] = await Promise.all([
      this.eventModel
        .find(filter)
        .sort({ startsAt: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .populate('institutionId', 'name')
        .exec(),
      // every match, ignoring paging
      this.eventModel.countDocuments(filter),
    ]);
    return { items, page: query.page, limit: query.limit, total };
  }
}
