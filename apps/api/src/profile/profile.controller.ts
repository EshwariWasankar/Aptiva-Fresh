import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/guards/auth.guard';
import { ProfileService } from './profile.service';

/** E-020 — student profile and snapshot history. */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me/profile')
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  getProfile(@CurrentUser() user: AuthUser) {
    return this.profiles.getProfile(user.id);
  }

  @Get('history')
  getHistory(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    const n = limit ? Number.parseInt(limit, 10) : 50;
    return this.profiles.getHistory(user.id, Number.isFinite(n) ? n : 50);
  }
}
