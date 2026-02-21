/**
 * Usage Formatting — display helpers for usage metering UI.
 *
 * Pure functions — no IO. Formats usage values, overage estimates,
 * and period labels for tenant-facing and ops-facing surfaces.
 */

import type { UsageAllowance, UsageSummary, UsageStatus, OveragePreview } from './types'

// ── Threshold constants (shared with alerts) ───────────────────────────────

export const USAGE_THRESHOLDS = {
  warning: 80,
  critical: 100,
  severe: 120,
} as const

// ── Usage percent formatting ────────────────────────────────────────────────

/**
 * Format usage percent for display.
 * Examples: "72% used this cycle", "100% — limit reached", "132% — overage"
 */
export function formatUsagePercent(percent: number, status: UsageStatus): string {
  switch (status) {
    case 'overage':
      return `${percent}% — overage`
    case 'limit_reached':
      return `${percent}% — limit reached`
    case 'high_usage':
      return `${percent}% used this cycle`
    default:
      return `${percent}% used this cycle`
  }
}

/**
 * Format a usage count with its metric label.
 * Example: "362 / 500 AI Call Minutes"
 */
export function formatAllowanceUsage(allowance: UsageAllowance): string {
  return `${allowance.usageConsumed.toLocaleString()} / ${allowance.allowanceIncluded.toLocaleString()} ${allowance.metricLabel}`
}

// ── Overage formatting ──────────────────────────────────────────────────────

/**
 * Format overage estimate in dollars.
 * Returns null if no overage.
 */
export function formatOverageEstimate(preview: OveragePreview): string | null {
  if (!preview.hasOverage) return null
  const amount = (preview.totalOverageEstimateCents / 100).toFixed(2)
  return `$${amount} estimated overage`
}

/**
 * Format a single overage line item.
 * Example: "AI Call Minutes: 62 units over @ $0.50/unit"
 */
export function formatOverageLineItem(item: {
  metricLabel: string
  overageUnits: number
  rateCents: number | null
}): string {
  const base = `${item.metricLabel}: ${item.overageUnits} units over`
  if (item.rateCents != null) {
    return `${base} @ $${(item.rateCents / 100).toFixed(2)}/unit`
  }
  return base
}

// ── Period formatting ───────────────────────────────────────────────────────

/**
 * Format the reset/renewal date for display.
 * Returns a human-readable string or null if no date.
 */
export function formatResetDate(periodEndAt: string | null): string | null {
  if (!periodEndAt) return null
  try {
    const date = new Date(periodEndAt)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return null
  }
}

/**
 * Compute days until allowance resets.
 */
export function getDaysUntilReset(periodEndAt: string | null): number | null {
  if (!periodEndAt) return null
  const diff = Date.parse(periodEndAt) - Date.now()
  if (isNaN(diff)) return null
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

// ── Confidence labels ───────────────────────────────────────────────────────

const CONFIDENCE_LABELS: Record<UsageSummary['confidence'], string> = {
  exact: 'Live metering',
  derived: 'Estimated from call data',
  estimated: 'Placeholder — metering not connected',
}

export function getConfidenceLabel(confidence: UsageSummary['confidence']): string {
  return CONFIDENCE_LABELS[confidence]
}

// ── Billing behavior copy ───────────────────────────────────────────────────

export const BILLING_COPY = {
  overageNote: 'Additional usage is billed in the next invoice cycle.',
  meteringNotConnected:
    'Usage metering is not yet connected. Your plan includes a monthly usage allowance. Live metering will appear here once enabled.',
  meteringNotConnectedTitle: 'Usage metering not connected',
} as const
