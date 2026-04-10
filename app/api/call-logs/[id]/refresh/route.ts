import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getCall, listCalls, type RetellCall } from '@/lib/retell/api'
import { ingestRetellCall } from '@/lib/retell/ingest'

export const dynamic = 'force-dynamic'

/**
 * POST /api/call-logs/[id]/refresh
 *
 * Re-fetches a call from Retell API and updates the call_log row with
 * recording_url, transcript, summary, etc.
 *
 * Supports two kinds of rows:
 *   1. Direct Retell rows (external_call_id starts with "call_") — fetches
 *      that exact call from Retell and upserts.
 *   2. Synthetic booking rows from /api/ingest (external_call_id starts with
 *      "gcal-" or "appt-") — there is no direct Retell mapping, so we look up
 *      the most recent Retell call for this phone within a 24h window and
 *      merge its recording_url / transcript / summary into the existing row.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createSupabaseServerClient()

  // Look up the call log (full row — we need phone/contacted_at for the fallback lookup)
  const { data: callLog, error: fetchError } = await supabase
    .from('call_logs')
    .select('id, external_call_id, client_id, caller_phone, contacted_at, created_at')
    .eq('id', params.id)
    .eq('client_id', tenant.id)
    .maybeSingle()

  if (fetchError || !callLog) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 })
  }

  if (!process.env.RETELL_API_KEY) {
    return NextResponse.json({ error: 'Retell API not configured' }, { status: 503 })
  }

  const extId = (callLog.external_call_id ?? '') as string
  const isRetellDirect = extId.startsWith('call_')

  try {
    console.log('[call-logs/refresh] START', { callLogId: params.id, external_call_id: extId, tenantId: tenant.id, isRetellDirect })

    // ── Path 1: direct Retell row → fetch by call_id and upsert through ingest
    if (isRetellDirect) {
      const call = await getCall(extId)
      console.log('[call-logs/refresh] direct Retell fetch', {
        call_id: call.call_id,
        has_recording_url: !!call.recording_url,
        duration_ms: call.duration_ms,
      })
      const result = await ingestRetellCall(call, tenant.id)
      if (!result.ok) {
        console.error('[call-logs/refresh] INGEST FAILED', { error: result.error, callLogId: params.id })
        return NextResponse.json({ error: result.error ?? 'Ingest failed', stage: 'ingest' }, { status: 500 })
      }
      return NextResponse.json({ ok: true, callLogId: result.callLogId, recording_url: call.recording_url ?? null, mode: 'direct' })
    }

    // ── Path 2: synthetic booking row (gcal-* / appt-*) → look up Retell call by phone+time
    if (!callLog.caller_phone) {
      return NextResponse.json({ error: 'No phone number on this booking — cannot find matching Retell call', stage: 'lookup' }, { status: 400 })
    }

    // Normalize anchor time (prefer contacted_at, fallback to created_at)
    const anchorIso = (callLog.contacted_at ?? callLog.created_at) as string | null
    const anchorMs = anchorIso ? new Date(anchorIso).getTime() : Date.now()
    // Look up to 48h before/after the booking timestamp (calendar event time may be days later)
    const lowerMs = anchorMs - 48 * 60 * 60 * 1000
    const upperMs = anchorMs + 48 * 60 * 60 * 1000

    console.log('[call-logs/refresh] lookup retell calls by phone', {
      phone: callLog.caller_phone,
      lowerMs,
      upperMs,
    })

    // Query both directions (to_number for outbound, from_number for inbound)
    const [outboundRes, inboundRes] = await Promise.all([
      listCalls({
        limit: 50,
        sortOrder: 'descending',
        filterCriteria: {
          to_number: [callLog.caller_phone],
          start_timestamp: { lower_threshold: lowerMs, upper_threshold: upperMs },
        },
      }),
      listCalls({
        limit: 50,
        sortOrder: 'descending',
        filterCriteria: {
          from_number: [callLog.caller_phone],
          start_timestamp: { lower_threshold: lowerMs, upper_threshold: upperMs },
        },
      }),
    ])

    const candidates: RetellCall[] = [...outboundRes.calls, ...inboundRes.calls]
      // Must have an actual recording — skip 0-duration failures and voicemails without audio
      .filter((c) => !!c.recording_url)
      // Prefer calls that actually had a conversation
      .sort((a, b) => (b.duration_ms ?? 0) - (a.duration_ms ?? 0))

    console.log('[call-logs/refresh] candidates found', {
      total: candidates.length,
      outbound: outboundRes.calls.length,
      inbound: inboundRes.calls.length,
    })

    const match = candidates[0]
    if (!match) {
      return NextResponse.json(
        { error: 'No matching Retell call with a recording found for this phone in the booking window (±48h)', stage: 'no_match' },
        { status: 404 },
      )
    }

    console.log('[call-logs/refresh] matched retell call', {
      call_id: match.call_id,
      duration_ms: match.duration_ms,
      has_recording_url: !!match.recording_url,
    })

    // Merge recording/transcript/summary onto the existing gcal-*/appt-* row.
    // We do NOT change external_call_id — keep the booking row's identity stable.
    const analysis = (match.call_analysis ?? {}) as Record<string, unknown>
    const callSummary = typeof analysis.call_summary === 'string' ? analysis.call_summary : null
    const cad = (analysis.custom_analysis_data ?? {}) as Record<string, unknown>

    const updatePayload: Record<string, unknown> = {
      recording_url: match.recording_url ?? null,
      transcript: match.transcript ?? null,
      ...(callSummary ? { call_summary: callSummary, summary: callSummary, ai_summary: callSummary } : {}),
      ai_summary_json: Object.keys(cad).length > 0 ? cad : analysis,
      updated_at: new Date().toISOString(),
    }
    // Backfill duration if the synthetic row has 0
    if (typeof match.duration_ms === 'number' && match.duration_ms > 0) {
      updatePayload.duration_seconds = Math.round(match.duration_ms / 1000)
    }

    const { error: updateError } = await supabase
      .from('call_logs')
      .update(updatePayload)
      .eq('id', params.id)
      .eq('client_id', tenant.id)

    if (updateError) {
      console.error('[call-logs/refresh] UPDATE ERROR', {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code,
      })
      return NextResponse.json({ error: `update: ${updateError.message}`, stage: 'update' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      mode: 'lookup',
      matched_retell_call_id: match.call_id,
      recording_url: match.recording_url,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[call-logs/refresh] EXCEPTION', message, stack)
    return NextResponse.json({ error: message, stage: 'exception' }, { status: 500 })
  }
}
