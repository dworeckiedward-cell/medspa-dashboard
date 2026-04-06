/**
 * Unit Economics — Domain Types (Ops-Only)
 *
 * Internal financial metrics for Servify operator decision-making.
 * These types must NEVER leak into tenant-facing routes or APIs.
 *
 * ── PRODUCTION SCHEMA (client_unit_economics) ───────────────────────────────
 * tenant_id          uuid (PK, FK → tenants.id)
 * cac_usd            numeric
 * ltv_usd            numeric
 * ltv_mode           text          ('auto' | 'manual')
 * acquisition_source text
 * acquired_date      date
 * notes              text
 * acquired_at        timestamptz
 * updated_at         timestamptz
 */

// ── CAC source classification ───────────────────────────────────────────────

export type CacSource = 'ads' | 'outbound' | 'referral' | 'organic' | 'mixed' | 'other'

export const CAC_SOURCE_LABELS: Record<CacSource, string> = {
  ads: 'Paid Ads',
  outbound: 'Outbound',
  referral: 'Referral',
  organic: 'Organic',
  mixed: 'Mixed',
  other: 'Other',
}

export const CAC_SOURCE_COLORS: Record<CacSource, string> = {
  ads: '#EF4444',
  outbound: '#F59E0B',
  referral: '#10B981',
  organic: '#3B82F6',
  mixed: '#8B5CF6',
  other: '#6B7280',
}

// ── LTV confidence ──────────────────────────────────────────────────────────

/** How confident we are in the LTV number. */
export type LtvConfidence = 'exact' | 'derived' | 'estimated' | 'none'

export const LTV_CONFIDENCE_LABELS: Record<LtvConfidence, string> = {
  exact: 'Exact',
  derived: 'Derived',
  estimated: 'Estimated',
  none: 'No data',
}

// ── Payback status ──────────────────────────────────────────────────────────

export type PaybackStatus =
  | 'not_set'           // CAC not entered
  | 'not_recovered'     // LTV < CAC
  | 'recovered'         // LTV >= CAC
  | 'highly_profitable' // LTV >= 3x CAC

export const PAYBACK_STATUS_LABELS: Record<PaybackStatus, string> = {
  not_set: 'No CAC',
  not_recovered: 'Not Recovered',
  recovered: 'Recovered',
  highly_profitable: 'Highly Profitable',
}

export const PAYBACK_STATUS_COLORS: Record<PaybackStatus, {
  bg: string
  text: string
}> = {
  not_set: { bg: 'bg-gray-100 dark:bg-gray-800/30', text: 'text-gray-500 dark:text-gray-400' },
  not_recovered: { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-600 dark:text-red-400' },
  recovered: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400' },
  highly_profitable: { bg: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-600 dark:text-violet-400' },
}

// ── Persisted row (matches PRODUCTION client_unit_economics table) ──────────

export interface UnitEconomicsRow {
  tenant_id: string
  cac_usd: number | null
  ltv_usd: number | null
  ltv_mode: string              // 'auto' | 'manual'
  acquisition_source: string | null
  acquired_date: string | null  // 'YYYY-MM-DD'
  notes: string | null
  acquired_at: string | null    // ISO 8601 timestamptz
  updated_at: string
}

/** @deprecated Use UnitEconomicsRow instead. Kept for compatibility with calc.ts consumers. */
export interface ClientUnitEconomicsRow {
  id: string
  client_id: string
  cac_amount: number | null
  cac_currency: string
  cac_source: CacSource | null
  cac_notes: string | null
  acquired_at: string | null
  created_at: string
  updated_at: string
}

// ── Computed per-client metrics ─────────────────────────────────────────────

export interface ClientUnitEconomics {
  clientId: string
  clientName: string
  clientSlug: string

  // CAC (manual input)
  cacAmount: number | null
  cacCurrency: string
  cacSource: CacSource | null
  cacNotes: string | null
  acquiredAt: string | null

  // LTV (derived from billing or manual)
  totalCollectedLtv: number       // total amount collected from this client
  ltvConfidence: LtvConfidence
  activeMrr: number | null        // current monthly recurring revenue
  collectedPaymentsCount: number
  firstPaymentAt: string | null
  lastPaymentAt: string | null

  // Manual LTV override
  manualLtvUsd: number | null
  ltvMode: string                 // 'auto' | 'manual'

  // Derived ratios
  paybackRatio: number | null     // ltv / cac (null if cac not set or 0)
  paybackStatus: PaybackStatus
  monthsToPayback: number | null  // derived from MRR / CAC (null if data insufficient)
}

// ── Upsert payload (what the API route receives) ────────────────────────────

export interface UnitEconomicsUpsertPayload {
  cacUsd?: number | null
  ltvUsd?: number | null
  ltvMode?: 'auto' | 'manual'
  acquisitionSource?: string | null
  acquiredDate?: string | null  // 'YYYY-MM-DD'
  notes?: string | null
}

// ── Legacy types kept for backward compat ───────────────────────────────────

/** @deprecated Use UnitEconomicsUpsertPayload */
export interface CacUpdatePayload {
  cacAmount: number | null
  cacCurrency?: string
  cacSource?: CacSource | null
  cacNotes?: string | null
  acquiredAt?: string | null
}

// ── Cohort aggregation ──────────────────────────────────────────────────────

export interface CohortRow {
  cohortMonth: string             // 'YYYY-MM'
  clientsCount: number
  totalCac: number
  totalLtv: number
  avgCac: number
  avgLtv: number
  avgLtvCacRatio: number | null
  recoveredCount: number
  cohortConfidence: LtvConfidence
  /** True if any client in cohort fell back to created_at instead of acquired_at */
  hasFallbackDates: boolean
}

// ── CAC by source aggregation ───────────────────────────────────────────────

export interface CacSourceRow {
  source: CacSource
  clientsCount: number
  totalCac: number
  avgCac: number
  totalLtv: number
  avgLtv: number
  avgLtvCacRatio: number | null
  recoveredCount: number
  missingCacCount: number
}
