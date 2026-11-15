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
    <div className="flex flex-col gap-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b border-purple-100/60 pb-5">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
            <IconCreditCard className="w-5 h-5" />
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Plans &amp; Subscription Passes
          </h1>
        </div>
        <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl">
          Upgrade your placement preparation with flexible sprint and season passes. Designed for
          campus aptitude drives with zero recurring trap subscriptions.
        </p>
      </div>

      {/* Current Subscription Status Card */}
      <section className="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Current Active Pass
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                sub?.isPassActive
                  ? 'bg-purple-100 text-purple-900 border border-purple-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {loading ? 'Checking…' : sub?.tierName || 'Free Starter'}
            </span>
          </div>

          <div className="text-sm font-semibold text-slate-900">
            {sub?.isPassActive
              ? `Active pass valid for ${sub.daysRemaining} more days`
              : 'Free Starter Tier — Baseline Diagnostic and Single Target Enabled'}
          </div>

          {sub?.validUntil && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <IconClock className="w-3.5 h-3.5" />
              <span>
                Valid until:{' '}
                {new Date(sub.validUntil).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>

        {/* Feature summary indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl bg-purple-50/60 p-3 border border-purple-100/60 flex items-center gap-2">
            <IconCheckCircle className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="text-slate-800 font-medium">Diagnostic Baseline</span>
          </div>

          <div className="rounded-xl bg-purple-50/60 p-3 border border-purple-100/60 flex items-center gap-2">
            <IconCheckCircle
              className={`w-4 h-4 shrink-0 ${sub?.features.practicePlanCount === 'unlimited' ? 'text-purple-600' : 'text-slate-400'}`}
            />
            <span className="text-slate-800 font-medium">
              {sub?.features.practicePlanCount === 'unlimited'
                ? 'Unlimited Plans'
                : '1 Practice Plan'}
            </span>
          </div>

          <div className="rounded-xl bg-purple-50/60 p-3 border border-purple-100/60 flex items-center gap-2">
            <IconCheckCircle
              className={`w-4 h-4 shrink-0 ${sub?.features.multiTarget ? 'text-purple-600' : 'text-slate-400'}`}
            />
            <span className="text-slate-800 font-medium">
              {sub?.features.multiTarget ? 'Multi-Target Drives' : 'Single Target'}
            </span>
          </div>
        </div>
      </section>

      {/* Plan Tiers Selection Grid */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Choose a Preparation Pass</h2>
          <p className="text-xs text-slate-500">
            One-time pass purchase — no recurring card charges or hidden subscriptions.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-5">
          {BILLING_TIERS.map((tier) => {
            const isCurrent = sub?.tier === tier.tier;

            return (
              <div
                key={tier.tier}
                className={`glass-card p-5 flex flex-col justify-between gap-5 relative transition-all ${
                  tier.popular
                    ? 'ring-2 ring-purple-600/80 shadow-md scale-102 sm:-translate-y-1'
                    : ''
                }`}
              >
                {tier.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider shadow-sm">
                    {tier.badge}
                  </span>
                )}

                <div className="flex flex-col gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{tier.name}</h3>
                    <span className="text-[11px] text-slate-500">{tier.durationLabel}</span>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                      {tier.priceFormatted}
                    </span>
                    {tier.priceInr > 0 && <span className="text-xs text-slate-400">one-time</span>}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed min-h-12">
                    {tier.description}
                  </p>

                  <div className="border-t border-purple-50 pt-3 flex flex-col gap-2">
                    {tier.features.slice(0, 5).map((f, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs">
                        <span
                          className={`mt-0.5 shrink-0 ${f.included ? 'text-purple-600' : 'text-slate-300'}`}
                        >
                          ✓
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
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openCheckout(tier)}
                  disabled={isCurrent}
                  className={`w-full py-2 px-3 text-xs font-semibold rounded-xl transition-all ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-default'
                      : tier.popular
                        ? 'btn-primary'
                        : 'btn-secondary'
                  }`}
                >
                  {isCurrent
                    ? 'Current Plan'
                    : tier.priceInr === 0
                      ? 'Included'
                      : `Select ${tier.name.split('(')[0]}`}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Plan Comparisons Table */}
      <section className="glass-card p-6 flex flex-col gap-4 overflow-hidden">
        <div>
          <h2 className="text-base font-bold text-slate-900">Feature Breakdown &amp; Comparison</h2>
          <p className="text-xs text-slate-500">
            Detailed matrix comparing capabilities across all available tiers.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-purple-100/70 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Feature</th>
                <th className="py-3 px-4">Free Starter</th>
                <th className="py-3 px-4">Sprint Passes (7/14d)</th>
                <th className="py-3 px-4">Season Passes (1/3m)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-50">
              <tr>
                <td className="py-3 px-4 font-medium text-slate-800">
                  Placement Diagnostic Baseline
                </td>
                <td className="py-3 px-4 text-purple-700">✓ Full Test</td>
                <td className="py-3 px-4 text-purple-700">✓ Full Test</td>
                <td className="py-3 px-4 text-purple-700">✓ Full Test</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-slate-800">
                  Target Assessment Blueprints
                </td>
                <td className="py-3 px-4 text-slate-600">1 Assessment</td>
                <td className="py-3 px-4 text-slate-600">1 Assessment</td>
                <td className="py-3 px-4 text-purple-700 font-semibold">
                  ✓ Multi-Assessment Concurrent
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-slate-800">
                  Daily Adaptive Practice Plans
                </td>
                <td className="py-3 px-4 text-slate-600">1 Plan</td>
                <td className="py-3 px-4 text-purple-700 font-semibold">✓ Unlimited Daily Plans</td>
                <td className="py-3 px-4 text-purple-700 font-semibold">✓ Unlimited Daily Plans</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-slate-800">
                  Bayesian Topic Recalibration
                </td>
                <td className="py-3 px-4 text-slate-400">Baseline only</td>
                <td className="py-3 px-4 text-purple-700">✓ Real-time after drills</td>
                <td className="py-3 px-4 text-purple-700">✓ Real-time after drills</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-slate-800">
                  Mistake Notebook &amp; Spaced Ladders
                </td>
                <td className="py-3 px-4 text-slate-600">Recent 10 mistakes</td>
                <td className="py-3 px-4 text-purple-700">✓ Full notebook</td>
                <td className="py-3 px-4 text-purple-700">✓ Full notebook + Tagging</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-slate-800">
                  Study Streak &amp; GitHub-style Heatmap
                </td>
                <td className="py-3 px-4 text-purple-700">✓ Included</td>
                <td className="py-3 px-4 text-purple-700">✓ Included</td>
                <td className="py-3 px-4 text-purple-700">✓ Included</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-slate-800">
                  Scheduled Reassessments &amp; Readiness Band
                </td>
                <td className="py-3 px-4 text-slate-400">—</td>
                <td className="py-3 px-4 text-purple-700">✓ Included</td>
                <td className="py-3 px-4 text-purple-700">✓ Included</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-slate-800">Full JSON Data Export</td>
                <td className="py-3 px-4 text-slate-400">—</td>
                <td className="py-3 px-4 text-purple-700">✓ Full export</td>
                <td className="py-3 px-4 text-purple-700">✓ Full export + Reports</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Checkout Placeholder Modal (Strict Compliance with No Payment Gateway Integration) */}
      {checkoutModalOpen && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="glass-card max-w-md w-full p-6 sm:p-7 flex flex-col gap-5 shadow-2xl border border-white relative">
            <div className="flex items-start justify-between border-b border-purple-100/70 pb-3">
              <div>
                <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">
                  Plan Checkout Preview
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
                <span className="text-xs text-slate-600 block">Total One-Time Fee:</span>
                <span className="text-xs text-slate-500">
                  Duration: {selectedPlan.durationLabel}
                </span>
              </div>
              <span className="text-2xl font-extrabold text-slate-900">
                {selectedPlan.priceFormatted}
              </span>
            </div>

            {/* Mandatory Compliance Notice: Gateway Pending */}
            <div className="rounded-xl bg-amber-50/90 border border-amber-200/80 p-3.5 flex flex-col gap-1.5 text-xs text-amber-900">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <span>⚠️ Payment Gateway Selection Pending</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Payment gateway provider integration (Razorpay / Stripe) is currently in evaluation
                and regulatory compliance review. Automated checkout is temporarily not enabled. No
                payment will be charged.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled
                className="w-full py-2.5 px-4 rounded-xl bg-slate-300 text-slate-600 font-semibold text-xs cursor-not-allowed"
                title="Checkout currently unavailable while gateway decision is finalized"
              >
                Checkout Not Available (Gateway Decision Pending)
              </button>

              <button
                type="button"
                onClick={() => setCheckoutModalOpen(false)}
                className="btn-secondary w-full py-2 text-xs font-semibold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
