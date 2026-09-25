import { Module } from '@nestjs/common';
import { SchedulesModule } from '../schedules/schedules.module.js';
import { EventsModule } from '../events/events.module.js';
import { HomeFeedService } from './home-feed.service.js';

@Module({
  imports: [SchedulesModule, EventsModule],
  providers: [HomeFeedService],
  exports: [HomeFeedService],
})
export class HomeFeedModule {}
