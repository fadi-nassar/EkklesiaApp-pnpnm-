import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Follow {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Institution', required: true })
  institutionId: Types.ObjectId;
}

export type FollowDocument = Follow & Document;

export const FollowSchema = SchemaFactory.createForClass(Follow);
FollowSchema.index({ userId: 1, institutionId: 1 }, { unique: true });
