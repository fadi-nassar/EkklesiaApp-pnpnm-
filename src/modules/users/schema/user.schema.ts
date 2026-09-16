import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class User {
  @Prop({ type: String, required: true })
  username: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  })
  email: string;

  @Prop({ type: String, required: true })
  passwordHash: string;

  @Prop({ type: Types.ObjectId, required: true, ref: 'Institution' })
  homeInstitutionId: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    enum: ['churchAdmin', 'user', 'superAdmin'],
  })
  role: string;

  @Prop({ type: [Types.ObjectId], default: [], ref: 'Institution' })
  managedInstitutionIds: Types.ObjectId[];
}

export type UserDocument = User & Document;

export const UserSchema = SchemaFactory.createForClass(User);

