import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class News {
  @Prop({ type: Types.ObjectId, ref: 'Institution', required: true })
  institutionId: Types.ObjectId;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  body: string;

  @Prop({ type: String })
  image?: string;

  @Prop({ type: Date, required: true })
  publishedAt: Date;

  @Prop({ type: Number, default: 0 })
  likeCount: number;
}

export type NewsDocument = News & Document;

export const NewsSchema = SchemaFactory.createForClass(News);
