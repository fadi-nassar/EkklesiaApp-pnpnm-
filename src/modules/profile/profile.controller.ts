import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ProfileService } from './profile.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator.js';

@Controller('users/me')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  //for any authenticated user
  @UseGuards(JwtAuthGuard)
  @Get()
  async getMe(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.profileService.getMe(currentUser.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch()
  async updateMe(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateMe(currentUser.userId, dto);
  }
}
