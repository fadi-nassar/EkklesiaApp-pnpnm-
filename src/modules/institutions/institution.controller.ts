import { Query,Param, Body, Controller, Get, Post, UseGuards, Patch } from '@nestjs/common';
import { InstitutionsService } from './institutions.service.js';
import { CreateInstitutionDto } from './dto/create-institution.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { SuperAdminGuard } from '../../common/guards/super-admin-guard.js';
import { AssignAdminDto } from './dto/assign-admin.dto.js';


@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}
    //for super admin only 
    @UseGuards(JwtAuthGuard, SuperAdminGuard)
    @Post()
    async createInstitution(
        @Body() createInstitutionDto: CreateInstitutionDto,
    ) {
        return this.institutionsService.createInstitution(createInstitutionDto);
    }

    //for anyone
    @Get(':id')
    async getInstitutionById(@Param('id') id: string) {
        return this.institutionsService.getInstitutionById(id);
    }

    @Get()
    async getAllInstitutionsByNameTypeRite(@Query() query: { name?: string; type?: string; rite?: string }) {
        return this.institutionsService.getAllInstitutionsByNameTypeRite(query);
    }

    @UseGuards(JwtAuthGuard, SuperAdminGuard)
    @Patch(':id/admins')
    async assignAdminToInstitution(
        @Param('id') institutionId: string,
        @Body() assignAdminDto: AssignAdminDto
    ) {
        return this.institutionsService.assignAdminToInstitution(institutionId, assignAdminDto.userId);
    }
}