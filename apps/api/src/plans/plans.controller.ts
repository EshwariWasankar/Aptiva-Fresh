import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/guards/auth.guard';
import { parseBody } from '../common/http/zod';
import { GeneratePlanBody, ItemFeedbackBody, PlanSettingsBody, RequirementsBody } from './dto';
import { PlansService } from './plans.service';

/** E-021..E-036 — requirements, plans, rationale, changes, readiness. */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get('requirements')
  getRequirements(@CurrentUser() user: AuthUser) {
    return this.plans.getRequirements(user.id);
  }

  @Put('requirements')
  putRequirements(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.plans.putRequirements(user.id, parseBody(RequirementsBody, body));
  }

  @Post('plans')
  generatePlan(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = body === undefined ? undefined : parseBody(GeneratePlanBody, body ?? {});
    return this.plans.generateForActiveRequirement(user.id, parsed);
  }

  @Get('plans/current')
  getCurrentPlan(@CurrentUser() user: AuthUser) {
    return this.plans.getCurrentPlan(user.id);
  }

  @Get('plans/:planId')
  getPlan(@CurrentUser() user: AuthUser, @Param('planId', ParseUUIDPipe) planId: string) {
    return this.plans.getPlan(user.id, planId);
  }

  @Get('plans/:planId/items/:itemId/rationale')
  getItemRationale(
    @CurrentUser() user: AuthUser,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.plans.getItemRationale(user.id, planId, itemId);
  }

  @Get('plans/:planId/changes')
  getChanges(@CurrentUser() user: AuthUser, @Param('planId', ParseUUIDPipe) planId: string) {
    return this.plans.getChanges(user.id, planId);
  }

  @Get('plans')
  listPlans(@CurrentUser() user: AuthUser) {
    return this.plans.listPlans(user.id);
  }

  @Post('plans/:planId/restore')
  restorePlan(@CurrentUser() user: AuthUser, @Param('planId', ParseUUIDPipe) planId: string) {
    return this.plans.restorePlan(user.id, planId);
  }

  @Post('plans/:planId/items/:itemId/feedback')
  itemFeedback(
    @CurrentUser() user: AuthUser,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: unknown,
  ) {
    const parsed = parseBody(ItemFeedbackBody, body);
    return this.plans.addItemFeedback(user.id, planId, itemId, parsed.reason, parsed.note);
  }

  @Get('plan-settings')
  getPlanSettings(@CurrentUser() user: AuthUser) {
    return this.plans.getPlanSettings(user.id);
  }

  @Put('plan-settings')
  putPlanSettings(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.plans.updatePlanSettings(user.id, parseBody(PlanSettingsBody, body));
  }

  @Get('readiness')
  getReadiness(@CurrentUser() user: AuthUser) {
    return this.plans.getReadiness(user.id);
  }
}
