import { Controller, Get, Param } from '@nestjs/common';
import { HomeFeedService } from './home-feed.service.js';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe.js';

@Controller('institutions/:institutionId/home-feed')
export class HomeFeedController {
  constructor(private readonly homeFeedService: HomeFeedService) {}

  //for anyone
  @Get()
  async getUpcomingFeed(
    @Param('institutionId', ParseMongoIdPipe) institutionId: string,
  ) {
    return this.homeFeedService.getUpcomingFeed(institutionId);
  }
}
