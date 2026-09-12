/// this represent a recoed of an already sussessful login, it will be used to manage the session of the user and to refresh the access token when it expires.
///this is just a memory of that event, so the user is remembered of this device and can refresh the access token without having to login again, until the session expires or is revoked by the user or the system.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Session {
    @Prop({type: Types.ObjectId, ref: 'User', required: true})
    userId: Types.ObjectId; 
    ///we use Types.ObjectId to reference the User model in MongoDB, ensuring that each session is associated with a specific user.
    ///ref is used to establish a relationship between the Session and User models, allowing for population of user data when querying sessions.

    @Prop({ type: Date, required: true })
    expiresAt: Date;

    @Prop({ type: String, required: true,unique: true })
    refreshTokenHash: string;

    @Prop({ type: String, required: true})
    deviceId: string;



}



export const SessionSchema = SchemaFactory.createForClass(Session);
SessionSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

