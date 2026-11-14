import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/guards/auth.guard';
import { Roles } from '../common/guards/roles.guard';
import { PatternsService, type CreatePatternReportDto } from './patterns.service';

/** E-092, FR-025 — Structural pattern reports and drift alerts (PH13-T06). */
@ApiTags('patterns')
@ApiBearerAuth()
@Controller()
export class PatternsController {
  constructor(private readonly patterns: PatternsService) {}

  @Post('pattern-reports')
  async createPatternReport(@CurrentUser() user: AuthUser, @Body() dto: CreatePatternReportDto) {
    return this.patterns.createPatternReport(user.id, dto);
  }

  @Get('pattern-reports')
  async listPatternReports(@Query('company') company?: string, @Query('status') status?: string) {
    return this.patterns.listPatternReports(company, status);
  }

  @Roles('admin')
  @Patch('pattern-reports/:id/review')
  async reviewPatternReport(
    @Param('id') id: string,
    @Body() body: { status: 'approved' | 'rejected' },
  ) {
    return this.patterns.reviewPatternReport(id, body.status);
  }

  @Roles('admin')
  @Get('admin/drift-alerts')
  async listDriftAlerts(@Query('company') company?: string, @Query('status') status?: string) {
    return this.patterns.listDriftAlerts(company, status);
  }

  @Roles('admin')
  @Post('admin/drift-alerts')
  async createDriftAlert(
    @Body()
    dto: {
      company: string;
      section: string;
      topicId?: string;
      oldWeight: number;
      newWeight: number;
      severity?: 'low' | 'medium' | 'high';
      notes?: string;
    },
  ) {
    return this.patterns.createDriftAlert(dto);
  }

  @Roles('admin')
  @Patch('admin/drift-alerts/:id/resolve')
  async resolveDriftAlert(
    @Param('id') id: string,
    @Body() body: { status?: 'resolved' | 'dismissed'; notes?: string },
  ) {
    return this.patterns.resolveDriftAlert(id, body.status ?? 'resolved', body.notes);
  }
}
