import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { LogoutDto } from './dto/logout.dto.js';
import { Throttle } from '@nestjs/throttler';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const { email, password, deviceId } = dto;
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user, deviceId);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const { username, email, password, homeInstitutionId, deviceId, rite } =
      dto;
    return this.authService.register(
      {
        username,
        email,
        passwordHash: password,
        homeInstitutionId: new Types.ObjectId(homeInstitutionId),
        role: 'user',
        rite,
      },
      deviceId,
    );
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('refresh-token')
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('logout')
  async logout(
    @Body() dto: LogoutDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.authService.logout(dto.sessionId, currentUser.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('change-password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.authService.changePassword(
      currentUser.userId,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
