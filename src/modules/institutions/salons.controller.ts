import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SalonsService } from './salons.service.js';
import { CreateSalonDto } from './dto/create-salon.dto.js';
import { UpdateSalonDto } from './dto/update-salon.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { AdminGuard } from '../../common/guards/admin-guard.js';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe.js';

@Controller('institutions/:institutionId/salons')
export class SalonsController {
  constructor(private readonly salonsService: SalonsService) {}

  //for superAdmin or the institution's own churchAdmin
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  async create(
    @Param('institutionId', ParseMongoIdPipe) institutionId: string,
    @Body() dto: CreateSalonDto,
  ) {
    return this.salonsService.create(institutionId, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':salonId')
  async update(
    @Param('institutionId', ParseMongoIdPipe) institutionId: string,
    @Param('salonId', ParseMongoIdPipe) salonId: string,
    @Body() dto: UpdateSalonDto,
  ) {
    return this.salonsService.update(institutionId, salonId, dto);
  }
}
