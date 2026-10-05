import {
  Query,
  Param,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Patch,
  Delete,
} from '@nestjs/common';
import { InstitutionsService } from './institutions.service.js';
import { CreateInstitutionDto } from './dto/create-institution.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { SuperAdminGuard } from '../../common/guards/super-admin-guard.js';
import { AssignAdminDto } from './dto/assign-admin.dto.js';
import { geocodeAddress } from './geocoding.util.js';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe.js';

@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}
  //for super admin only
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Post()
  async createInstitution(@Body() createInstitutionDto: CreateInstitutionDto) {
    return this.institutionsService.createInstitution(createInstitutionDto);
    
  }

  //for anyone
  // must be declared before ':id', otherwise 'nearby' is captured as an id
  @Get('nearby')
  async getNearbyInstitutions(
    @Query()
    query: {
      lat: string;
      lng: string;
      maxDistance?: string;
      rite?: string;
      includeAllCountries?: string;
    },
  ) {
    return this.institutionsService.getNearbyInstitutions(
      Number(query.lat),
      Number(query.lng),
      query.maxDistance !== undefined ? Number(query.maxDistance) : undefined,
      query.rite,
      query.includeAllCountries === 'true',
    );
  }

  @Get(':id')
  async getInstitutionById(@Param('id', ParseMongoIdPipe) id: string) {
    return this.institutionsService.getInstitutionById(id);
  }

  @Get()
  async getAllInstitutionsByNameTypeRite(
    @Query() query: { name?: string; type?: string; rite?: string },
  ) {
    return this.institutionsService.getAllInstitutionsByNameTypeRite(query);
  }

  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Patch(':id/admins')
  async assignAdminToInstitution(
    @Param('id', ParseMongoIdPipe) institutionId: string,
    @Body() assignAdminDto: AssignAdminDto,
  ) {
    return this.institutionsService.assignAdminToInstitution(
      institutionId,
      assignAdminDto.userId,
    );
  }

  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Delete(':id')
  async deleteInstitution(@Param('id', ParseMongoIdPipe) id: string) {
    return this.institutionsService.deleteInstitution(id);
  }
}
