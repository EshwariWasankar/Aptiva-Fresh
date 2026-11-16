'use client';

import { useEffect, useState } from 'react';
import {
  BILLING_TIERS,
  getUserSubscription,
  type PlanTierInfo,
  type UserSubscriptionResponse,
} from '../../../lib/billing';
import { IconCheckCircle, IconCreditCard, IconClock } from '../../../components/Icons';

export default function BillingPage() {
  const [sub, setSub] = useState<UserSubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PlanTierInfo | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);

  useEffect(() => {
    getUserSubscription()
      .then(setSub)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const openCheckout = (plan: PlanTierInfo) => {
    setSelectedPlan(plan);
    setCheckoutModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="border-b border-stone-200/70 pb-5">
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
            <IconCreditCard className="w-5 h-5" />
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Subscription Passes
          </h1>
        </div>
        <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl">
          Simple one-time passes for campus drive cycles. No recurring subscriptions or automatic
          card renewals.
        </p>
      </div>

      {/* Current Active Plan Card */}
      <section className="bento-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
              Your Current Status
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold font-mono ${
                sub?.isPassActive
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : 'bg-stone-100 text-slate-700 border border-stone-200'
              }`}
            >
              {loading ? 'Checking…' : sub?.tierName || 'Free Starter'}
            </span>
          </div>

          <div className="text-base font-bold text-slate-900">
            {sub?.isPassActive
              ? `Active Pass — ${sub.daysRemaining} days access remaining`
              : 'Free Starter — Single Blueprint Target & Diagnostic Baseline Enabled'}
          </div>

          {sub?.validUntil && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <IconClock className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                Valid through{' '}
                {new Date(sub.validUntil).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="rounded-xl bg-stone-50 px-4 py-2.5 border border-stone-200/70 flex items-center gap-2">
            <IconCheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold text-slate-800">
              {sub?.features.practicePlanCount === 'unlimited'
                ? 'Unlimited Adaptive Plans'
                : '1 Active Practice Plan'}
            </span>
          </div>
        </div>
      </section>

      {/* Available Plans: Clean Comparison Cards */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Available Passes</h2>
          <p className="text-xs text-slate-500">
            Select the pass that fits your placement interview schedule.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BILLING_TIERS.map((tier) => {
            const isCurrent = (sub?.tier || 'free') === tier.tier;

            return (
              <div
                key={tier.tier}
                className={`bento-card bento-card-hover p-6 flex flex-col justify-between gap-5 relative transition-all bg-white ${
                  tier.popular ? 'ring-2 ring-indigo-600 shadow-md sm:-translate-y-1' : ''
                }`}
              >
                {tier.badge && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-indigo-600 to-slate-900 px-3 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider shadow-sm font-mono">
                    {tier.badge}
                  </span>
                )}

                <div className="flex flex-col gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{tier.name}</h3>
                    <span className="text-xs text-slate-500 font-mono">{tier.durationLabel}</span>
                  </div>

                  <div className="flex items-baseline gap-1.5 my-1">
                    <span className="text-3xl font-extrabold tracking-tight text-slate-900 stat-num">
                      {tier.priceFormatted}
                    </span>
                    {tier.priceInr > 0 && (
                      <span className="text-xs text-slate-400">one-time pass</span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed min-h-10">
                    {tier.description}
                  </p>

                  <ul className="border-t border-stone-100 pt-3 flex flex-col gap-2">
                    {tier.features.slice(0, 4).map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <span
                          className={`mt-0.5 shrink-0 font-bold ${
                            f.included ? 'text-indigo-600' : 'text-slate-300'
                          }`}
                        >
                          {f.included ? '✓' : '—'}
                        </span>
                        <span
                          className={
                            f.included
                              ? 'text-slate-700 font-medium'
                              : 'text-slate-400 line-through'
                          }
                        >
                          {f.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => openCheckout(tier)}
                  disabled={isCurrent}
                  className={`w-full py-2.5 px-4 text-xs font-semibold rounded-xl transition-all ${
                    isCurrent
                      ? 'bg-stone-100 text-slate-400 border border-stone-200 cursor-default'
                      : tier.popular
                        ? 'btn-primary'
                        : 'btn-secondary'
                  }`}
                >
                  {isCurrent
                    ? 'Current Plan'
                    : tier.priceInr === 0
                      ? 'Included with Account'
                      : `Get ${(tier.name.split('(')[0] ?? tier.name).trim()}`}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Checkout Preview Modal (Strict Compliance Notice) */}
      {checkoutModalOpen && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="glass-card max-w-md w-full p-6 sm:p-7 flex flex-col gap-5 shadow-2xl border border-white relative">
            <div className="flex items-start justify-between border-b border-purple-100/70 pb-3">
              <div>
                <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">
                  Pass Details
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">{selectedPlan.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg text-sm"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl bg-purple-50/70 p-4 border border-purple-100/80 flex items-baseline justify-between">
              <div>
                <span className="text-xs text-slate-600 block">One-Time Fee:</span>
                <span className="text-xs text-slate-500">
                  Duration: {selectedPlan.durationLabel}
                </span>
              </div>
              <span className="text-2xl font-extrabold text-slate-900">
                {selectedPlan.priceFormatted}
              </span>
            </div>

            {/* Compliance Notice: Payment gateway decision pending */}
            <div className="rounded-xl bg-amber-50/90 border border-amber-200/80 p-3.5 flex flex-col gap-1.5 text-xs text-amber-900">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <span>⚠️ Payment Gateway Selection Pending</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Payment gateway provider integration is pending finalization. Automated checkout is
                not yet available, and no payments can be processed.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled
                className="w-full py-2.5 px-4 rounded-xl bg-slate-200 text-slate-500 font-semibold text-xs cursor-not-allowed"
              >
                Checkout Not Available
              </button>

              <button
                type="button"
                onClick={() => setCheckoutModalOpen(false)}
                className="btn-secondary w-full py-2 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
