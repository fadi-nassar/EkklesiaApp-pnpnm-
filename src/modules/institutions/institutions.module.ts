import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Institution,
  InstitutionSchema,
} from './schemas/institution.schema.js';
import { Booking, BookingSchema } from '../bookings/schema/booking.schema.js';
import { Event, EventSchema } from '../events/schema/event.schema.js';
import { News, NewsSchema } from '../news/schema/news.schema.js';
import { Follow, FollowSchema } from '../follows/schema/follow.schema.js';
import { Schedule, ScheduleSchema } from '../schedules/schema/schedule.schema.js';
import {
  ScheduleException,
  ScheduleExceptionSchema,
} from '../schedules/schema/schedule-exception.schema.js';
import { AdminGuard } from '../../common/guards/admin-guard.js';
import { SuperAdminGuard } from '../../common/guards/super-admin-guard.js';
import { InstitutionsService } from './institutions.service.js';
import { InstitutionsController } from './institution.controller.js';
import { SalonsService } from './salons.service.js';
import { SalonsController } from './salons.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Institution.name, schema: InstitutionSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Event.name, schema: EventSchema },
      { name: News.name, schema: NewsSchema },
      { name: Follow.name, schema: FollowSchema },
      { name: Schedule.name, schema: ScheduleSchema },
      { name: ScheduleException.name, schema: ScheduleExceptionSchema },
    ]),
    AuthModule,
    UsersModule,
  ],
  exports: [MongooseModule],
  providers: [AdminGuard, SuperAdminGuard, InstitutionsService, SalonsService],
  controllers: [InstitutionsController, SalonsController],
})
export class InstitutionsModule {}
