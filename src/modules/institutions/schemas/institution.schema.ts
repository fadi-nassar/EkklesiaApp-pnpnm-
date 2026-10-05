import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema()
export class Salon {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: Number, required: true, min: 1 })
  maxAttendance: number;
}
export const SalonSchema = SchemaFactory.createForClass(Salon);

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

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'User', required: true })
  admins: Types.ObjectId[];

  @Prop({
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  })
  location: { type: string; coordinates: number[] };

  @Prop({ type: String, required: true, enum: ['orthodox'] })
  rite: string;

  @Prop({ type: String, required: true })
  country: string;

  @Prop({ type: Number, required: true })
  maxAttendance: number;

  @Prop({ type: Number, default: 30 })
  bufferMinutes: number;

  @Prop({ type: [SalonSchema], default: [] })
  salons: Salon[];

  @Prop({ type: Number, default: 0 })
  followerCount: number;
}

export type InstitutionDocument = Institution & Document;
export const InstitutionSchema = SchemaFactory.createForClass(Institution);
InstitutionSchema.index({ location: '2dsphere' });
