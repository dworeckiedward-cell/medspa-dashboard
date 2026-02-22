/**
 * Billing helpers — mock provider scaffold for Stripe-ready billing status.
 *
 * USAGE NOW:  getMockBillingSummary(tenantId) returns a hardcoded test summary
 *             so the UI can be built and tested without a live Stripe integration.
 *
 * FUTURE:     Replace getMockBillingSummary with a DB lookup or Stripe API call.
 *             The BillingSummary shape is compatible with stripe.Subscription.
 */

import type { BillingSummary, BillingStatus } from '@/lib/types/domain'

// ── Mock provider ────────────────────────────────────────────────────────────
// TODO: Replace with Stripe API or synced `stripe_subscriptions` DB table.

/**
 * Return a mock BillingSummary for scaffold/demo purposes.
 * Returns null if tenantId is empty (signals "billing not configured" empty state).
 */
export function getMockBillingSummary(tenantId: string): BillingSummary | null {
  if (!tenantId) return null

  // Simulate a next billing date 12 days from now
  const nextBillingAt = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString()

  return {
    tenantId,
    planName: 'Growth',
    status: 'active',
    amountCents: 99800,       // $998 / month
    currency: 'usd',
    interval: 'month',
    nextBillingAt,
    paymentMethodBrand: 'visa',
    paymentMethodLast4: '4242',
    customerPortalUrl: null,  // replace with real Stripe portal URL when available
    invoicesUrl: null,
    updatedAt: new Date().toISOString(),
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute calendar days remaining until a given ISO date.
 * Returns null if date is null/invalid.
 * Returns 0 if the date is today or in the past.
 */
export function getDaysRemaining(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null
  const diff = Date.parse(isoDate) - Date.now()
  if (isNaN(diff)) return null
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

/**
 * Human-readable days label for billing display.
 * Examples: "today", "tomorrow", "12 days left", "overdue"
 */
export function formatDaysRemaining(days: number | null): string {
  if (days === null) return '—'
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `${days} days left`
}

// ── Status configuration ─────────────────────────────────────────────────────

export interface BillingStatusConfig {
  label: string
  variant: 'success' | 'warning' | 'destructive' | 'muted' | 'brand'
  /** Tailwind text color class */
  textClass: string
}

export function getBillingStatusConfig(status: BillingStatus): BillingStatusConfig {
  switch (status) {
    case 'active':
      return { label: 'Active',      variant: 'success',     textClass: 'text-emerald-600 dark:text-emerald-400' }
    case 'trialing':
      return { label: 'Trial',       variant: 'brand',       textClass: 'text-blue-600 dark:text-blue-400' }
    case 'past_due':
      return { label: 'Past Due',    variant: 'warning',     textClass: 'text-amber-600 dark:text-amber-400' }
    case 'canceled':
      return { label: 'Canceled',    variant: 'destructive', textClass: 'text-rose-600 dark:text-rose-400' }
    case 'incomplete':
      return { label: 'Incomplete',  variant: 'warning',     textClass: 'text-amber-600 dark:text-amber-400' }
    case 'unpaid':
      return { label: 'Unpaid',      variant: 'destructive', textClass: 'text-rose-600 dark:text-rose-400' }
    default:
      return { label: 'Unknown',     variant: 'muted',       textClass: 'text-[var(--brand-muted)]' }
  }
}

/**
 * Format a billing amount in cents to a locale-aware currency string.
 * Example: formatBillingAmount(99800, 'usd') → "$998"
 */
export function formatBillingAmount(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}
