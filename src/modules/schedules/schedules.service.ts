import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Schedule, ScheduleDocument } from './schema/schedule.schema.js';
import {
  Institution,
  InstitutionDocument,
} from '../institutions/schemas/institution.schema.js';
import { CreateScheduleDto } from './dto/create-schedule.dto.js';
import { UpdateScheduleDto } from './dto/update-schedule.dto.js';
import { applyTimeOverride, getNextOccurenceDate } from './schedule-utils.js';
import { ScheduleException, ScheduleExceptionDocument } from './schema/schedule-exception.schema.js';


const DUPLICATE_SCHEDULE_MESSAGE =
  'A schedule already exists for this institution on this day and time. Update it instead.';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectModel(Schedule.name)
    private readonly scheduleModel: Model<ScheduleDocument>,
    @InjectModel(ScheduleException.name)
    private readonly scheduleExceptionModel: Model<ScheduleExceptionDocument>,
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
  ) {}

  async getUpcomingRawOccurrences(institutionId: string): Promise<Array<{
    scheduleId: Types.ObjectId;
    serviceType: string;
    occurrenceDate: Date;
  }>> {
    const rules = await this.scheduleModel.find({ institutionId }).exec();
    const now = new Date();
    return rules.map((rule) => ({
      scheduleId: rule._id as Types.ObjectId,
      serviceType: rule.serviceType,
      occurrenceDate: getNextOccurenceDate(rule, now),
    }));
  }
  async applyExceptions(
  occurrences: Array<{ scheduleId: Types.ObjectId; serviceType: string; occurrenceDate: Date }>,
  institutionId: string,
  ): Promise<Array<{ scheduleId: Types.ObjectId; serviceType: string; occurrenceDate: Date }>>{
  const listOfOccurences = await Promise.all(
    occurrences.map(async (occurrence)=>{
      const startOfDay = new Date(occurrence.occurrenceDate);
      startOfDay.setHours(0, 0, 0, 0);
      const startOfNextDay = new Date(startOfDay);
      startOfNextDay.setDate(startOfDay.getDate()+1)

      const exception = await this.scheduleExceptionModel.findOne({
        institutionId,
        date: { $gte: startOfDay, $lt: startOfNextDay },
        action: { $in: ['cancel', 'override'] },
      }).exec();

      if (!exception){
        return occurrence
      } 
      if (exception?.action === 'cancel'){
        return null
      }
     if (exception.action === 'override') {
        const newDate = new Date(occurrence.occurrenceDate);
        const [hourStr, minuteStr] = exception.time!.split(':');
        newDate.setHours(Number(hourStr), Number(minuteStr));
        return { ...occurrence, occurrenceDate: newDate };
      }
      
    })
   
  )

   return listOfOccurences.filter(
      (occurrence): occurrence is { scheduleId: Types.ObjectId; serviceType: string; occurrenceDate: Date } =>
      occurrence !== null,
      );
}
  async getSpecialExceptions(institutionId: string, fromDate: Date, toDate: Date ): Promise<Array<{ date: Date; time: string; serviceType: string }>>{
    const exceptions= await this.scheduleExceptionModel.find({
      institutionId,
      action: 'special',
      date: { $gte: fromDate, $lt: toDate},
    }).exec()
    return exceptions.map(exception=>({date: exception.date, time: exception.time!, serviceType: exception.serviceType!}))

  }

  async create(institutionId: string, dto: CreateScheduleDto): Promise<Schedule> {
    const institution = await this.institutionModel.findById(institutionId);
    if (!institution) {
      throw new NotFoundException(
        `Institution with ID ${institutionId} not found.`,
      );
    }

    const created = new this.scheduleModel({
      institutionId,
      dayOfWeek: dto.dayOfWeek,
      time: dto.time,
      serviceType: dto.serviceType,
    });

    try {
      return await created.save();
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException(DUPLICATE_SCHEDULE_MESSAGE);
      }
      throw error;
    }
  }

  async findAllForInstitution(institutionId: string): Promise<Schedule[]> {
    return this.scheduleModel
      .find({ institutionId })
      .sort({ dayOfWeek: 1, time: 1 })
      .exec();
  }

  async update(
    institutionId: string,
    id: string,
    dto: UpdateScheduleDto,
  ): Promise<Schedule> {
    const schedule = await this.scheduleModel.findOne({
      _id: id,
      institutionId,
    });
    if (!schedule) {
      throw new NotFoundException(
        `Schedule with ID ${id} not found for this institution.`,
      );
    }

    if (dto.dayOfWeek !== undefined) {
      schedule.dayOfWeek = dto.dayOfWeek;
    }
    if (dto.time !== undefined) {
      schedule.time = dto.time;
    }
    if (dto.serviceType !== undefined) {
      schedule.serviceType = dto.serviceType;
    }

    try {
      return await schedule.save();
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException(DUPLICATE_SCHEDULE_MESSAGE);
      }
      throw error;
    }
  }

  async remove(institutionId: string, id: string): Promise<void> {
    const result = await this.scheduleModel.deleteOne({
      _id: id,
      institutionId,
    });
    if (result.deletedCount === 0) {
      throw new NotFoundException(
        `Schedule with ID ${id} not found for this institution.`,
      );
    }
  }
}
