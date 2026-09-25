import { Injectable } from '@nestjs/common';
import { SchedulesService } from '../schedules/schedules.service.js';
import { EventsService } from '../events/events.service.js';

@Injectable()
export class HomeFeedService {
  constructor(
    private readonly schedulesService: SchedulesService,
    private readonly eventsService: EventsService,
  ) {}

  async getUpcomingFeed(institutionId: string): Promise<Array<{ label: string; occursAt: Date }>>{
    const now = new Date();
    const thirtyDaysLater = new Date(now);
    thirtyDaysLater.setDate(now.getDate()+30);

    const rawOccurrences = await this.schedulesService.getUpcomingRawOccurrences(institutionId);
    const filteredOccurrences  = await this.schedulesService.applyExceptions(rawOccurrences, institutionId);
    const specials = await this.schedulesService.getSpecialExceptions(institutionId, now, thirtyDaysLater);
    const events = await this.eventsService.getUpcomingEvents(institutionId, now, thirtyDaysLater);

    const occurrenceItems = filteredOccurrences.map((occurrence) => ({
      label: occurrence.serviceType,
      occursAt: occurrence.occurrenceDate,
    }));
    const specialItems = specials.map((special) => ({
      label: special.serviceType,
      occursAt: special.date,
    }));
    const eventItems = events.map((event) => ({
      label: event.title,
      occursAt: event.startsAt,
    }));

    return [...occurrenceItems, ...specialItems, ...eventItems]
      .sort((a, b) => a.occursAt.getTime() - b.occursAt.getTime())
      .slice(0, 5);
  }
}
