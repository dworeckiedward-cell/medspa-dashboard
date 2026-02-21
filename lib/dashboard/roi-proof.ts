/**
 * ROI Proof Layer — pure calculation helpers.
 *
 * All functions are side-effect-free: they take call logs + services
 * and return typed results. No DB access, no I/O.
 *
 * Revenue values labelled "estimated" use keyword-based service matching.
 * Values labelled "reported" come from the call log's own booked_value field.
 */

import type { CallLog } from '@/types/database'
import type { ClientService } from '@/lib/types/domain'
import { resolveServicePrice } from './revenue-attribution'

// ── Configuration defaults ──────────────────────────────────────────────────

/** Assumed hourly cost of a human receptionist (USD). */
export const DEFAULT_HOURLY_RATE = 22

/** Default subscription cost per month (USD). Used when billing is mock. */
export const DEFAULT_SUBSCRIPTION_COST = 999

// ── ROI Summary ─────────────────────────────────────────────────────────────

export interface RoiSummary {
  /** Period label (e.g. "Last 30 days") */
  periodLabel: string
  /** Total calls in the period */
  totalCalls: number
  /** Calls where is_booked = true */
  totalBooked: number
  /** Sum of booked_value across all booked calls (dollars) */
  bookedRevenue: number
  /** Estimated revenue via service price matching (cents) */
  estimatedRevenueCents: number
  /** Total hours of AI call time */
  hoursSaved: number
  /** Labor cost savings = hoursSaved × hourlyRate (dollars) */
  laborSavings: number
  /** Missed calls recovered (see below) */
  missedCallsRecovered: number
  /** Revenue from recovered missed calls (dollars) */
  recoveredRevenue: number
  /** Total value generated = bookedRevenue + laborSavings + recoveredRevenue */
  totalValueGenerated: number
  /** Subscription cost for ROI calculation */
  subscriptionCost: number
  /** ROI % = ((totalValue - subscriptionCost) / subscriptionCost) × 100 */
  roiPercent: number | null
  /** Lead conversion rate */
  conversionRate: number
}

export interface RoiConfig {
  hourlyRate?: number
  subscriptionCost?: number
}

/**
 * Compute ROI summary for a given period of call logs.
 */
export function computeRoiSummary(
  callLogs: CallLog[],
  services: ClientService[],
  periodLabel: string,
  config: RoiConfig = {},
): RoiSummary {
  const hourlyRate = config.hourlyRate ?? DEFAULT_HOURLY_RATE
  const subscriptionCost = config.subscriptionCost ?? DEFAULT_SUBSCRIPTION_COST

  const totalCalls = callLogs.length
  const bookedCalls = callLogs.filter((c) => c.is_booked)
  const totalBooked = bookedCalls.length

  // Reported booked revenue (dollars)
  const bookedRevenue = bookedCalls.reduce((s, c) => s + (c.booked_value ?? 0), 0)

  // Estimated revenue via service matching (cents)
  let estimatedRevenueCents = 0
  for (const log of bookedCalls) {
    const priceCents = resolveServicePrice(log, services)
    if (priceCents !== null) {
      estimatedRevenueCents += priceCents
    } else {
      // Fall back to potential_revenue (dollars → cents)
      estimatedRevenueCents += Math.round((log.potential_revenue ?? 0) * 100)
    }
  }

  // Hours saved
  const totalSeconds = callLogs.reduce((s, c) => s + (c.duration_seconds ?? 0), 0)
  const hoursSaved = Math.round((totalSeconds / 3600) * 10) / 10
  const laborSavings = Math.round(hoursSaved * hourlyRate)

  // Missed call recovery
  const recovery = computeMissedCallRecovery(callLogs)
  const missedCallsRecovered = recovery.recoveredCalls.length
  const recoveredRevenue = recovery.recoveredCalls.reduce(
    (s, r) => s + (r.bookedCall.booked_value ?? r.bookedCall.potential_revenue ?? 0),
    0,
  )

  // Total value
  const totalValueGenerated = bookedRevenue + laborSavings + recoveredRevenue

  // ROI calculation
  const roiPercent = subscriptionCost > 0
    ? Math.round(((totalValueGenerated - subscriptionCost) / subscriptionCost) * 100)
    : null

  // Conversion rate
  const leads = callLogs.filter((c) => c.is_lead).length
  const conversionRate = leads > 0 ? Math.round((totalBooked / leads) * 100) : 0

  return {
    periodLabel,
    totalCalls,
    totalBooked,
    bookedRevenue,
    estimatedRevenueCents,
    hoursSaved,
    laborSavings,
    missedCallsRecovered,
    recoveredRevenue,
    totalValueGenerated,
    subscriptionCost,
    roiPercent,
    conversionRate,
  }
}

// ── Missed Call Recovery ────────────────────────────────────────────────────

export interface RecoveredCall {
  /** The original missed call */
  missedCall: CallLog
  /** The outbound follow-up that resulted in a booking */
  bookedCall: CallLog
  /** Time between missed call and recovery (milliseconds) */
  recoveryTimeMs: number
}

