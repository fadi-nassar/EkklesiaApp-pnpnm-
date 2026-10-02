import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';


@Schema({ timestamps: true })
export class Booking {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Institution', required: true })
    institutionId: Types.ObjectId;

    @Prop({type: String, required: true,enum:['wedding', 'baptism', 'engagement', 'funeral', ]})
    bookingType: string;

    @Prop({ type: Types.ObjectId, required: false })
    venueId?: Types.ObjectId;

    @Prop({ type: Date, required: true })
    startsAt: Date;

    @Prop({ type: Date, required: true })
    endsAt: Date;

    @Prop({ type: Number, required: true })
    headcount: number;

    @Prop({ type: String, required: true ,enum: ['requested', 'approved', 'rejected', 'cancelled'],default:'requested'})
    status: string;

    @Prop({type: String, required: false,})
    notes: string;
}

export type BookingDocument = Booking & Document;
export const BookingSchema = SchemaFactory.createForClass(Booking);
BookingSchema.index({ institutionId: 1, startsAt: 1 });
