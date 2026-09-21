import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Schedule {
    @Prop({ required: true, ref: 'Institution' })
    institutionId: Types.ObjectId;

    @Prop({ required: true })
    dayOfWeek: number;

    @Prop({ required: true })
    time: string;

    @Prop({ required: true, enum: ['mass', 'regular_prayer'] })
    serviceType: string;

    @Prop({ required: true })
    startDate: string;

    @Prop({ required: true })
    endDate: string;
}

export type ScheduleDocument = Schedule & Document;

export const ScheduleSchema = SchemaFactory.createForClass(Schedule);
ScheduleSchema.index({ institutionId: 1, dayOfWeek: 1, time: 1 }, { unique: true });

