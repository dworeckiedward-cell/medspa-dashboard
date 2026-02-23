/**
 * Unit Economics — Financial Calculations (Ops-Only)
 *
 * Pure functions for computing LTV, payback, and derived metrics.
 * No IO, no side effects.
 */

import type {
  ClientUnitEconomics,
  PaybackStatus,
  LtvConfidence,
  ClientUnitEconomicsRow,
  UnitEconomicsRow,
  CacSource,
} from './types'
import type { Client } from '@/types/database'

// ── Mock billing constants ──────────────────────────────────────────────────
const MOCK_MRR_CENTS = 29900 // $299/month
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

export function computeLtv(client: Client): LtvResult {
  const createdAt = new Date(client.created_at)
  const now = new Date()
  const monthsActive = Math.max(
    1,
    (now.getFullYear() - createdAt.getFullYear()) * 12 +
      (now.getMonth() - createdAt.getMonth()),
  )

  if (!client.is_active) {
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
  return Math.round((ltv / cac) * 100) / 100
}

export function computeMonthsToPayback(mrr: number | null, cac: number | null): number | null {
  if (cac === null || cac <= 0) return null
  if (mrr === null || mrr <= 0) return null
  return Math.ceil(cac / mrr)
}

// ── Full per-client economics builder ───────────────────────────────────────

/**
 * Build complete unit economics for a client.
 * Merges CAC (from DB) with LTV (computed from billing or manual override).
 *
 * @param client - The tenant/client record
 * @param cacRow - Legacy row shape (for backward compat)
 * @param ueRow  - Production row shape (preferred, includes ltv_usd/ltv_mode)
 */
export function buildClientUnitEconomics(
  client: Client,
  cacRow: ClientUnitEconomicsRow | null,
  ueRow?: UnitEconomicsRow | null,
): ClientUnitEconomics {
  const ltv = computeLtv(client)

  // Read CAC from production row if available, else from legacy row
  const cacAmount = ueRow?.cac_usd ?? cacRow?.cac_amount ?? null

  // LTV: prefer manual override from production row, else use computed
  const manualLtv = ueRow?.ltv_usd ?? null
  const ltvMode = ueRow?.ltv_mode ?? 'auto'
  const effectiveLtv = ltvMode === 'manual' && manualLtv !== null
    ? manualLtv
    : ltv.totalCollectedLtv

  const paybackRatio = computePaybackRatio(effectiveLtv, cacAmount)
  const paybackStatus = computePaybackStatus(effectiveLtv, cacAmount)
  const monthsToPayback = computeMonthsToPayback(ltv.activeMrr, cacAmount)

  return {
    clientId: client.id,
    clientName: client.name,
    clientSlug: client.slug,

    cacAmount,
    cacCurrency: 'USD',
    cacSource: (ueRow?.acquisition_source ?? cacRow?.cac_source ?? null) as CacSource | null,
    cacNotes: ueRow?.notes ?? cacRow?.cac_notes ?? null,
    acquiredAt: ueRow?.acquired_date ?? ueRow?.acquired_at ?? cacRow?.acquired_at ?? null,

    ...ltv,

    manualLtvUsd: manualLtv,
    ltvMode,

    paybackRatio,
    paybackStatus,
    monthsToPayback,
  }
}
