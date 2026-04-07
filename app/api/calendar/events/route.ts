/**
 * GET /api/calendar/events — Proxy Google Calendar events for the tenant.
 *
 * Uses MCP Google Calendar integration server-side.
 * For now, returns booked appointments from call_logs as calendar events
 * since we have freeBusyReader access (not full event details).
 *
 * Query params:
 *   ?start=2026-04-07&end=2026-04-14&clientId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  // Get booked calls as calendar events
  let query = supabase
    .from('call_logs')
    .select('id, caller_name, caller_phone, created_at, booked_value, call_summary, direction, disposition')
    .eq('client_id', clientId)
    .eq('is_booked', true)
    .order('created_at', { ascending: true })

  if (start) query = query.gte('created_at', `${start}T00:00:00Z`)
  if (end) query = query.lte('created_at', `${end}T23:59:59Z`)

  const { data, error } = await query.limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Transform to calendar-friendly format
  const events = (data ?? []).map((row) => ({
    id: row.id,
    title: `${row.caller_name || 'Patient'} — $${row.booked_value || 0}`,
    start: row.created_at,
    phone: row.caller_phone,
    value: row.booked_value,
    summary: row.call_summary,
    direction: row.direction,
    disposition: row.disposition,
  }))

  return NextResponse.json({ events })
}
