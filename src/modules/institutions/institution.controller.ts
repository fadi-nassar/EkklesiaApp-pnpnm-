import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InstitutionsService } from './institutions.service.js';
import { CreateInstitutionDto } from './dto/create-institution.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { SuperAdminGuard } from '../../common/guards/super-admin-guard.js';

@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

    @UseGuards(JwtAuthGuard, SuperAdminGuard)
    @Post()
    async createInstitution(
        @Body() createInstitutionDto: CreateInstitutionDto,
    ) {
        return this.institutionsService.createInstitution(createInstitutionDto);
    }

}