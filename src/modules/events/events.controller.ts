import { Controller, Get, Param, Query } from '@nestjs/common';
import { EventsService } from './events.service.js';
import { SearchEventsDto } from './dto/search-events.dto.js';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe.js';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  //for anyone
  // must be declared before ':id'
  @Get()
  async search(@Query() query: SearchEventsDto) {
    return this.eventsService.search(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return this.eventsService.findOne(id);
  }
}
