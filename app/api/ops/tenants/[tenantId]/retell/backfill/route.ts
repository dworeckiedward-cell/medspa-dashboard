/**
 * POST /api/ops/tenants/[tenantId]/retell/backfill?days=30
 *
 * Fetches calls from Retell API for the given tenant, normalizes them
 * via ingestRetellCall(), and upserts into call_logs.
 *
 * Enrichment: when a call from listCalls() is missing recording_url,
 * transcript, or call_analysis.call_summary, we fetch the full call
 * via getCall() to get the complete data (Retell may populate these
 * fields asynchronously after the call ends).
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
import { listCalls, getCall, type RetellCall } from '@/lib/retell/api'
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
    let totalEnriched = 0
    let totalErrors = 0
    let cursor: string | undefined

    // Build filter_criteria as a plain object (Retell rejects arrays)
    const startTimestampMs = Date.now() - days * 86_400_000
    const filterCriteria = { start_timestamp_ms: startTimestampMs }

    // Paginate through Retell calls
    do {
      const page = await listCalls({ limit, filterCriteria, sortOrder: 'descending', cursor })

      totalFetched += page.calls.length

      // Process calls with concurrency limit of 3
      const CONCURRENCY = 3
      for (let i = 0; i < page.calls.length; i += CONCURRENCY) {
        const batch = page.calls.slice(i, i + CONCURRENCY)
        const results = await Promise.allSettled(
          batch.map(async (call) => {
            let enriched = false
            let finalCall: RetellCall = call

            // Enrich via getCall() if list response is missing key fields
            const needsEnrich =
              !call.recording_url ||
              !call.transcript ||
              !call.call_analysis?.call_summary

            if (needsEnrich && call.call_id) {
              try {
                finalCall = await getCall(call.call_id)
                enriched = true
              } catch {
                // getCall failed — proceed with partial data from list
                finalCall = call
              }
            }

            const result = await ingestRetellCall(finalCall, tenantId)
            return { result, enriched }
          }),
        )

        for (const settled of results) {
          if (settled.status === 'fulfilled') {
            if (settled.value.result.ok) {
              totalUpserted++
              if (settled.value.enriched) totalEnriched++
            } else {
              totalErrors++
              if (DEBUG) {
                console.warn('[backfill] Ingest error:', settled.value.result.error)
              }
            }
          } else {
            totalErrors++
            if (DEBUG) {
              console.warn('[backfill] Promise rejected:', settled.reason)
            }
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
      metadata: { days, totalFetched, totalUpserted, totalEnriched, totalErrors, authMethod },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      days,
      totalFetched,
      totalUpserted,
      totalEnriched,
      totalErrors,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[backfill] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
