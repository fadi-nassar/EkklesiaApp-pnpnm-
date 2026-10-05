import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EventsService } from './events.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { AdminGuard } from '../../common/guards/admin-guard.js';

@Controller('institutions/:institutionId/events')
export class InstitutionEventsController {
  constructor(private readonly eventsService: EventsService) {}

  //for superAdmin or the institution's own churchAdmin
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  async create(
    @Param('institutionId') institutionId: string,
    @Body() dto: CreateEventDto,
  ) {
    return this.eventsService.create(institutionId, dto);
  }

  //for anyone
  @Get()
  async findAll(
    @Param('institutionId') institutionId: string,
    @Query() query: { from?: string; to?: string },
  ) {
    return this.eventsService.findAllForInstitution(institutionId, query);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id')
  async update(
    @Param('institutionId') institutionId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.update(institutionId, id, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  async remove(
    @Param('institutionId') institutionId: string,
    @Param('id') id: string,
  ) {
    await this.eventsService.remove(institutionId, id);
    return { message: 'Event deleted successfully.' };
  }
}
