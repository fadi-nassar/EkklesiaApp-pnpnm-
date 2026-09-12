import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Institution {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: false })
  description?: string;

  @Prop({ type: String, required: true, enum: ['monastery', 'church'] })
  type: string;

  @Prop({ type: String, required: true })
  currency: string;

  @Prop({ type: String, required: true })
  timezone: string;

  @Prop({ type: [Types.ObjectId], ref: 'User', required: true })
  admins: Types.ObjectId[];

  @Prop({
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  })
  location: { type: string; coordinates: number[] };

  @Prop({ type: String, required: true, enum: ['orthodox'] })
  rite: string;
}

export type InstitutionDocument = Institution & Document;
export const InstitutionSchema = SchemaFactory.createForClass(Institution);
InstitutionSchema.index({ location: '2dsphere' });
