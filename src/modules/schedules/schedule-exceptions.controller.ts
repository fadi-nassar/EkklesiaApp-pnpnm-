import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ScheduleExceptionsService } from './schedule-exceptions.service.js';
import { CreateScheduleExceptionDto } from './dto/create-schedule-exception.dto.js';
import { UpdateScheduleExceptionDto } from './dto/update-schedule-exception.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { AdminGuard } from '../../common/guards/admin-guard.js';

@Controller('institutions/:institutionId/schedule-exceptions')
export class ScheduleExceptionsController {
  constructor(private readonly scheduleExceptionsService: ScheduleExceptionsService) {}

  //for superAdmin or the institution's own churchAdmin
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  async create(
    @Param('institutionId') institutionId: string,
    @Body() dto: CreateScheduleExceptionDto,
  ) {
    return this.scheduleExceptionsService.create(institutionId, dto);
  }

  //for anyone
  @Get()
  async findAll(
    @Param('institutionId') institutionId: string,
    @Query() query: { from?: string; to?: string },
  ) {
    return this.scheduleExceptionsService.findAllForInstitution(institutionId, query);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id')
  async update(
    @Param('institutionId') institutionId: string,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleExceptionDto,
  ) {
    return this.scheduleExceptionsService.update(institutionId, id, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  async remove(@Param('institutionId') institutionId: string, @Param('id') id: string) {
    await this.scheduleExceptionsService.remove(institutionId, id);
    return { message: 'Schedule exception deleted successfully.' };
  }
}
