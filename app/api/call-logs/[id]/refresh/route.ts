import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getCall } from '@/lib/retell/api'
import { ingestRetellCall } from '@/lib/retell/ingest'

export const dynamic = 'force-dynamic'

/**
 * POST /api/call-logs/[id]/refresh
 *
 * Re-fetches a call from Retell API and upserts into call_logs.
 * Used by the "Refresh Call Recording" button in the call detail panel.
 * Requires tenant session auth (not ops auth).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createSupabaseServerClient()

  // Look up the call log to get external_call_id, and verify it belongs to this tenant
  const { data: callLog, error: fetchError } = await supabase
    .from('call_logs')
    .select('id, external_call_id, client_id')
    .eq('id', params.id)
    .eq('client_id', tenant.id)
    .maybeSingle()

  if (fetchError || !callLog) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 })
  }

  if (!callLog.external_call_id) {
    return NextResponse.json({ error: 'No Retell call ID on this record' }, { status: 400 })
  }

  if (!process.env.RETELL_API_KEY) {
    return NextResponse.json({ error: 'Retell API not configured' }, { status: 503 })
  }

  try {
    const call = await getCall(callLog.external_call_id)
    const result = await ingestRetellCall(call, tenant.id)

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Ingest failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, callLogId: result.callLogId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[call-logs/refresh]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
