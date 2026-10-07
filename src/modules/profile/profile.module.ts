import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schema/user.schema.js';
import {
  Institution,
  InstitutionSchema,
} from '../institutions/schemas/institution.schema.js';
import { Follow, FollowSchema } from '../follows/schema/follow.schema.js';
import { Booking, BookingSchema } from '../bookings/schema/booking.schema.js';
import {
  Notification,
  NotificationSchema,
} from '../notifications/schema/notification.schema.js';
import { Session, SessionSchema } from '../auth/schema/session.schema.js';
import { ProfileService } from './profile.service.js';
import { ProfileController } from './profile.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Institution.name, schema: InstitutionSchema },
      { name: Follow.name, schema: FollowSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
    AuthModule,
  ],
  providers: [ProfileService],
  controllers: [ProfileController],
})
export class ProfileModule {}