export interface MissedCallRecoveryResult {
  /** Total missed calls (no_answer + voicemail) */
  totalMissed: number
  /** Missed calls that were successfully recovered */
  recoveredCalls: RecoveredCall[]
  /** Recovery rate as percentage */
  recoveryRate: number
  /** Total revenue from recovered calls (dollars, from booked_value) */
  totalRecoveredRevenue: number
}

/**
 * Identify missed calls that were later recovered through outbound follow-up.
 *
 * A call is considered "recovered" when:
 *  1. An inbound call had disposition = 'no_answer' | 'voicemail'
 *  2. A later call to the same phone number resulted in is_booked = true
 *
 * This is a heuristic: the phone number link may occasionally match
 * unrelated callers. Results are labelled "estimated" in the UI.
 */
export function computeMissedCallRecovery(callLogs: CallLog[]): MissedCallRecoveryResult {
  // Missed calls: disposition is no_answer or voicemail
  const missedCalls = callLogs.filter(
    (c) =>
      (c.disposition === 'no_answer' || c.disposition === 'voicemail') &&
      c.caller_phone,
  )

  // Booked calls with a phone number, sorted newest-first
  const bookedByPhone = new Map<string, CallLog[]>()
  for (const log of callLogs) {
    if (log.is_booked && log.caller_phone) {
      const phone = log.caller_phone
      const existing = bookedByPhone.get(phone) ?? []
      existing.push(log)
      bookedByPhone.set(phone, existing)
    }
  }

  const recoveredCalls: RecoveredCall[] = []
  const usedBookedIds = new Set<string>()

  for (const missed of missedCalls) {
    const phone = missed.caller_phone!
    const bookedForPhone = bookedByPhone.get(phone) ?? []

    // Find the earliest booked call AFTER the missed call
    const missedTs = Date.parse(missed.created_at)
    const recovery = bookedForPhone
      .filter((b) => Date.parse(b.created_at) > missedTs && !usedBookedIds.has(b.id))
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))[0]

    if (recovery) {
      usedBookedIds.add(recovery.id)
      recoveredCalls.push({
        missedCall: missed,
        bookedCall: recovery,
        recoveryTimeMs: Date.parse(recovery.created_at) - missedTs,
      })
    }
  }

  const totalMissed = missedCalls.length
  const recoveryRate = totalMissed > 0
    ? Math.round((recoveredCalls.length / totalMissed) * 100)
    : 0
  const totalRecoveredRevenue = recoveredCalls.reduce(
    (s, r) => s + (r.bookedCall.booked_value ?? r.bookedCall.potential_revenue ?? 0),
    0,
  )

  return {
    totalMissed,
    recoveredCalls,
    recoveryRate,
    totalRecoveredRevenue,
  }
}

// ── Booking Proof ───────────────────────────────────────────────────────────

export interface BookingProofEntry {
  /** The booked call log */
  call: CallLog
  /** Matched service name (or null) */
  matchedServiceName: string | null
  /** Matched service price in cents (or null) */
  matchedPriceCents: number | null
  /** Revenue source: 'service_match' | 'booked_value' | 'potential_revenue' | 'none' */
  revenueSource: 'service_match' | 'booked_value' | 'potential_revenue' | 'none'
  /** Attributed revenue in dollars */
  revenueAttributed: number
}

/**
 * Build a detailed proof list of every AI-booked appointment
 * with service attribution and revenue source.
 */
export function computeBookingProof(
  callLogs: CallLog[],
  services: ClientService[],
): BookingProofEntry[] {
  const booked = callLogs.filter((c) => c.is_booked)

  return booked.map((call) => {
    // Attempt service match
    const priceCents = resolveServicePrice(call, services)
    let matchedServiceName: string | null = null
    let matchedPriceCents: number | null = null
    let revenueSource: BookingProofEntry['revenueSource'] = 'none'
    let revenueAttributed = 0

    if (priceCents !== null) {
      // Find which service matched
      const searchText = [
        call.semantic_title ?? '',
        call.summary ?? '',
        call.ai_summary ?? '',
        (call.tags ?? []).join(' '),
      ].join(' ').toLowerCase()

      const matched = [...services]
        .filter((s) => s.isActive && s.priceCents !== null)
        .sort((a, b) => b.name.length - a.name.length)
        .find((s) => searchText.includes(s.name.toLowerCase()))

      if (matched) {
        matchedServiceName = matched.name
        matchedPriceCents = matched.priceCents
      }
      revenueSource = 'service_match'
      revenueAttributed = priceCents / 100
    } else if ((call.booked_value ?? 0) > 0) {
      revenueSource = 'booked_value'
      revenueAttributed = call.booked_value
    } else if ((call.potential_revenue ?? 0) > 0) {
      revenueSource = 'potential_revenue'
      revenueAttributed = call.potential_revenue
    }

    return {
      call,
      matchedServiceName,
      matchedPriceCents,
      revenueSource,
      revenueAttributed,
    }
  })
}

// ── Period helpers ───────────────────────────────────────────────────────────

/**
 * Filter call logs to a rolling window ending at `now`.
 */
export function filterLogsToWindow(logs: CallLog[], days: number): CallLog[] {
  const cutoff = Date.now() - days * 86_400_000
  return logs.filter((l) => Date.parse(l.created_at) >= cutoff)
}
