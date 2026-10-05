import { Controller, Get, Param } from '@nestjs/common';
import { NewsService } from './news.service.js';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe.js';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  //for anyone
  @Get(':id')
  async findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return this.newsService.findOne(id);
  }
}
