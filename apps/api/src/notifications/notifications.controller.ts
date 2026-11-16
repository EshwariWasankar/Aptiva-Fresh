import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/guards/auth.guard';
import { NotificationsService, type NotificationPreferencesDto } from './notifications.service';

/** FR-028 — Reminders and weekly summary preferences (PH13-T07). */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async getNotifications(@CurrentUser() user: AuthUser) {
    return this.notifications.getNotifications(user.id);
  }

  @Post(':id/read')
  async markRead(@CurrentUser() _user: AuthUser, @Param('id') id: string) {
    return { id, read: true, success: true };
  }

  @Post('read-all')
  async markAllRead(@CurrentUser() _user: AuthUser) {
    return { success: true };
  }

  @Get('preferences')
  async getPreferences(@CurrentUser() user: AuthUser) {
    return this.notifications.getPreferences(user.id);
  }

  @Put('preferences')
  async updatePreferences(@CurrentUser() user: AuthUser, @Body() dto: NotificationPreferencesDto) {
    return this.notifications.updatePreferences(user.id, dto);
  }

  @Get('weekly-summary')
  async getWeeklySummary(@CurrentUser() user: AuthUser) {
    return this.notifications.getWeeklySummary(user.id);
  }
}
