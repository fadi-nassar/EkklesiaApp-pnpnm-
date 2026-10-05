import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from './schema/booking.schema.js';
import {
  Institution,
  InstitutionSchema,
} from '../institutions/schemas/institution.schema.js';
import { BookingsService } from './bookings.service.js';
import { BookingsController } from './bookings.controller.js';
import { AdminGuard } from '../../common/guards/admin-guard.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Institution.name, schema: InstitutionSchema },
    ]),
    AuthModule,
  ],
  exports: [MongooseModule, BookingsService],
  providers: [AdminGuard, BookingsService],
  controllers: [BookingsController],
})
export class BookingsModule {}
