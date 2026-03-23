/**
 * POST /api/ops/ai/tag-recent-calls?hours=24
 *
 * Batch-tags recent call logs that don't have AI tags yet.
 * Designed to be called by an external cron (hourly or daily).
 *
 * Auth: OPS_WEBHOOK_SECRET only (x-ops-key or Authorization: Bearer).
 *
 * Query params:
 *   hours — how far back to look (default 24, max 168)
 *
 * Returns: { processed, cached, errors, skipped, details[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyOpsServerKey } from '@/lib/ops/server-key-auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAiProvider } from '@/lib/ai/provider'
import { buildCallInput } from '@/lib/ai/input'
import {
  hashInput,
  shouldProcess,
  persistCallAiResult,
  acquireConcurrencySlot,
} from '@/lib/ai/jobs'
import type { CallLog } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // ── Auth: server key only ─────────────────────────────────────────────────
  const keyResult = verifyOpsServerKey(request, 'tag-recent-calls')
  if (keyResult.missingSecret) {
    return NextResponse.json(
      { error: 'Server misconfiguration: OPS_WEBHOOK_SECRET is not set' },
      { status: 500 },
    )
  }
  if (!keyResult.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse hours ───────────────────────────────────────────────────────────
  const hoursParam = request.nextUrl.searchParams.get('hours')
  const hours = Math.min(Math.max(Number(hoursParam) || 24, 1), 168)

  // ── Fetch recent calls across all tenants ─────────────────────────────────
  const supabase = createSupabaseServerClient()
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  const { data: calls, error: callsErr } = await supabase
    .from('call_logs')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500)

  if (callsErr || !calls) {
    return NextResponse.json(
      { error: 'Failed to fetch call logs', details: callsErr?.message },
      { status: 500 },
    )
  }

  // ── Filter to calls missing AI tags ────────────────────────────────────────
  const untagged = (calls as CallLog[]).filter((log) => {
    const raw = log.raw_payload as Record<string, unknown> | null
    if (!raw) return true
    const aiModules = raw.ai_modules as Record<string, unknown> | undefined
    return !aiModules?.tags
  })

  // ── Process each call (concurrency 1–2) ───────────────────────────────────
  const details: Array<{
    callLogId: string
    clientId: string
    status: 'tagged' | 'cached' | 'error'
    error?: string
  }> = []
  let processed = 0
  let cached = 0
  let errors = 0

  for (const log of untagged) {
    const release = await acquireConcurrencySlot()
    try {
      const input = buildCallInput(log)
      const inputHash = hashInput(input.text)

      // Check if already processed with same hash
      if (!shouldProcess(log, 'tags', inputHash)) {
        cached++
        details.push({ callLogId: log.id, clientId: log.client_id, status: 'cached' })
        continue
      }

      const provider = await getAiProvider()
      const tags = await provider.generateTags(input.text)

      await persistCallAiResult(
        log.id,
        'tags',
        tags as unknown as Record<string, unknown>,
        inputHash,
        provider.name,
      )

      processed++
      details.push({ callLogId: log.id, clientId: log.client_id, status: 'tagged' })
    } catch (err) {
      errors++
      details.push({
        callLogId: log.id,
        clientId: log.client_id,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      release()
    }
  }

  return NextResponse.json({
    processed,
    cached,
    errors,
    skipped: calls.length - untagged.length,
    totalCalls: calls.length,
    untaggedCalls: untagged.length,
    hours,
    details,
  })
}
