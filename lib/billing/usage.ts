/**
 * Usage Allowance — deterministic computation helpers.
 *
 * Computes usage percentage, overage, and status from plan allowance
 * and consumption data. Pure functions — no IO.
 *
 * ── Current implementation ───────────────────────────────────────────────
 *
 * Metering is scaffolded — usage data comes from call_logs count/duration
 * as a proxy. Once a metering provider is integrated (e.g. Stripe metered
 * billing, or Retell usage API), replace getMockUsage() with real data.
 */

import type {
  UsageAllowance,
  UsageStatus,
  UsageSummary,
  OveragePreview,
  BillingUsageSnapshot,
  UsageMetricType,
} from './types'
import { format, startOfMonth, endOfMonth } from 'date-fns'

// ── Status derivation ────────────────────────────────────────────────────────

export function deriveUsageStatus(percent: number): UsageStatus {
  if (percent >= 120) return 'overage'
  if (percent >= 100) return 'limit_reached'
  if (percent >= 80) return 'high_usage'
  return 'normal'
}

export function getUsageStatusConfig(status: UsageStatus): {
  label: string
  textClass: string
  bgClass: string
} {
  switch (status) {
    case 'normal':
      return {
        label: 'Normal',
        textClass: 'text-emerald-700 dark:text-emerald-400',
        bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
      }
    case 'high_usage':
      return {
        label: 'High Usage',
        textClass: 'text-amber-700 dark:text-amber-400',
        bgClass: 'bg-amber-50 dark:bg-amber-950/30',
      }
    case 'limit_reached':
      return {
        label: 'Limit Reached',
        textClass: 'text-orange-700 dark:text-orange-400',
        bgClass: 'bg-orange-50 dark:bg-orange-950/30',
      }
    case 'overage':
      return {
        label: 'Overage',
        textClass: 'text-rose-700 dark:text-rose-400',
        bgClass: 'bg-rose-50 dark:bg-rose-950/30',
      }
  }
}

// ── Allowance computation ────────────────────────────────────────────────────

export function computeAllowance(
  metricType: UsageMetricType,
  metricLabel: string,
  included: number,
  consumed: number,
  overageRateCents: number | null = null,
): UsageAllowance {
  const percent = included > 0 ? Math.round((consumed / included) * 100) : 0
  const overageUnits = Math.max(0, consumed - included)
  const overageEstimatedCents =
    overageRateCents != null && overageUnits > 0
      ? overageUnits * overageRateCents
      : null

  return {
    metricType,
    metricLabel,
    allowanceIncluded: included,
    usageConsumed: consumed,
    usagePercent: percent,
    overageUnits,
    overageRateCents,
    overageEstimatedCents,
    status: deriveUsageStatus(percent),
  }
}

// ── Summary builders ─────────────────────────────────────────────────────────

export function buildUsageSummary(
  tenantId: string,
  allowances: UsageAllowance[],
  isMeteringConnected: boolean,
  confidence: 'exact' | 'derived' | 'estimated' = 'estimated',
): UsageSummary {
  const now = new Date()
  const periodLabel = format(now, 'MMMM yyyy')

  // Overall status = worst status across all allowances
  const statusOrder: Record<UsageStatus, number> = {
    normal: 0,
    high_usage: 1,
    limit_reached: 2,
    overage: 3,
  }

  let overallStatus: UsageStatus = 'normal'
  for (const a of allowances) {
    if (statusOrder[a.status] > statusOrder[overallStatus]) {
      overallStatus = a.status
    }
  }

  return {
    tenantId,
    periodLabel,
    periodStartAt: startOfMonth(now).toISOString(),
    periodEndAt: endOfMonth(now).toISOString(),
    allowances,
    overallStatus,
    isMeteringConnected,
    confidence,
  }
}

export function buildOveragePreview(
  allowances: UsageAllowance[],
  currency = 'usd',
): OveragePreview {
  const lineItems = allowances
    .filter((a) => a.overageUnits > 0)
    .map((a) => ({
      metricLabel: a.metricLabel,
      overageUnits: a.overageUnits,
      rateCents: a.overageRateCents,
      estimateCents: a.overageEstimatedCents,
    }))

  const totalOverageEstimateCents = lineItems.reduce(
    (sum, item) => sum + (item.estimateCents ?? 0),
    0,
  )

  return {
    hasOverage: lineItems.length > 0,
    totalOverageEstimateCents,
    currency,
    lineItems,
  }
}

export function buildBillingUsageSnapshot(
  summary: UsageSummary,
): BillingUsageSnapshot {
  const primary = summary.allowances.length > 0 ? summary.allowances[0] : null
  const overagePreview = buildOveragePreview(summary.allowances)

  return {
    primaryAllowance: primary,
    overallStatus: summary.overallStatus,
    isMeteringConnected: summary.isMeteringConnected,
    periodLabel: summary.periodLabel,
    overagePreview: overagePreview.hasOverage ? overagePreview : null,
  }
}

// ── Mock usage data (scaffold) ───────────────────────────────────────────────
// Replace with real metering data once provider is integrated.

export function getMockUsageSummary(tenantId: string): UsageSummary {
  // In production, fetch actual usage from metering provider
  // For now, return scaffold with unconnected metering
  const allowances: UsageAllowance[] = [
    computeAllowance('ai_call_minutes', 'AI Call Minutes', 500, 0, 50),
    computeAllowance('calls_handled', 'Calls Handled', 200, 0, null),
  ]

  return buildUsageSummary(tenantId, allowances, false)
}
