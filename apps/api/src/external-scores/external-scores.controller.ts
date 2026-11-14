import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/guards/auth.guard';
import { ExternalScoresService, type CreateExternalScoreDto } from './external-scores.service';

/** E-091, FR-024 — External score logging (manual and CSV upload) (PH13-T05). */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me/external-scores')
export class ExternalScoresController {
  constructor(private readonly externalScores: ExternalScoresService) {}

  @Get()
  async listScores(@CurrentUser() user: AuthUser) {
    return this.externalScores.listScores(user.id);
  }

  @Post()
  async createScore(@CurrentUser() user: AuthUser, @Body() dto: CreateExternalScoreDto) {
    return this.externalScores.createScore(user.id, dto);
  }

  @Post('csv')
  async uploadCsv(
    @CurrentUser() user: AuthUser,
    @Body() body: { csv?: string; csvContent?: string },
  ) {
    const content = body.csv || body.csvContent || '';
    return this.externalScores.parseAndUploadCsv(user.id, content);
  }

  @Delete(':id')
  async deleteScore(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.externalScores.deleteScore(user.id, id);
  }
}
