import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/guards/auth.guard';
import { parseBody } from '../common/http/zod';
import { Roles } from '../common/guards/roles.guard';
import { AttemptsService } from './attempts.service';
import { AttemptSubmitSchema, SessionCreateSchema, SessionFinishSchema } from './dto';

/**
 * PH-4 attempt pipeline endpoints (E-040/41/42) plus the question-serve
 * call that stamps shown_at. Student-only; ownership enforced per row.
 */
@ApiTags('sessions')
@ApiBearerAuth()
@Controller('sessions')
export class SessionsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Post()
  @Roles('student')
  create(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.attempts.createSession(user.id, parseBody(SessionCreateSchema, body));
  }

  @Get(':id/questions/:questionId')
  @Roles('student')
  serve(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attempts.serveQuestion(user.id, id, questionId);
  }

  @Put(':id/attempts/:questionId')
  @Roles('student')
  submit(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attempts.submitAttempt(
      user.id,
      id,
      questionId,
      parseBody(AttemptSubmitSchema, body),
    );
  }

  @Get(':id/next')
  @Roles('student')
  next(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.attempts.nextQuestion(user.id, id);
  }

  @Get(':id/summary')
  @Roles('student')
  summary(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.attempts.sessionSummary(user.id, id);
  }

  @Post(':id/recalc-retry')
  @Roles('student')
  recalcRetry(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.attempts.retryRecalc(user.id, id);
  }

  @Get(':id/attempts/:attemptId/reveal')
  @Roles('student')
  reveal(
    @Param('id') id: string,
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attempts.revealAttempt(user.id, id, attemptId);
  }

  @Post(':id/finish')
  @Roles('student')
  @HttpCode(202)
  finish(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.attempts.finishSession(user.id, id, parseBody(SessionFinishSchema, body));
  }
}
