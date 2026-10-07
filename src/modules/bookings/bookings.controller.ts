import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BookingsService } from './bookings.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { CreateFuneralBookingDto } from './dto/create-funeral-booking.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { AdminGuard } from '../../common/guards/admin-guard.js';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator.js';

@Controller()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  //for any authenticated user
  @UseGuards(JwtAuthGuard)
  @Post('institutions/:institutionId/bookings')
  async createRequest(
    @Param('institutionId', ParseMongoIdPipe) institutionId: string,
    @Body() dto: CreateBookingDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.bookingsService.createRequest(
      currentUser.userId,
      institutionId,
      dto,
    );
  }

  //for superAdmin or the institution's own churchAdmin
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('institutions/:institutionId/bookings/funeral')
  async createFuneral(
    @Param('institutionId', ParseMongoIdPipe) institutionId: string,
    @Body() dto: CreateFuneralBookingDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.bookingsService.createFuneral(
      currentUser.userId,
      institutionId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('institutions/:institutionId/bookings')
  async findForInstitution(
    @Param('institutionId', ParseMongoIdPipe) institutionId: string,
    @Query() query: { from?: string; to?: string; status?: string },
  ) {
    return this.bookingsService.findForInstitution(institutionId, query);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('institutions/:institutionId/bookings/:id/approve')
  async approve(
    @Param('institutionId', ParseMongoIdPipe) institutionId: string,
    @Param('id', ParseMongoIdPipe) id: string,
  ) {
    return this.bookingsService.approve(institutionId, id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('institutions/:institutionId/bookings/:id/reject')
  async reject(
    @Param('institutionId', ParseMongoIdPipe) institutionId: string,
    @Param('id', ParseMongoIdPipe) id: string,
  ) {
    return this.bookingsService.reject(institutionId, id);
  }

  //for superAdmin or the institution's own churchAdmin
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('institutions/:institutionId/bookings/:id/cancel')
  async adminCancel(
    @Param('institutionId', ParseMongoIdPipe) institutionId: string,
    @Param('id', ParseMongoIdPipe) id: string,
  ) {
    return this.bookingsService.adminCancel(institutionId, id);
  }

  //for any authenticated user (ownership checked in the service)
  @UseGuards(JwtAuthGuard)
  @Patch('bookings/:id/cancel')
  async cancel(
    @Param('id', ParseMongoIdPipe) id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.bookingsService.cancel(currentUser.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/me/bookings')
  async findMine(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.bookingsService.findMine(currentUser.userId);
  }
}
