/**
 * Ops Financials — Compute Helpers (Internal Only)
 *
 * Pure functions for LTV computation (with manual override),
 * billing state derivation, and commercial snapshot building.
 */

import type { Client } from '@/types/database'
import type { ClientUnitEconomics } from '@/lib/ops/unit-economics/types'
import type {
  ClientFinancialProfile,
  ClientPaymentLog,
  ClientCommercialSnapshot,
  OpsFinancialKpis,
  FinancialLtvConfidence,
  LtvMode,
  RetainerStatus,
} from './types'
import { DEFAULT_FINANCIAL_PROFILE } from './types'

// ── LTV computation (merged: manual override or derived) ──────────────────

const MOCK_MRR = 299 // $299/month — "Growth" plan (consistent with unit-economics)

interface LtvResult {
  amount: number
  confidence: FinancialLtvConfidence
  mode: LtvMode
}

/**
 * Compute effective LTV for a client, merging manual override and auto-derived.
 * Manual override takes precedence when ltv_mode='manual'.
 */
export function computeEffectiveLtv(
  profile: ClientFinancialProfile | null,
  unitEcon: ClientUnitEconomics | null,
  paidPaymentsTotal: number,
): LtvResult {
  // Manual override
  if (profile?.ltvMode === 'manual' && profile.ltvManualAmount !== null) {
    return {
      amount: profile.ltvManualAmount,
      confidence: 'manual',
      mode: 'manual',
    }
  }

  // If we have paid payment logs, use those (closest to "exact")
  if (paidPaymentsTotal > 0) {
    return {
      amount: paidPaymentsTotal,
      confidence: 'derived',
      mode: 'auto',
    }
  }

  // Fall back to unit economics derived LTV
  if (unitEcon) {
    return {
      amount: unitEcon.totalCollectedLtv,
      confidence: unitEcon.ltvConfidence === 'exact' ? 'exact' : 'derived',
      mode: 'auto',
    }
  }

  return { amount: 0, confidence: 'estimated', mode: 'auto' }
}

/**
 * Compute LTV:CAC ratio. Null-safe.
 */
export function computeLtvCacRatio(ltv: number, cac: number | null): number | null {
  if (cac === null || cac <= 0) return null
  return Math.round((ltv / cac) * 100) / 100
}

// ── Retainer billing state derivation ─────────────────────────────────────

/**
 * Derive display-level retainer urgency from stored status + dates.
 * Returns the stored status unless dates indicate an override is warranted.
 * This is for DISPLAY only — does not persist changes.
 */
export function deriveRetainerDisplayStatus(
  storedStatus: RetainerStatus,
  nextDueAt: string | null,
  lastPaidAt: string | null,
): RetainerStatus {
  // Don't override terminal statuses
  if (storedStatus === 'not_set' || storedStatus === 'canceled' || storedStatus === 'paused') {
    return storedStatus
  }

  // If next_due_at is in the past and status is still 'active_paid' or 'due', flag as overdue
  if (nextDueAt) {
    const dueDate = new Date(nextDueAt)
    const now = new Date()
    if (dueDate < now && (storedStatus === 'active_paid' || storedStatus === 'due')) {
      return 'overdue'
    }
  }

  return storedStatus
}

/**
 * Compute "days since last paid" for display.
 */
export function daysSinceLastPaid(lastPaidAt: string | null): number | null {
  if (!lastPaidAt) return null
  const diff = Date.now() - new Date(lastPaidAt).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/**
 * Compute "days until next due" for display. Negative means overdue.
 */
export function daysUntilDue(nextDueAt: string | null): number | null {
  if (!nextDueAt) return null
  const diff = new Date(nextDueAt).getTime() - Date.now()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

// ── Commercial snapshot builder ───────────────────────────────────────────

/**
 * Build a full commercial snapshot for one client, merging all data sources.
 */
export function buildClientCommercialSnapshot(
  client: Client,
  profile: ClientFinancialProfile | null,
  unitEcon: ClientUnitEconomics | null,
  payments: ClientPaymentLog[],
): ClientCommercialSnapshot {
  const effectiveProfile = profile ?? { ...DEFAULT_FINANCIAL_PROFILE, clientId: client.id }

  // Sum paid payments
  const paidPayments = payments.filter((p) => p.status === 'paid')
  const paidTotal = paidPayments.reduce((sum, p) => sum + p.amount, 0)

  // This month's collected
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const collectedThisMonth = paidPayments
    .filter((p) => p.paidAt && new Date(p.paidAt) >= monthStart)
    .reduce((sum, p) => sum + p.amount, 0)

  // LTV
  const ltv = computeEffectiveLtv(effectiveProfile, unitEcon, paidTotal)

  // CAC
  const cacAmount = unitEcon?.cacAmount ?? null
  const cacSource = unitEcon?.cacSource ?? null

  return {
    clientId: client.id,
    clientName: client.name,
    clientSlug: client.slug,
    isActive: client.is_active,
    cacAmount,
    cacSource,
    ltvAmount: ltv.amount,
    ltvConfidence: ltv.confidence,
    ltvMode: ltv.mode,
    ltvCacRatio: computeLtvCacRatio(ltv.amount, cacAmount),
    mrrIncluded: effectiveProfile.mrrIncluded,
    retainerAmount: effectiveProfile.retainerAmount,
    setupFeeStatus: effectiveProfile.setupFeeStatus,
    setupFeeAmount: effectiveProfile.setupFeeAmount,
    retainerStatus: deriveRetainerDisplayStatus(
      effectiveProfile.retainerStatus,
      effectiveProfile.nextDueAt,
      effectiveProfile.lastPaidAt,
    ),
    lastPaidAt: effectiveProfile.lastPaidAt,
    nextDueAt: effectiveProfile.nextDueAt,
    totalCollected: paidTotal,
    collectedThisMonth,
    paymentsCount: payments.length,
  }
}

// ── Ops KPI aggregation ───────────────────────────────────────────────────

/**
 * Aggregate financial KPIs across all client snapshots.
 */
export function computeOpsFinancialKpis(
  snapshots: ClientCommercialSnapshot[],
): OpsFinancialKpis {
  let activeMrr = 0
  let mrrClientCount = 0
  let collectedThisMonth = 0
  let overdueRetainerCount = 0
  let unpaidSetupFeeCount = 0
  let ratioSum = 0
  let clientsWithBothCount = 0

  for (const s of snapshots) {
    // MRR: sum retainer amounts for active, mrr-included clients
    if (s.mrrIncluded && s.retainerAmount && s.retainerAmount > 0 && s.isActive) {
      activeMrr += s.retainerAmount
      mrrClientCount++
    }

    collectedThisMonth += s.collectedThisMonth

    if (s.retainerStatus === 'overdue') overdueRetainerCount++
    if (s.setupFeeStatus === 'unpaid') unpaidSetupFeeCount++

    if (s.ltvCacRatio !== null) {
      ratioSum += s.ltvCacRatio
      clientsWithBothCount++
    }
  }

  return {
    activeMrr,
    mrrClientCount,
    collectedThisMonth,
    overdueRetainerCount,
    unpaidSetupFeeCount,
    avgLtvCacRatio: clientsWithBothCount > 0
      ? Math.round((ratioSum / clientsWithBothCount) * 100) / 100
      : null,
    clientsWithBothCount,
  }
}
