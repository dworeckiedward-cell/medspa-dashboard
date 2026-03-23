/**
 * Outbound dashboard metrics — computed from call_logs.
 *
 * Uses existing call_logs fields (no extra DB queries):
 *   direction        = 'outbound'           → calls made
 *   duration_seconds > 30                   → contacted
 *   lead_confidence >= 0.6 || is_lead       → qualified
 *   is_booked                               → booked
 */

import type { CallLog } from '@/types/database'

export interface OutboundChartPoint {
  date: string         // 'YYYY-MM-DD'
  calls: number
  contacted: number
  qualified: number
  booked: number
}

export interface OutboundMetrics {
  callsMade: number
  contacted: number
  qualified: number
  booked: number
  /** contacted / callsMade × 100, 0 when no calls */
  contactRate: number
  /** qualified / contacted × 100, 0 when no contacts */
  qualifyRate: number
  /** booked / contacted × 100, 0 when no contacts */
  bookingRate: number
  chartSeries: OutboundChartPoint[]
  recentCalls: CallLog[]   // outbound calls only, most recent first
}

function isContacted(c: CallLog): boolean {
  return (c.duration_seconds ?? 0) > 30
}

function isQualified(c: CallLog): boolean {
  return (c.lead_confidence ?? 0) >= 0.6 || c.is_lead
}

/**
 * @param callLogs  Full set of call logs fetched for this tenant.
 * @param rangeDays Optional window in days. When provided, only calls within
 *                  the last `rangeDays` days are included in the metrics.
 *                  Pass undefined (default) to include all logs.
 */
export function computeOutboundMetrics(callLogs: CallLog[], rangeDays?: number): OutboundMetrics {
  const since = rangeDays
    ? new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  const outbound = callLogs.filter(
    (c) => c.direction === 'outbound' && (!since || c.created_at >= since),
  )
  const contacted = outbound.filter(isContacted)
  const qualified = outbound.filter(isQualified)
  const booked = outbound.filter((c) => c.is_booked)

  const callsMade = outbound.length
  const contactedCount = contacted.length
  const qualifiedCount = qualified.length
  const bookedCount = booked.length

  const contactRate = callsMade > 0 ? Math.round((contactedCount / callsMade) * 100) : 0
  const qualifyRate = contactedCount > 0 ? Math.round((qualifiedCount / contactedCount) * 100) : 0
  const bookingRate = contactedCount > 0 ? Math.round((bookedCount / contactedCount) * 100) : 0

  // Group by day (YYYY-MM-DD) — sorted ascending
  const dayMap = new Map<string, OutboundChartPoint>()
  for (const call of outbound) {
    const day = call.created_at.slice(0, 10)
    const entry = dayMap.get(day) ?? { date: day, calls: 0, contacted: 0, qualified: 0, booked: 0 }
    entry.calls++
    if (isContacted(call)) entry.contacted++
    if (isQualified(call)) entry.qualified++
    if (call.is_booked) entry.booked++
    dayMap.set(day, entry)
  }
  const chartSeries = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  // Most recent outbound calls (already ordered desc from getCallLogs)
  const recentCalls = outbound.slice(0, 50)

  return {
    callsMade,
    contacted: contactedCount,
    qualified: qualifiedCount,
    booked: bookedCount,
    contactRate,
    qualifyRate,
    bookingRate,
    chartSeries,
    recentCalls,
  }
}
