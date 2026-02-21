/**
 * Usage Allowance / Overage types for tenant billing.
 *
 * Models monthly plan capacity, consumption tracking, and overage billing readiness.
 * All monetary amounts in currency minor units (cents).
 *
 * ── Trust / Copy Rules ───────────────────────────────────────────────────────
 *
 * Use SaaS-grade wording:
 *   ✓ "Monthly usage allowance" / "Processing volume" / "Usage capacity"
 *   ✗ "Provider cost" / "Retell cost" / "Internal margin"
 */

// ── Usage Metric ─────────────────────────────────────────────────────────────

export type UsageMetricType =
  | 'ai_call_minutes'
  | 'calls_handled'
  | 'processing_credits'
  | 'blended_credits'

export type UsageStatus = 'normal' | 'high_usage' | 'limit_reached' | 'overage'

// ── Usage Summary ────────────────────────────────────────────────────────────

export interface UsageAllowance {
  metricType: UsageMetricType
  metricLabel: string // human-readable e.g. "AI Call Minutes"
  allowanceIncluded: number
  usageConsumed: number
  usagePercent: number // 0–100+, can exceed 100 for overage
  overageUnits: number // max(0, consumed - included)
  overageRateCents: number | null // per-unit overage rate in cents (scaffold)
  overageEstimatedCents: number | null // estimated overage charge
  status: UsageStatus
}

export interface UsageSummary {
  tenantId: string
  periodLabel: string // e.g. "February 2026"
  periodStartAt: string | null
  periodEndAt: string | null
  allowances: UsageAllowance[]
  /** Overall status (worst of all allowances) */
  overallStatus: UsageStatus
  /** Whether metering data is connected or scaffolded */
  isMeteringConnected: boolean
  /** Data quality: exact (real metering), derived (from call logs), estimated (scaffold) */
  confidence: 'exact' | 'derived' | 'estimated'
}

// ── Usage Trend Point (for sparklines / history) ─────────────────────────────

export interface UsageTrendPoint {
  date: string // ISO date (YYYY-MM-DD)
  consumed: number
  percent: number
}

// ── Overage Preview ──────────────────────────────────────────────────────────

export interface OveragePreview {
  hasOverage: boolean
  totalOverageEstimateCents: number
  currency: string
  lineItems: Array<{
    metricLabel: string
    overageUnits: number
    rateCents: number | null
    estimateCents: number | null
  }>
}

// ── Billing Usage Snapshot (for billing card integration) ─────────────────────

export interface BillingUsageSnapshot {
  primaryAllowance: UsageAllowance | null
  overallStatus: UsageStatus
  isMeteringConnected: boolean
  periodLabel: string
  overagePreview: OveragePreview | null
}
