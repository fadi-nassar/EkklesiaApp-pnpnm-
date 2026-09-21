import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from './schema/event.schema.js';
import { Institution, InstitutionSchema } from '../institutions/schemas/institution.schema.js';
import { EventsService } from './events.service.js';
import { EventsController } from './events.controller.js';
import { InstitutionEventsController } from './institution-events.controller.js';
import { AdminGuard } from '../../common/guards/admin-guard.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
      { name: Institution.name, schema: InstitutionSchema },
    ]),
    AuthModule,
  ],
  exports: [MongooseModule],
  providers: [AdminGuard, EventsService],
  controllers: [EventsController, InstitutionEventsController],
})
export class EventsModule {}
