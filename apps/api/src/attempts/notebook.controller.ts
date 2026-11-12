import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/guards/auth.guard';
import { AttemptsService } from './attempts.service';

/** E-044 — mistake notebook (PH8-T06). */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me/notebook')
export class NotebookController {
  constructor(private readonly attempts: AttemptsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('topicId') topicId?: string,
  ) {
    return this.attempts.notebook(user.id, {
      ...(status === 'resolved' || status === 'open' ? { status } : {}),
      ...(topicId ? { topicId } : {}),
    });
  }
}
