import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../common/guards/auth.guard';
import { parseBody } from '../common/http/zod';
import { Roles } from '../common/guards/roles.guard';
import { ReassessmentService } from './reassessment.service';

const StartSchema = z.object({
  kind: z.enum(['check', 'topic', 'mock']),
  topicId: z.string().uuid().optional(),
});

/** PH9 — E-050/E-051 reassessment endpoints. */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me/reassessments')
export class ReassessmentController {
  constructor(private readonly reassessments: ReassessmentService) {}

  @Post()
  @Roles('student')
  start(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.reassessments.start(user.id, parseBody(StartSchema, body));
  }

  @Get(':id/comparison')
  @Roles('student')
  comparison(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.reassessments.comparison(user.id, id);
  }
}
