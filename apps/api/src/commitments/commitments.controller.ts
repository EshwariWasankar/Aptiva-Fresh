import { Body, Controller, Delete, Get, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/guards/auth.guard';
import { CommitmentsService, type SetCommitmentDto } from './commitments.service';

/** E-090, E49, E50, E51 — Student commitment and streak management (PH13-T04). */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me/commitment')
export class CommitmentsController {
  constructor(private readonly commitments: CommitmentsService) {}

  @Get()
  async getCommitment(@CurrentUser() user: AuthUser) {
    return this.commitments.getCommitment(user.id);
  }

  @Get('activity')
  async getActivity(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    const daysBack = days ? Number.parseInt(days, 10) : 365;
    return this.commitments.getActivityHistory(user.id, Number.isFinite(daysBack) ? daysBack : 365);
  }

  @Put()
  async setCommitment(@CurrentUser() user: AuthUser, @Body() dto: SetCommitmentDto) {
    return this.commitments.setCommitment(user.id, dto);
  }

  @Post()
  async createCommitment(@CurrentUser() user: AuthUser, @Body() dto: SetCommitmentDto) {
    return this.commitments.setCommitment(user.id, dto);
  }

  @Delete()
  async endCommitment(@CurrentUser() user: AuthUser) {
    return this.commitments.endCommitment(user.id);
  }

  @Post('activity')
  async recordActivity(
    @CurrentUser() user: AuthUser,
    @Body() body: { activeSeconds?: number; questionsAnswered?: number },
  ) {
    const sec = body.activeSeconds ?? 0;
    const q = body.questionsAnswered ?? 1;
    await this.commitments.recordPracticeActivity(user.id, sec, q);
    return this.commitments.getCommitment(user.id);
  }
}
