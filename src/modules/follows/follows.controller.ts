import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FollowsService } from './follows.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator.js';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe.js';

@Controller()
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  //for any authenticated user
  @UseGuards(JwtAuthGuard)
  @Post('institutions/:institutionId/follow')
  async follow(
    @Param('institutionId', ParseMongoIdPipe) institutionId: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.followsService.follow(currentUser.userId, institutionId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('institutions/:institutionId/follow')
  async unfollow(
    @Param('institutionId', ParseMongoIdPipe) institutionId: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    await this.followsService.unfollow(currentUser.userId, institutionId);
    return { message: 'Unfollowed successfully.' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/me/follows')
  async getFollowedInstitutions(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.followsService.getFollowedInstitutions(currentUser.userId);
  }
}
