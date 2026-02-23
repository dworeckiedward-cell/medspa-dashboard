/**
 * POST /api/ops/tenants/[tenantId]/retell/backfill?days=30
 *
 * Fetches calls from Retell API for the given tenant, normalizes them
 * via ingestRetellCall(), and upserts into call_logs.
 *
 * Auth (two paths):
 *   1. Operator session (resolveOperatorAccess)
 *   2. Server key header (x-ops-key / Authorization: Bearer)
 *
 * Query params:
 *   days  — how many days back to fetch (default 30, max 90)
 *   limit — max calls per page (default 50, max 200)
 */

import { NextResponse } from 'next/server'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { verifyOpsServerKey } from '@/lib/ops/server-key-auth'
import { logOperatorAction } from '@/lib/ops/audit'
import { listCalls } from '@/lib/retell/api'
import { ingestRetellCall } from '@/lib/retell/ingest'

export const dynamic = 'force-dynamic'

const DEBUG = process.env.DEBUG_OPS === 'true'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
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
    const keyResult = verifyOpsServerKey(request, 'backfill')
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
    console.log(`[ops-auth] route=backfill auth=${authMethod ?? 'none'} ok=${!!authMethod}`)
  }

  if (!authMethod) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tenantId } = await params
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 })
  }

  // Check RETELL_API_KEY is configured
  if (!process.env.RETELL_API_KEY) {
    return NextResponse.json(
      { error: 'RETELL_API_KEY not configured on server' },
      { status: 503 },
    )
  }

  const url = new URL(request.url)
  const days = Math.min(Number(url.searchParams.get('days') ?? 30), 90)
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200)

  try {
    let totalFetched = 0
    let totalUpserted = 0
    let totalErrors = 0
    let cursor: string | undefined

    // Paginate through Retell calls
    do {
      const page = await listCalls({ days, limit, sortOrder: 'descending', cursor })

      totalFetched += page.calls.length

      for (const call of page.calls) {
        const result = await ingestRetellCall(call, tenantId)
        if (result.ok) {
          totalUpserted++
        } else {
          totalErrors++
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[backfill] Ingest error:', result.error, call.call_id)
          }
        }
      }

      cursor = page.nextCursor
    } while (cursor)

    // Audit log
    logOperatorAction({
      operatorId,
      operatorEmail,
      action: 'retell_backfill',
      targetClientId: tenantId,
      metadata: { days, totalFetched, totalUpserted, totalErrors, authMethod },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      days,
      totalFetched,
      totalUpserted,
      totalErrors,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[backfill] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
