import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export type PassTier = 'free' | 'sprint_7d' | 'sprint_14d' | 'season_1m' | 'season_3m';

export const TIER_CONFIG: Record<
  PassTier,
  { name: string; durationDays: number; priceCents: number; currency: string }
> = {
  free: { name: 'Free Tier', durationDays: 0, priceCents: 0, currency: 'INR' },
  sprint_7d: { name: 'Sprint Pass (7 Days)', durationDays: 7, priceCents: 49900, currency: 'INR' },
  sprint_14d: {
    name: 'Sprint Pass (14 Days)',
    durationDays: 14,
    priceCents: 79900,
    currency: 'INR',
  },
  season_1m: {
    name: 'Season Pass (1 Month)',
    durationDays: 30,
    priceCents: 129900,
    currency: 'INR',
  },
  season_3m: {
    name: 'Season Pass (3 Months)',
    durationDays: 90,
    priceCents: 249900,
    currency: 'INR',
  },
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createOrder(
    userId: string,
    tier: PassTier,
    gateway: 'razorpay' | 'stripe' | 'mock' = 'mock',
  ) {
    if (!tier || !TIER_CONFIG[tier] || tier === 'free') {
      throw new UnprocessableEntityException('Invalid pass tier selected');
    }

    const cfg = TIER_CONFIG[tier];
    const orderId = `order_${gateway}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return {
      orderId,
      tier,
      tierName: cfg.name,
      amountCents: cfg.priceCents,
      currency: cfg.currency,
      durationDays: cfg.durationDays,
      gateway,
      keyId: gateway === 'mock' ? 'mock_key_live' : (process.env.RAZORPAY_KEY_ID ?? 'rzp_test_key'),
    };
  }

  async handleWebhook(body: Record<string, unknown>, _signatureHeader?: string) {
    const payloadObj = body.payload as Record<string, unknown> | undefined;
    const paymentObj = payloadObj?.payment as Record<string, unknown> | undefined;
    const entityObj = paymentObj?.entity as Record<string, unknown> | undefined;
    const notesObj = entityObj?.notes as Record<string, unknown> | undefined;

    const idempotencyKey =
      body.idempotencyKey || body.event_id || body.id || entityObj?.id || body.orderId;

    if (!idempotencyKey) {
      throw new BadRequestException('Missing idempotency key or event id in webhook payload');
    }

    // Check if event already processed (idempotent webhook handling)
    const existing = await this.prisma.billingEvent.findUnique({
      where: { idempotencyKey: String(idempotencyKey) },
    });

    if (existing) {
      return {
        status: 'already_processed',
        idempotencyKey,
        processedAt: existing.processedAt,
      };
    }

    const eventType = String(body.eventType || body.event || 'payment.captured');
    const gateway = String(body.gateway || 'mock');
    const userId = String(body.userId || notesObj?.userId || '');
    const tier = (body.tier || notesObj?.tier) as PassTier;

    if (!userId) {
      throw new BadRequestException('userId is required to grant pass access');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    const passTier = tier && TIER_CONFIG[tier] ? tier : 'sprint_7d';
    const cfg = TIER_CONFIG[passTier];

    // Record billing event inside transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.billingEvent.create({
        data: {
          idempotencyKey: String(idempotencyKey),
          gateway,
          eventType,
          payload: body,
          processedAt: new Date(),
        },
      });

      // Find current active pass to extend, or create new
      const now = new Date();
      const currentPass = await tx.userPass.findFirst({
        where: { userId, status: 'active', validUntil: { gt: now } },
        orderBy: { validUntil: 'desc' },
      });

      const startDate = currentPass ? currentPass.validUntil : now;
      const validUntil = new Date(startDate.getTime() + cfg.durationDays * 24 * 60 * 60 * 1000);

      const pass = await tx.userPass.create({
        data: {
          userId,
          tier: passTier,
          status: 'active',
          validFrom: now,
          validUntil,
          externalId: String(idempotencyKey),
          amountCents: cfg.priceCents,
          currency: cfg.currency,
        },
      });

      return { event, pass };
    });

    this.logger.log(
      `Granted pass ${passTier} to user ${userId} valid until ${result.pass.validUntil.toISOString()}`,
    );

    return {
      status: 'processed',
      idempotencyKey,
      passId: result.pass.id,
      tier: passTier,
      validFrom: result.pass.validFrom,
      validUntil: result.pass.validUntil,
    };
  }

  async getUserSubscription(userId: string) {
    const now = new Date();
    const activePass = await this.prisma.userPass.findFirst({
      where: {
        userId,
        status: 'active',
        validUntil: { gt: now },
      },
      orderBy: { validUntil: 'desc' },
    });

    if (!activePass) {
      return {
        tier: 'free',
        tierName: TIER_CONFIG.free.name,
        isPassActive: false,
        validFrom: null,
        validUntil: null,
        daysRemaining: 0,
        features: {
          diagnostics: true,
          readinessGap: true,
          practicePlanCount: 1,
          multiTarget: false,
          reassessment: false,
          offlineExports: false,
        },
      };
    }

    const daysRemaining = Math.max(
      0,
      Math.ceil((activePass.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    );

    const isSeason = activePass.tier.startsWith('season');

    return {
      tier: activePass.tier,
      tierName: TIER_CONFIG[activePass.tier as PassTier]?.name ?? activePass.tier,
      isPassActive: true,
      validFrom: activePass.validFrom,
      validUntil: activePass.validUntil,
      daysRemaining,
      features: {
        diagnostics: true,
        readinessGap: true,
        practicePlanCount: 'unlimited',
        multiTarget: isSeason,
        reassessment: true,
        offlineExports: true,
      },
    };
  }
}
