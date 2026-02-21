/**
 * Commission Engine — deterministic computation helpers.
 *
 * Computes commission amounts from referral/revenue data.
 * All pure functions — no IO.
 *
 * ── Commission Model ────────────────────────────────────────────────────────
 *
 *   flat:    fixed amount per trigger event (e.g. $200 per client signed)
 *   percent: percentage of revenue (e.g. 10% of first month MRR)
 *   hybrid:  flat base + percent bonus (flat + percent of revenue)
 *
 * When actual revenue is not available, the helper returns an estimated amount
 * and the UI must label it as "Estimated".
 */

import type { CommissionBasis } from './types'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CommissionCalcInput {
  basisType: CommissionBasis
  /** For flat: amount in cents. For percent: percentage value (e.g. 10). */
  basisValue: number
  /** Actual or estimated revenue in cents (required for percent/hybrid). */
  revenueAmountCents: number | null
  /** Flat component for hybrid basis (in cents). */
  hybridFlatCents?: number
}

export interface CommissionCalcResult {
  amountCents: number
  isEstimated: boolean
  breakdown: string
}

// ── Default commission rate (used when no custom rate is set) ─────────────────

export const DEFAULT_FLAT_COMMISSION_CENTS = 20000 // $200 per client signed
export const DEFAULT_PERCENT_COMMISSION = 10 // 10% of first month revenue

// ── Computation ──────────────────────────────────────────────────────────────

/**
 * Compute commission amount for a single referral.
 *
 * @returns amountCents, isEstimated flag, and human-readable breakdown
 */
export function computeCommission(input: CommissionCalcInput): CommissionCalcResult {
  const { basisType, basisValue, revenueAmountCents, hybridFlatCents } = input

  switch (basisType) {
    case 'flat': {
      return {
        amountCents: Math.round(basisValue),
        isEstimated: false,
        breakdown: `Flat: ${formatCents(Math.round(basisValue))}`,
      }
    }

    case 'percent': {
      if (revenueAmountCents == null || revenueAmountCents <= 0) {
        return {
          amountCents: 0,
          isEstimated: true,
          breakdown: `${basisValue}% of revenue (revenue not yet available)`,
        }
      }
      const amount = Math.round((revenueAmountCents * basisValue) / 100)
      return {
        amountCents: amount,
        isEstimated: false,
        breakdown: `${basisValue}% of ${formatCents(revenueAmountCents)} = ${formatCents(amount)}`,
      }
    }

    case 'hybrid': {
      const flat = hybridFlatCents ?? 0
      const percentAmount =
        revenueAmountCents != null && revenueAmountCents > 0
          ? Math.round((revenueAmountCents * basisValue) / 100)
          : 0
      const total = flat + percentAmount
      const isEstimated = revenueAmountCents == null || revenueAmountCents <= 0

      return {
        amountCents: total,
        isEstimated,
        breakdown: isEstimated
          ? `Flat: ${formatCents(flat)} + ${basisValue}% of revenue (pending)`
          : `Flat: ${formatCents(flat)} + ${basisValue}% of ${formatCents(revenueAmountCents!)} = ${formatCents(total)}`,
      }
    }
  }
}

// ── Channel-wide aggregation ─────────────────────────────────────────────────

export interface ChannelMetrics {
  totalPartners: number
  activePartners: number
  totalReferrals: number
  totalClients: number
  conversionRate: number // 0–100
  pipelineValueCents: number
  payableCents: number
  paidCents: number
}

/** Simple helper to format cents as dollar string */
function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
