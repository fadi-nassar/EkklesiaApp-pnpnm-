import { Controller, Get, Param } from '@nestjs/common';
import { HomeFeedService } from './home-feed.service.js';

@Controller('institutions/:institutionId/home-feed')
export class HomeFeedController {
  constructor(private readonly homeFeedService: HomeFeedService) {}

  //for anyone
  @Get()
  async getUpcomingFeed(@Param('institutionId') institutionId: string) {
    return this.homeFeedService.getUpcomingFeed(institutionId);
  }
}
