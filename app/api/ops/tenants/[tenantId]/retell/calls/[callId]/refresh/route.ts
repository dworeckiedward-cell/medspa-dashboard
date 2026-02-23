/**
 * GET /api/ops/tenants/[tenantId]/retell/calls/[callId]/refresh
 *
 * Operator-only. Re-fetches a single call from Retell API by its Retell
 * call_id, normalizes, and upserts into call_logs for the given tenant.
 */

import { NextResponse } from 'next/server'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { logOperatorAction } from '@/lib/ops/audit'
import { getCall } from '@/lib/retell/api'
import { ingestRetellCall } from '@/lib/retell/ingest'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string; callId: string }> },
) {
  const access = await resolveOperatorAccess()
  if (!access.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { tenantId, callId } = await params
  if (!tenantId || !callId) {
    return NextResponse.json({ error: 'Tenant ID and Call ID required' }, { status: 400 })
  }

  if (!process.env.RETELL_API_KEY) {
    return NextResponse.json(
      { error: 'RETELL_API_KEY not configured on server' },
      { status: 503 },
    )
  }

  try {
    // Fetch fresh data from Retell
    const call = await getCall(callId)

    // Ingest into our DB
    const result = await ingestRetellCall(call, tenantId)

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? 'Ingest failed' },
        { status: 500 },
      )
    }

    // Audit log
    logOperatorAction({
      operatorId: access.userId ?? 'unknown',
      operatorEmail: access.email,
      action: 'retell_call_refreshed',
      targetClientId: tenantId,
      metadata: { retellCallId: callId, callLogId: result.callLogId },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      callLogId: result.callLogId,
      retellCallId: callId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[calls/refresh] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
