import { api } from './apiClient';

export type PassTier = 'free' | 'sprint_7d' | 'sprint_14d' | 'season_1m' | 'season_3m';

export interface PlanFeature {
  label: string;
  included: boolean;
  note?: string;
}

export interface PlanTierInfo {
  tier: PassTier;
  name: string;
  durationDays: number;
  durationLabel: string;
  priceInr: number;
  priceFormatted: string;
  badge?: string;
  popular?: boolean;
  description: string;
  features: PlanFeature[];
}

export const BILLING_TIERS: PlanTierInfo[] = [
  {
    tier: 'free',
    name: 'Free Starter',
    durationDays: 0,
    durationLabel: 'Forever free',
    priceInr: 0,
    priceFormatted: '₹0',
    description: 'Core placement diagnostic baseline with initial readiness gap calibration.',
    features: [
      { label: 'Full mixed-format placement diagnostic', included: true },
      { label: 'Bayesian topic mastery baseline', included: true },
      { label: 'Single target blueprint view', included: true },
      { label: '1 generated adaptive practice plan', included: true },
      { label: 'Mistake notebook (recent items)', included: true },
      { label: 'Multi-assessment target tracking', included: false },
      { label: 'Continuous adaptive plan recalibration', included: false },
      { label: 'Weekly performance summaries & exports', included: false },
    ],
  },
  {
    tier: 'sprint_7d',
    name: 'Sprint Pass (7 Days)',
    durationDays: 7,
    durationLabel: '7 days access',
    priceInr: 499,
    priceFormatted: '₹499',
    description: 'High-intensity cramming for an upcoming placement interview or exam round.',
    features: [
      { label: 'Full mixed-format placement diagnostic', included: true },
      { label: 'Unlimited daily adaptive practice plans', included: true },
      { label: 'Real-time Bayesian recalibration', included: true },
      { label: 'Comprehensive mistake notebook with spaced reviews', included: true },
      { label: 'Scheduled reassessments & readiness band', included: true },
      { label: 'JSON student data export', included: true },
      { label: 'Multi-company concurrent targets', included: false },
      { label: 'Dedicated placement readiness report', included: false },
    ],
  },
  {
    tier: 'sprint_14d',
    name: 'Sprint Pass (14 Days)',
    durationDays: 14,
    durationLabel: '14 days access',
    priceInr: 799,
    priceFormatted: '₹799',
    popular: true,
    badge: 'Most Popular',
    description: 'Two-week focused drive to eliminate weak topics and secure placement cutoff.',
    features: [
      { label: 'Full mixed-format placement diagnostic', included: true },
      { label: 'Unlimited daily adaptive practice plans', included: true },
      { label: 'Real-time Bayesian recalibration', included: true },
      { label: 'Comprehensive mistake notebook with spaced reviews', included: true },
      { label: 'Scheduled reassessments & readiness band', included: true },
      { label: 'JSON student data export', included: true },
      { label: 'Multi-company concurrent targets', included: false },
      { label: 'Dedicated placement readiness report', included: false },
    ],
  },
  {
    tier: 'season_1m',
    name: 'Season Pass (1 Month)',
    durationDays: 30,
    durationLabel: '30 days access',
    priceInr: 1299,
    priceFormatted: '₹1,299',
    description: 'Full placement season preparation across aptitude rounds and campus drives.',
    features: [
      { label: 'Everything in Sprint Passes', included: true },
      { label: 'Multi-company concurrent blueprint targets', included: true },
      { label: 'Unlimited scheduled reassessments', included: true },
      { label: 'Complete study streak & rest-day preservation', included: true },
      { label: 'Weekly summary reports & analytics', included: true },
      { label: 'Offline & full data export rights', included: true },
    ],
  },
  {
    tier: 'season_3m',
    name: 'Season Pass (3 Months)',
    durationDays: 90,
    durationLabel: '90 days access',
    priceInr: 2499,
    priceFormatted: '₹2,499',
    badge: 'Best Value',
    description: 'Comprehensive campus placement prep covering all major tier-1 drive cycles.',
    features: [
      { label: 'Everything in Season Pass (1 Month)', included: true },
      { label: 'Longest coverage (full hiring season)', included: true },
      { label: 'Multi-company concurrent blueprint targets', included: true },
      { label: 'Historical progress comparison', included: true },
      { label: 'Priority recalibration & offline exports', included: true },
    ],
  },
];

export interface UserSubscriptionResponse {
  tier: PassTier;
  tierName: string;
  isPassActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  daysRemaining: number;
  features: {
    diagnostics: boolean;
    readinessGap: boolean;
    practicePlanCount: number | 'unlimited';
    multiTarget: boolean;
    reassessment: boolean;
    offlineExports: boolean;
  };
}

export async function getUserSubscription(): Promise<UserSubscriptionResponse> {
  return api<UserSubscriptionResponse>('/me/subscription');
}

export interface BillingOrder {
  orderId: string;
  tier: PassTier;
  tierName: string;
  amountCents: number;
  currency: string;
  durationDays: number;
  gateway: string;
  keyId: string;
}

export function createBillingOrder(tier: PassTier): Promise<BillingOrder> {
  return api('/billing/orders', { method: 'POST', body: { tier, gateway: 'mock' } });
}

/** Mock-gateway activation: delivers the signed-equivalent webhook event locally. */
export function activateMockPass(order: BillingOrder, userId: string): Promise<unknown> {
  return api('/billing/webhook', {
    method: 'POST',
    body: {
      idempotencyKey: order.orderId,
      eventType: 'payment.captured',
      gateway: 'mock',
      userId,
      tier: order.tier,
      payload: { payment: { entity: { notes: { userId, tier: order.tier } } } },
    },
    auth: false,
  } as Parameters<typeof api>[1]);
}
