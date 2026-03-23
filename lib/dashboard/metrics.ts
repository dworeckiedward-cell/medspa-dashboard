import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { CallLog, DashboardMetrics, ChartDataPoint } from '@/types/database'
import { format, subDays, startOfDay, parseISO } from 'date-fns'

interface BookingRow {
  appointment_date: string
  amount_cents: number
  payment_status: string
  created_at: string
}

// ── Junk / meaningful call classification ────────────────────────────────────

/** Disconnect reasons that indicate a non-meaningful call */
const JUNK_DISCONNECT_REASONS = new Set([
  'voicemail_reached',
  'machine_detected',
  'dial_no_answer',
  'dial_failed',
])

/** Dispositions that indicate junk/noise calls */
const JUNK_DISPOSITIONS = new Set(['voicemail', 'no_answer', 'spam'])

/**
 * A call is "meaningful" when it passes these filters:
 *  1. not a ghost row (duration=0 AND no caller_name AND no caller_phone)
 *  2. duration_seconds >= 10 (NULL = unknown = include; 0 with no caller = junk)
 *  3. [inbound only] disconnect_reason NOT in JUNK_DISCONNECT_REASONS
 *  4. [inbound only] disposition NOT in JUNK_DISPOSITIONS
 *
 * Outbound calls are never filtered for voicemail/no-answer — those are expected
 * outcomes for AI Setter calls and carry valuable activity data.
 */
export function isMeaningfulCall(call: Pick<CallLog, 'duration_seconds' | 'disconnect_reason' | 'transcript' | 'disposition' | 'direction'> & { caller_name?: string | null; caller_phone?: string | null }): boolean {
  // Ghost rows — webhook pings with no caller info and zero duration
  if (!call.duration_seconds && !call.caller_name && !call.caller_phone) return false
  // Short calls (>0 but <5s) are junk regardless of direction
  if (call.duration_seconds !== null && call.duration_seconds !== undefined && call.duration_seconds > 0 && call.duration_seconds < 5) return false
  // Outbound: voicemail/no-answer with real call time are valid outcomes to show.
  // But ghost-like records (null/0 duration + immediate failure) are noise.
  if (call.direction === 'outbound') {
    const hasNoDuration = !call.duration_seconds
    if (hasNoDuration && call.disconnect_reason && JUNK_DISCONNECT_REASONS.has(call.disconnect_reason)) return false
    if (hasNoDuration && (call.disposition === 'no_answer' || call.disposition === 'spam')) return false
    return true
  }
  // Inbound junk filters
  if (call.disconnect_reason && JUNK_DISCONNECT_REASONS.has(call.disconnect_reason)) return false
  if (call.disposition && JUNK_DISPOSITIONS.has(call.disposition)) return false
  return true
}

/**
 * Computes KPI metrics and chart series for a client over the last N days.
 * Metrics are computed from meaningful calls only (junk/voicemail/no-answer excluded).
 *
 * SECURITY: client_id is always sourced from the resolved tenant context
 * (set by middleware from subdomain/domain — never from URL params).
 */
export async function getDashboardMetrics(
  clientId: string,
  days = 30,
): Promise<DashboardMetrics> {
  const supabase = createSupabaseServerClient()

  // days === 0 means "All time" — no date filter
  const baseQuery = supabase
    .from('call_logs')
    .select(
      'id, created_at, is_booked, is_lead, duration_seconds, potential_revenue, booked_value, inquiries_value, response_time_seconds, disconnect_reason, disposition, transcript, direction, caller_name, caller_phone',
    )
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })

  const callsQueryPromise = days > 0
    ? baseQuery.gte('created_at', subDays(new Date(), days).toISOString())
    : baseQuery

  // Fetch bookings: used for KPI revenue + chart series
  // Include paid, pending_jane (Jane-managed), and pending (checkout completed)
  const bookingsQueryBase = supabase
    .from('bookings')
    .select('appointment_date, amount_cents, payment_status, created_at')
    .eq('tenant_id', clientId)
    .in('payment_status', ['paid', 'pending_jane', 'pending', 'card_saved'])

  const bookingsQueryPromise = days > 0
    ? bookingsQueryBase.gte('created_at', subDays(new Date(), days).toISOString())
    : bookingsQueryBase

  const [{ data: calls, error }, { data: bookings }] = await Promise.all([
    callsQueryPromise,
    bookingsQueryPromise,
  ])

  if (error || !calls) {
    console.error('[metrics] Failed to fetch call_logs:', error?.message)
    return emptyMetrics()
  }

  // ── Classify calls ─────────────────────────────────────────────────────────
  const totalCalls = calls.length
  const meaningful = calls.filter((c) => isMeaningfulCall(c))
  const meaningfulCalls = meaningful.length

  let voicemail = 0
  let noAnswer = 0
  let junk = 0
  for (const c of calls) {
    if (isMeaningfulCall(c)) continue
    const dr = c.disconnect_reason
    const disp = c.disposition
    if (dr === 'voicemail_reached' || dr === 'machine_detected' || disp === 'voicemail') {
      voicemail++
    } else if (dr === 'dial_no_answer' || dr === 'dial_failed' || disp === 'no_answer') {
      noAnswer++
    } else {
      junk++
    }
  }

  // ── Compute metrics from meaningful calls only ─────────────────────────────
  const bookingsList = (bookings ?? []) as BookingRow[]
  const appointmentsBooked = bookingsList.length
  const potentialRevenue = bookingsList
    .filter((b) => b.payment_status === 'paid')
    .reduce((sum, b) => sum + (b.amount_cents ?? 0) / 100, 0)
  // Sum of potential_revenue from lead calls — estimated pipeline value
  const pipelineRevenue = meaningful
    .filter((c) => c.is_lead && (c.potential_revenue ?? 0) > 0)
    .reduce((sum, c) => sum + (c.potential_revenue ?? 0), 0)
  const totalSeconds = meaningful.reduce((sum, c) => sum + (c.duration_seconds ?? 0), 0)
  const hoursSaved = Math.round((totalSeconds / 3600) * 10) / 10

  const totalLeads = meaningful.filter((c) => c.is_lead).length
  const inboundCalls = meaningful.filter((c) => c.direction === 'inbound').length
  const outboundSetterCalls = meaningful.filter((c) => c.direction === 'outbound').length
  const leadConversionRate =
    totalLeads > 0 ? Math.round((appointmentsBooked / totalLeads) * 100) : 0

  const speedValues = meaningful
    .map((c) => c.response_time_seconds as number | null)
    .filter((v): v is number => v !== null && v > 0)
  const avgSpeedSec = speedValues.length > 0
    ? speedValues.reduce((s, v) => s + v, 0) / speedValues.length
    : null

  return {
    appointmentsBooked,
    potentialRevenue,
    pipelineRevenue,
    hoursSaved,
    leadConversionRate,
    avgSpeedSec,
    chartSeries: buildChartSeries(meaningful, days, (bookings ?? []) as BookingRow[]),
    totalCalls,
    meaningfulCalls,
    totalLeads,
    inboundCalls,
    outboundSetterCalls,
    callBreakdown: {
      answered: meaningfulCalls,
      voicemail,
      noAnswer,
      junk,
    },
  }
}

