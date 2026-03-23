/**
 * Conversion funnel + period-summary helpers.
 *
 * Pure functions — no I/O, no side-effects. Safe to call in both
 * Server Components and Client Components.
 */

import type { CallLog } from '@/types/database'

// ── Funnel ─────────────────────────────────────────────────────────────────

export interface FunnelStep {
  key: string
  label: string
  count: number
  /** Conversion rate from the previous step (0–100), null for first step */
  rateFromPrev: number | null
  /** How many fell off from the previous step */
  dropFromPrev: number
}

export interface ConversionFunnel {
  steps: FunnelStep[]
  /** Leads → booked, end-to-end (0–100) */
  overallRate: number
  totalLeads: number
}

/**
 * Compute the 5-step conversion funnel from CallLog rows.
 *
 * Steps:
 *  1. Lead Captured  — is_lead = true
 *  2. Contacted      — lead AND (direction = 'outbound' OR contacted_at != null)
 *  3. Qualified      — lead AND lead_confidence >= 0.5
 *  4. Booked         — is_booked = true
 *  5. Confirmed      — booked AND appointment_datetime != null
 */
export function computeConversionFunnel(
  logs: CallLog[],
  /** When false, omit Booked and Confirmed steps. Default: true */
  showBookedSteps = true,
): ConversionFunnel {
  const leads     = logs.filter((l) => l.is_lead)
  const contacted = leads.filter(
    (l) => l.direction === 'outbound' || l.contacted_at !== null,
  )
  const qualified = leads.filter((l) => (l.lead_confidence ?? 0) >= 0.5)
  const booked    = logs.filter((l) => l.is_booked)
  const confirmed = booked.filter((l) => l.appointment_datetime !== null)

  const rawCounts  = showBookedSteps
    ? [leads.length, contacted.length, qualified.length, booked.length, confirmed.length]
    : [leads.length, contacted.length, qualified.length]
  const stepLabels = showBookedSteps
    ? ['Lead Captured', 'Contacted', 'Qualified', 'Booked', 'Confirmed']
    : ['Lead Captured', 'Contacted', 'Qualified']
  const stepKeys   = showBookedSteps
    ? ['lead_captured', 'contacted', 'qualified', 'booked', 'confirmed']
    : ['lead_captured', 'contacted', 'qualified']

  const steps: FunnelStep[] = rawCounts.map((count, i) => {
    const prevCount    = i === 0 ? null : rawCounts[i - 1]
    const rateFromPrev =
      prevCount === null ? null
      : prevCount === 0 ? 0
      : Math.round((count / prevCount) * 100)
    return {
      key:          stepKeys[i],
      label:        stepLabels[i],
      count,
      rateFromPrev,
      dropFromPrev: prevCount === null ? 0 : prevCount - count,
    }
  })

  const totalLeads  = leads.length
  const overallRate = totalLeads === 0 ? 0 : Math.round((booked.length / totalLeads) * 100)

  return { steps, overallRate, totalLeads }
}

// ── Period summary ──────────────────────────────────────────────────────────

export interface PeriodSummary {
  callsHandled: number
  leadsGenerated: number
  booked: number
  /** Sum of booked_value */
  revenue: number
  /** Sum of potential_revenue */
  potentialRevenue: number
  /** Sum of duration_seconds converted to hours */
  hoursSaved: number
  followUpsNeeded: number
  avgDurationSec: number
}

/**
 * Compute a summary for a rolling window of logs.
 *
 * @param logs      Full log array (all time)
 * @param daysAgo   How many days back the window starts (exclusive)
 * @param windowLen Number of days the window spans
 *
 * Example: computePeriodSummary(logs, 0, 7)  → last 7 days
 *          computePeriodSummary(logs, 7, 7)  → prior 7 days
 */
export function computePeriodSummary(
  logs: CallLog[],
  daysAgo: number,
  windowLen: number,
): PeriodSummary {
  const now       = Date.now()
  const MS_PER_DAY = 86_400_000
  const windowEnd  = now - daysAgo * MS_PER_DAY
  const windowStart = windowEnd - windowLen * MS_PER_DAY

  const period = logs.filter((l) => {
    const ts = Date.parse(l.created_at)
    return ts >= windowStart && ts < windowEnd
  })

  const totalDuration = period.reduce((s, l) => s + (l.duration_seconds ?? 0), 0)

  return {
    callsHandled:    period.length,
    leadsGenerated:  period.filter((l) => l.is_lead).length,
    booked:          period.filter((l) => l.is_booked).length,
    revenue:         period.reduce((s, l) => s + (l.booked_value ?? 0), 0),
    potentialRevenue: period.reduce((s, l) => s + (l.potential_revenue ?? 0), 0),
    hoursSaved:      totalDuration / 3600,
    followUpsNeeded: period.filter((l) => l.human_followup_needed).length,
    avgDurationSec:  period.length === 0 ? 0 : totalDuration / period.length,
  }
}

/**
 * Return a percentage delta string vs a prior period, e.g. "+12%" or "−5%".
 * Returns null when the baseline is zero (avoid division by zero).
 */
export function formatDelta(current: number, previous: number): { label: string; positive: boolean } | null {
  if (previous === 0) return null
  const delta = Math.round(((current - previous) / previous) * 100)
  return {
    label:    delta >= 0 ? `+${delta}%` : `${delta}%`,
    positive: delta >= 0,
  }
}
