/**
 * FB Leads dashboard metrics — computed from call_logs.
 *
 * Uses existing call_logs fields + migration-027 FB fields:
 *   lead_source = 'facebook'       → FB lead
 *   response_time_seconds          → speed-to-lead
 *   lead_cost_cents                → cost per lead
 *   is_booked                      → converted
 *   booked_value                   → revenue attribution
 */

import type { CallLog } from '@/types/database'

export interface FbLeadsChartPoint {
  date: string         // 'YYYY-MM-DD'
  newLeads: number
  contacted: number
  booked: number
}

export interface FbLeadsMetrics {
  /** Total FB leads in range */
  newLeads: number
  /** Leads where duration_seconds > 0 (agent actually spoke) */
  contacted: number
  /** Leads that resulted in a booking */
  booked: number
  /** Average response_time_seconds across leads with data; null if no data */
  avgSpeedToLeadSec: number | null
  /** Average lead_cost_cents across leads with data; null if no data */
  costPerLeadCents: number | null
  /** Sum of all lead_cost_cents in range */
  totalAdSpendCents: number
  /** (booked / newLeads) × 100; 0 when no leads */
  leadConversionRate: number
  /** ((booked_value_total - totalAdSpend) / totalAdSpend) × 100; null if no spend */
  adROI: number | null
  /** Total booked revenue in range (sum of booked_value) */
  bookedRevenue: number
  /** Daily breakdown for charts */
  chartSeries: FbLeadsChartPoint[]
  /** Most recent FB leads (max 50) */
  recentLeads: CallLog[]
}

function isFbLead(c: CallLog): boolean {
  return c.lead_source === 'facebook'
}

/**
 * @param callLogs  Full set of call logs fetched for this tenant.
 * @param rangeDays Optional window in days. When provided, only calls within
 *                  the last `rangeDays` days are included in the metrics.
 */
export function computeFbLeadsMetrics(callLogs: CallLog[], rangeDays?: number): FbLeadsMetrics {
  const since = rangeDays
    ? new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  const fbLeads = callLogs.filter(
    (c) => isFbLead(c) && (!since || c.created_at >= since),
  )

  const contacted = fbLeads.filter((c) => (c.duration_seconds ?? 0) > 0)
  const booked = fbLeads.filter((c) => c.is_booked)

  const newLeadsCount = fbLeads.length
  const contactedCount = contacted.length
  const bookedCount = booked.length

  // Speed-to-lead: average of response_time_seconds across leads that have it
  const speedValues = fbLeads
    .map((c) => c.response_time_seconds)
    .filter((v): v is number => v !== null && v !== undefined && v > 0)
  const avgSpeedToLeadSec = speedValues.length > 0
    ? Math.round(speedValues.reduce((s, v) => s + v, 0) / speedValues.length)
    : null

  // Cost per lead: average of lead_cost_cents across leads that have it
  const costValues = fbLeads
    .map((c) => c.lead_cost_cents)
    .filter((v): v is number => v !== null && v !== undefined && v > 0)
  const totalAdSpendCents = costValues.reduce((s, v) => s + v, 0)
  const costPerLeadCents = costValues.length > 0
    ? Math.round(totalAdSpendCents / costValues.length)
    : null

  // Conversion rate
  const leadConversionRate = newLeadsCount > 0
    ? Math.round((bookedCount / newLeadsCount) * 100)
    : 0

  // Revenue & ROI
  const bookedRevenue = booked.reduce((sum, c) => sum + (c.booked_value ?? 0), 0)
  const adROI = totalAdSpendCents > 0
    ? Math.round(((bookedRevenue * 100 - totalAdSpendCents) / totalAdSpendCents) * 100)
    : null

  // Chart series: group by day
  const dayMap = new Map<string, FbLeadsChartPoint>()
  for (const lead of fbLeads) {
    const day = lead.created_at.slice(0, 10)
    const entry = dayMap.get(day) ?? { date: day, newLeads: 0, contacted: 0, booked: 0 }
    entry.newLeads++
    if ((lead.duration_seconds ?? 0) > 0) entry.contacted++
    if (lead.is_booked) entry.booked++
    dayMap.set(day, entry)
  }
  const chartSeries = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  // Recent leads (most recent first)
  const recentLeads = fbLeads
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 50)

  return {
    newLeads: newLeadsCount,
    contacted: contactedCount,
    booked: bookedCount,
    avgSpeedToLeadSec,
    costPerLeadCents,
    totalAdSpendCents,
    leadConversionRate,
    adROI,
    bookedRevenue,
    chartSeries,
    recentLeads,
  }
}
