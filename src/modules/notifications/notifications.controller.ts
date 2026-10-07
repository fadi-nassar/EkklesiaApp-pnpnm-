import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { ListNotificationsDto } from './dto/list-notifications.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator.js';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(
    @Query() query: ListNotificationsDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.notificationsService.list(currentUser.userId, query.page, query.limit);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.notificationsService.unreadCount(currentUser.userId);
  }

  // must be declared before ':id/read'
  @Patch('read-all')
  async markAllRead(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.notificationsService.markAllRead(currentUser.userId);
  }

  //for any authenticated user (ownership checked in the service)
  @Patch(':id/read')
  async markRead(
    @Param('id', ParseMongoIdPipe) id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.notificationsService.markRead(currentUser.userId, id);
  }
}
