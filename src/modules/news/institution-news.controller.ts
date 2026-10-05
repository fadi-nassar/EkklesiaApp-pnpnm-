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
import { NewsService } from './news.service.js';
import { CreateNewsDto } from './dto/create-news.dto.js';
import { UpdateNewsDto } from './dto/update-news.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { AdminGuard } from '../../common/guards/admin-guard.js';

@Controller('institutions/:institutionId/news')
export class InstitutionNewsController {
  constructor(private readonly newsService: NewsService) {}

  //for superAdmin or the institution's own churchAdmin
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  async create(
    @Param('institutionId') institutionId: string,
    @Body() dto: CreateNewsDto,
  ) {
    return this.newsService.create(institutionId, dto);
  }

  //for anyone
  @Get()
  async findAll(
    @Param('institutionId') institutionId: string,
    @Query() query: { from?: string; to?: string },
  ) {
    return this.newsService.findAllForInstitution(institutionId, query);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id')
  async update(
    @Param('institutionId') institutionId: string,
    @Param('id') id: string,
    @Body() dto: UpdateNewsDto,
  ) {
    return this.newsService.update(institutionId, id, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  async remove(
    @Param('institutionId') institutionId: string,
    @Param('id') id: string,
  ) {
    await this.newsService.remove(institutionId, id);
    return { message: 'News deleted successfully.' };
  }
}