function buildChartSeries(
  calls: Array<
    Pick<CallLog, 'created_at' | 'inquiries_value' | 'booked_value' | 'potential_revenue' | 'is_lead'>
  >,
  days: number,
  bookings: BookingRow[] = [],
): ChartDataPoint[] {
  // For "All time" (days === 0), derive range from earliest call
  const effectiveDays =
    days > 0
      ? days
      : calls.length > 0
        ? Math.ceil((Date.now() - Date.parse(calls[0].created_at)) / 86_400_000) + 1
        : 30

  // Pre-fill all days so the x-axis is continuous even with gaps
  const map = new Map<string, ChartDataPoint>()
  for (let i = effectiveDays - 1; i >= 0; i--) {
    const d = startOfDay(subDays(new Date(), i))
    const key = format(d, 'yyyy-MM-dd')
    map.set(key, { date: format(d, 'MMM dd'), inquiries: 0, booked: 0, potential: 0 })
  }

  for (const call of calls) {
    try {
      const key = format(parseISO(call.created_at), 'yyyy-MM-dd')
      const point = map.get(key)
      if (point) {
        point.inquiries += call.inquiries_value ?? 0
        // Only count potential_revenue from lead calls with a non-zero estimate
        if (call.is_lead && (call.potential_revenue ?? 0) > 0) {
          point.potential += call.potential_revenue ?? 0
        }
        // Only use call_logs booked_value when there are no real booking records
        if (bookings.length === 0) {
          point.booked += call.booked_value ?? 0
        }
      }
    } catch {
      // Skip malformed timestamps
    }
  }

  // Overlay real paid booking amounts from the bookings table (amount_cents → dollars)
  // Use created_at date (when booking was made) so future appointments still appear in chart
  for (const booking of bookings) {
    try {
      const bookingKey = format(parseISO(booking.created_at), 'yyyy-MM-dd')
      const point = map.get(bookingKey)
      if (point) {
        point.booked += (booking.amount_cents ?? 0) / 100
      }
    } catch {
      // Skip malformed timestamps
    }
  }

  return Array.from(map.values())
}

function emptyMetrics(): DashboardMetrics {
  return {
    appointmentsBooked: 0,
    potentialRevenue: 0,
    pipelineRevenue: 0,
    hoursSaved: 0,
    leadConversionRate: 0,
    avgSpeedSec: null,
    chartSeries: [],
    totalCalls: 0,
    meaningfulCalls: 0,
    totalLeads: 0,
    inboundCalls: 0,
    outboundSetterCalls: 0,
    callBreakdown: { answered: 0, voicemail: 0, noAnswer: 0, junk: 0 },
  }
}

/**
 * Fetches paginated call logs for the dashboard table.
 * SECURITY: client_id always from resolved tenant — never from user input.
 */
export async function getCallLogs(
  clientId: string,
  options: {
    limit?: number
    offset?: number
    callType?: string
    isBooked?: boolean
    search?: string
  } = {},
): Promise<{ data: CallLog[]; count: number }> {
  const supabase = createSupabaseServerClient()
  const { limit = 100, offset = 0, callType, isBooked, search } = options

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('call_logs')
    .select('*', { count: 'exact' })
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (callType && callType !== 'all') {
    query = query.eq('call_type', callType)
  }
  if (typeof isBooked === 'boolean') {
    query = query.eq('is_booked', isBooked)
  }
  if (search) {
    query = query.or(
      `semantic_title.ilike.%${search}%,caller_name.ilike.%${search}%,caller_phone.ilike.%${search}%`,
    )
  }

  const { data, error, count } = await query

  if (error) {
    console.error('[metrics] getCallLogs error:', error?.message)
    return { data: [], count: 0 }
  }

  return { data: (data ?? []) as CallLog[], count: count ?? 0 }
}

/**
 * Fetch a single call log by ID, scoped to a specific tenant.
 * Returns null if not found or not authorized.
 */
export async function getCallLogById(
  clientId: string,
  callLogId: string,
): Promise<CallLog | null> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('call_logs')
    .select('*')
    .eq('id', callLogId)
    .eq('client_id', clientId)
    .maybeSingle()

  if (error) {
    console.error('[metrics] getCallLogById error:', error.message)
    return null
  }

  return data as CallLog | null
}
