import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, type AuthUser } from '../common/guards/auth.guard';
import { BillingService, type PassTier } from './billing.service';

export interface CreateOrderDto {
  tier: PassTier;
  gateway?: 'razorpay' | 'stripe' | 'mock';
}

/** E-093, FR-026 — Billing, pass checkout, and idempotent webhooks (PH13-T02). */
@ApiTags('billing')
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @ApiBearerAuth()
  @Post('billing/orders')
  async createOrder(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.billing.createOrder(user.id, dto.tier, dto.gateway);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('billing/webhook')
  async handleWebhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-webhook-signature') _signature?: string,
  ) {
    return this.billing.handleWebhook(body, _signature);
  }

  @ApiBearerAuth()
  @Get('me/subscription')
  async getSubscription(@CurrentUser() user: AuthUser) {
    return this.billing.getUserSubscription(user.id);
  }
}
