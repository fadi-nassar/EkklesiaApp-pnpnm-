import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event, EventDocument } from './schema/event.schema.js';
import { Institution, InstitutionDocument } from '../institutions/schemas/institution.schema.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name)
    private readonly eventModel: Model<EventDocument>,
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
  ) {}

  async create(institutionId: string, dto: CreateEventDto): Promise<Event> {
    const institution = await this.institutionModel.findById(institutionId);
    if (!institution) {
      throw new NotFoundException(`Institution with ID ${institutionId} not found.`);
    }

    const created = new this.eventModel({
      institutionId,
      title: dto.title,
      description: dto.description,
      image: dto.image,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
    });
    return created.save();
  }

  async findAllForInstitution(
    institutionId: string,
    query: { from?: string; to?: string },
  ): Promise<Event[]> {
    const filter: any = { institutionId };
    if (query.from || query.to) {
      filter.startsAt = {};
      if (query.from) {
        filter.startsAt.$gte = new Date(query.from);
      }
      if (query.to) {
        filter.startsAt.$lte = new Date(query.to);
      }
    }
    return this.eventModel.find(filter).sort({ startsAt: 1 }).exec();
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.eventModel.findById(id);
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found.`);
    }
    return event;
  }

  async update(institutionId: string, id: string, dto: UpdateEventDto): Promise<Event> {
    const event = await this.eventModel.findOne({ _id: id, institutionId });
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found for this institution.`);
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
      throw new NotFoundException(`Event with ID ${id} not found for this institution.`);
    }
  }
}
