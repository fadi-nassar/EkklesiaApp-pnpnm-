import { Controller, Get, Param } from '@nestjs/common';
import { EventsService } from './events.service.js';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe.js';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  //for anyone
  @Get(':id')
  async findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return this.eventsService.findOne(id);
  }
}
