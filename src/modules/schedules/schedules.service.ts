import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Schedule, ScheduleDocument } from './schema/schedule.schema.js';
import { applyTimeOverride, getNextOccurenceDate } from './schedule-utils.js';
import { ScheduleException, ScheduleExceptionDocument } from './schema/schedule-exception.schema.js';


@Injectable()
export class SchedulesService {
  constructor(
    @InjectModel(Schedule.name)
    private readonly scheduleModel: Model<ScheduleDocument>,
    @InjectModel(ScheduleException.name)
    private readonly scheduleExceptionModel: Model<ScheduleExceptionDocument>,
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
  
}
