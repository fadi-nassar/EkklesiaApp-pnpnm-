import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ScheduleException,
  ScheduleExceptionDocument,
} from './schema/schedule-exception.schema.js';
import {
  Institution,
  InstitutionDocument,
} from '../institutions/schemas/institution.schema.js';
import { CreateScheduleExceptionDto } from './dto/create-schedule-exception.dto.js';
import { UpdateScheduleExceptionDto } from './dto/update-schedule-exception.dto.js';

const DUPLICATE_EXCEPTION_MESSAGE =
  'An exception already exists for this institution on this date — update it instead.';

@Injectable()
export class ScheduleExceptionsService {
  constructor(
    @InjectModel(ScheduleException.name)
    private readonly scheduleExceptionModel: Model<ScheduleExceptionDocument>,
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
  ) {}

  async create(
    institutionId: string,
    dto: CreateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    const institution = await this.institutionModel.findById(institutionId);
    if (!institution) {
      throw new NotFoundException(
        `Institution with ID ${institutionId} not found.`,
      );
    }

    const created = new this.scheduleExceptionModel({
      institutionId,
      date: dto.date,
      action: dto.action,
      time: dto.time,
      serviceType: dto.serviceType,
    });

    try {
      return await created.save();
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException(DUPLICATE_EXCEPTION_MESSAGE);
      }
      throw error;
    }
  }

  async findAllForInstitution(
    institutionId: string,
    query: { from?: string; to?: string },
  ): Promise<ScheduleException[]> {
    const filter: any = { institutionId };
    if (query.from || query.to) {
      filter.date = {};
      if (query.from) {
        filter.date.$gte = new Date(query.from);
      }
      if (query.to) {
        filter.date.$lte = new Date(query.to);
      }
    }
    return this.scheduleExceptionModel.find(filter).exec();
  }

  async update(
    institutionId: string,
    id: string,
    dto: UpdateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    const exception = await this.scheduleExceptionModel.findOne({
      _id: id,
      institutionId,
    });
    if (!exception) {
      throw new NotFoundException(
        `Schedule exception with ID ${id} not found for this institution.`,
      );
    }

    if (dto.date !== undefined) {
      exception.date = new Date(dto.date);
    }
    if (dto.action !== undefined) {
      exception.action = dto.action;
    }
    if (dto.time !== undefined) {
      exception.time = dto.time;
    }
    if (dto.serviceType !== undefined) {
      exception.serviceType = dto.serviceType;
    }

    try {
      return await exception.save();
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException(DUPLICATE_EXCEPTION_MESSAGE);
      }
      throw error;
    }
  }

  async remove(institutionId: string, id: string): Promise<void> {
    const result = await this.scheduleExceptionModel.deleteOne({
      _id: id,
      institutionId,
    });
    if (result.deletedCount === 0) {
      throw new NotFoundException(
        `Schedule exception with ID ${id} not found for this institution.`,
      );
    }
  }
}
