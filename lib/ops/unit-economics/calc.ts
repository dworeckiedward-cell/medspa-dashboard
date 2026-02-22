/**
 * Unit Economics — Financial Calculations (Ops-Only)
 *
 * Pure functions for computing LTV, payback, and derived metrics.
 * No IO, no side effects.
 *
 * LTV CONFIDENCE:
 *   - 'exact': from verified payment records (Stripe events)
 *   - 'derived': from mock billing snapshots (amountCents * months active)
 *   - 'estimated': fallback when no data exists
 *
 * Currently all billing data is scaffolded (mock). LTV is 'derived'
 * from the mock billing amount × months since client creation.
 * When real Stripe integration lands, switch to 'exact'.
 */

import type {
  ClientUnitEconomics,
  PaybackStatus,
  LtvConfidence,
  ClientUnitEconomicsRow,
  CacSource,
} from './types'
import type { Client } from '@/types/database'

// ── Mock billing constants ──────────────────────────────────────────────────
// These mirror the hardcoded values in lib/dashboard/billing.ts
// TODO: Replace with real per-client billing query when Stripe is connected

const MOCK_MRR_CENTS = 29900 // $299/month — "Growth" plan
const MOCK_MRR = MOCK_MRR_CENTS / 100

// ── LTV computation ─────────────────────────────────────────────────────────

interface LtvResult {
  totalCollectedLtv: number
  ltvConfidence: LtvConfidence
  activeMrr: number | null
  collectedPaymentsCount: number
  firstPaymentAt: string | null
  lastPaymentAt: string | null
}

/**
 * Compute LTV for a client from available billing data.
 *
 * Current approach (scaffold):
 *   LTV = MOCK_MRR × months_active
 *   confidence = 'derived'
 *
 * When Stripe is connected:
 *   LTV = sum(successful_payment_amounts)
 *   confidence = 'exact'
 */
export function computeLtv(client: Client): LtvResult {
  // Calculate months active since client creation
  const createdAt = new Date(client.created_at)
  const now = new Date()
  const monthsActive = Math.max(
    1,
    (now.getFullYear() - createdAt.getFullYear()) * 12 +
      (now.getMonth() - createdAt.getMonth()),
  )

  if (!client.is_active) {
    // Inactive client — LTV stops accumulating
    return {
      totalCollectedLtv: MOCK_MRR * Math.max(1, monthsActive - 1),
      ltvConfidence: 'derived',
      activeMrr: null,
      collectedPaymentsCount: Math.max(1, monthsActive - 1),
      firstPaymentAt: client.created_at,
      lastPaymentAt: null,
    }
  }

  return {
    totalCollectedLtv: MOCK_MRR * monthsActive,
    ltvConfidence: 'derived',
    activeMrr: MOCK_MRR,
    collectedPaymentsCount: monthsActive,
    firstPaymentAt: client.created_at,
    lastPaymentAt: now.toISOString(),
  }
}

// ── Payback computation ─────────────────────────────────────────────────────

export function computePaybackStatus(ltv: number, cac: number | null): PaybackStatus {
  if (cac === null || cac <= 0) return 'not_set'
  if (ltv >= cac * 3) return 'highly_profitable'
  if (ltv >= cac) return 'recovered'
  return 'not_recovered'
}

export function computePaybackRatio(ltv: number, cac: number | null): number | null {
  if (cac === null || cac <= 0) return null
  return Math.round((ltv / cac) * 100) / 100 // 2 decimal places
}

export function computeMonthsToPayback(mrr: number | null, cac: number | null): number | null {
  if (cac === null || cac <= 0) return null
  if (mrr === null || mrr <= 0) return null
  return Math.ceil(cac / mrr)
}

// ── Full per-client economics builder ───────────────────────────────────────

/**
 * Build complete unit economics for a client.
 * Merges CAC (from DB) with LTV (computed from billing).
 */
export function buildClientUnitEconomics(
  client: Client,
  cacRow: ClientUnitEconomicsRow | null,
): ClientUnitEconomics {
  const ltv = computeLtv(client)

  const cacAmount = cacRow?.cac_amount ?? null
  const paybackRatio = computePaybackRatio(ltv.totalCollectedLtv, cacAmount)
  const paybackStatus = computePaybackStatus(ltv.totalCollectedLtv, cacAmount)
  const monthsToPayback = computeMonthsToPayback(ltv.activeMrr, cacAmount)

  return {
    clientId: client.id,
    clientName: client.name,
    clientSlug: client.slug,

    cacAmount,
    cacCurrency: cacRow?.cac_currency ?? 'USD',
    cacSource: (cacRow?.cac_source as CacSource) ?? null,
    cacNotes: cacRow?.cac_notes ?? null,
    acquiredAt: cacRow?.acquired_at ?? null,

    ...ltv,

    paybackRatio,
    paybackStatus,
    monthsToPayback,
  }
}
