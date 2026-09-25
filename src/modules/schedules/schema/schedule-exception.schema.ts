import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ScheduleException {
  @Prop({ type: Types.ObjectId, ref: 'Institution', required: true })
  institutionId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({
    type: String,
    required: true,
    enum: ['cancel', 'override', 'special'],
  })
  action: string;

  @Prop({ type: String })
  time?: string;

  @Prop({ type: String, enum: ['mass', 'regular_prayer'] })
  serviceType?: string;
}

export type ScheduleExceptionDocument = ScheduleException & Document;

export const ScheduleExceptionSchema =
  SchemaFactory.createForClass(ScheduleException);
ScheduleExceptionSchema.index({ institutionId: 1, date: 1 }, { unique: true });
