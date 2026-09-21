import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Event {
  @Prop({ type: Types.ObjectId, ref: 'Institution', required: true })
  institutionId: Types.ObjectId;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: String })
  image?: string;

  @Prop({ type: Date, required: true })
  startsAt: Date;

  @Prop({ type: Date })
  endsAt?: Date;

  @Prop({ type: Number, default: 0 })
  likeCount: number;
}

export type EventDocument = Event & Document;

export const EventSchema = SchemaFactory.createForClass(Event);
