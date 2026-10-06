import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Book {
  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String })
  author?: string;

  @Prop({ type: String })
  prayerType?: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: String, default: 'ar' })
  language: string;

  @Prop({ type: String, required: true })
  fileUrl: string;

  @Prop({ type: String })
  coverUrl?: string;
}

export type BookDocument = Book & Document;
export const BookSchema = SchemaFactory.createForClass(Book);
BookSchema.index({ title: 1 });
