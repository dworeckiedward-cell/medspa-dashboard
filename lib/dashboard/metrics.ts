import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { CallLog, DashboardMetrics, ChartDataPoint } from '@/types/database'
import { format, subDays, startOfDay, parseISO } from 'date-fns'

/**
 * Computes KPI metrics and chart series for a client over the last N days.
 *
 * SECURITY: client_id is always sourced from the resolved tenant context
 * (set by middleware from subdomain/domain — never from URL params).
 *
 * TODO: Add Supabase RLS policy once auth is wired:
 *   CREATE POLICY "tenant_isolation" ON call_logs
 *   USING (client_id = (SELECT id FROM clients WHERE slug = auth.jwt() ->> 'tenant_slug'));
 */
export async function getDashboardMetrics(
  clientId: string,
  days = 30,
): Promise<DashboardMetrics> {
  const supabase = createSupabaseServerClient()
  const since = subDays(new Date(), days).toISOString()

  const { data: calls, error } = await supabase
    .from('call_logs')
    .select(
      'id, created_at, is_booked, is_lead, duration_seconds, potential_revenue, booked_value, inquiries_value',
    )
    .eq('client_id', clientId)
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  if (error || !calls) {
    console.error('[metrics] Failed to fetch call_logs:', error?.message)
    return emptyMetrics()
  }

  const appointmentsBooked = calls.filter((c) => c.is_booked).length
  const potentialRevenue = calls.reduce((sum, c) => sum + (c.potential_revenue ?? 0), 0)
  const totalSeconds = calls.reduce((sum, c) => sum + (c.duration_seconds ?? 0), 0)
  const hoursSaved = Math.round((totalSeconds / 3600) * 10) / 10

  const totalLeads = calls.filter((c) => c.is_lead).length
  const leadConversionRate =
    totalLeads > 0 ? Math.round((appointmentsBooked / totalLeads) * 100) : 0

  return {
    appointmentsBooked,
    potentialRevenue,
    hoursSaved,
    leadConversionRate,
    chartSeries: buildChartSeries(calls, days),
  }
}

function buildChartSeries(
  calls: Array<
    Pick<CallLog, 'created_at' | 'inquiries_value' | 'booked_value' | 'potential_revenue'>
  >,
  days: number,
): ChartDataPoint[] {
  // Pre-fill all days so the x-axis is continuous even with gaps
  const map = new Map<string, ChartDataPoint>()
  for (let i = days - 1; i >= 0; i--) {
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
        point.booked += call.booked_value ?? 0
        point.potential += call.potential_revenue ?? 0
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
    hoursSaved: 0,
    leadConversionRate: 0,
    chartSeries: [],
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
