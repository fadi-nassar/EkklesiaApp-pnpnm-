import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ScheduleException,
  ScheduleExceptionSchema,
} from './schema/schedule-exception.schema.js';
import { Institution, InstitutionSchema } from '../institutions/schemas/institution.schema.js';
import { ScheduleExceptionsService } from './schedule-exceptions.service.js';
import { ScheduleExceptionsController } from './schedule-exceptions.controller.js';
import { AdminGuard } from '../../common/guards/admin-guard.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ScheduleException.name, schema: ScheduleExceptionSchema },
      { name: Institution.name, schema: InstitutionSchema },
    ]),
    AuthModule,
  ],
  exports: [MongooseModule],
  providers: [AdminGuard, ScheduleExceptionsService],
  controllers: [ScheduleExceptionsController],
})
export class SchedulesModule {}
