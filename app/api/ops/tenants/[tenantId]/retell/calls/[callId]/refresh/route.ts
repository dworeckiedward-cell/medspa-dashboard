/**
 * GET /api/ops/tenants/[tenantId]/retell/calls/[callId]/refresh
 *
 * Re-fetches a single call from Retell API by its Retell call_id,
 * normalizes, and upserts into call_logs for the given tenant.
 *
 * Auth (two paths):
 *   1. Operator session (resolveOperatorAccess)
 *   2. Server key header (x-ops-key / Authorization: Bearer)
 */

import { NextResponse } from 'next/server'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { verifyOpsServerKey } from '@/lib/ops/server-key-auth'
import { logOperatorAction } from '@/lib/ops/audit'
import { getCall } from '@/lib/retell/api'
import { ingestRetellCall } from '@/lib/retell/ingest'

export const dynamic = 'force-dynamic'

const DEBUG = process.env.DEBUG_OPS === 'true'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; callId: string }> },
) {
  // ── Auth: operator session (primary) ────────────────────────────────────
  const access = await resolveOperatorAccess()
  let authMethod: 'operator' | 'serverkey' | null = null
  let operatorId = 'unknown'
  let operatorEmail: string | null = null

  if (access.authorized) {
    authMethod = 'operator'
    operatorId = access.userId ?? 'unknown'
    operatorEmail = access.email
  } else {
    // ── Auth: server key (secondary) ────────────────────────────────────
    const keyResult = verifyOpsServerKey(request, 'calls/refresh')
    if (keyResult.missingSecret) {
      return NextResponse.json(
        { error: 'Server misconfiguration: OPS_WEBHOOK_SECRET is not set' },
        { status: 500 },
      )
    }
    if (keyResult.valid) {
      authMethod = 'serverkey'
      operatorId = 'server-key'
    }
  }

  if (DEBUG) {
    console.log(`[ops-auth] route=calls/refresh auth=${authMethod ?? 'none'} ok=${!!authMethod}`)
  }

  if (!authMethod) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      operatorId,
      operatorEmail,
      action: 'retell_call_refreshed',
      targetClientId: tenantId,
      metadata: { retellCallId: callId, callLogId: result.callLogId, authMethod },
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
