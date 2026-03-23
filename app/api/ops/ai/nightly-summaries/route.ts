/**
 * POST /api/ops/ai/nightly-summaries
 *
 * Generates executive summaries for all active tenants.
 * Designed to be called by an external cron (VPS / GitHub Actions).
 *
 * Auth: OPS_WEBHOOK_SECRET only (x-ops-key or Authorization: Bearer).
 *
 * Body (optional): { rangeDays?: number[] }
 *   Default: [7]
 *   Example: [7, 30]
 *
 * Returns: { processed, cached, errors, details[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyOpsServerKey } from '@/lib/ops/server-key-auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCallLogs } from '@/lib/dashboard/metrics'
import { getAiProvider, type SummaryOutput } from '@/lib/ai/provider'
import { buildSummaryInput } from '@/lib/ai/input'
import { hashInput, acquireConcurrencySlot } from '@/lib/ai/jobs'
import { readTenantSummary, writeTenantSummary } from '@/lib/ai/tenant-summary-store'

export const dynamic = 'force-dynamic'

const VALID_RANGES = new Set([7, 30, 45, 60, 365])

export async function POST(request: NextRequest) {
  // ── Auth: server key only ─────────────────────────────────────────────────
  const keyResult = verifyOpsServerKey(request, 'nightly-summaries')
  if (keyResult.missingSecret) {
    return NextResponse.json(
      { error: 'Server misconfiguration: OPS_WEBHOOK_SECRET is not set' },
      { status: 500 },
    )
  }
  if (!keyResult.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse ranges ──────────────────────────────────────────────────────────
  let ranges = [7]
  try {
    const body = await request.json().catch(() => ({}))
    if (Array.isArray(body.rangeDays)) {
      const valid = body.rangeDays.filter((r: unknown) => typeof r === 'number' && VALID_RANGES.has(r))
      if (valid.length > 0) ranges = valid
    }
  } catch {
    // Use defaults
  }

  // ── Fetch all active tenants ──────────────────────────────────────────────
  const supabase = createSupabaseServerClient()
  const { data: tenants, error: tenantsErr } = await supabase
    .from('tenants')
    .select('id, name, slug')
    .eq('is_active', true)
    .limit(200)

  if (tenantsErr || !tenants) {
    return NextResponse.json(
      { error: 'Failed to fetch tenants', details: tenantsErr?.message },
      { status: 500 },
    )
  }

  // ── Process each tenant sequentially (concurrency 1–2) ─────────────────
  const details: Array<{
    tenantId: string
    slug: string
    rangeDays: number
    status: 'generated' | 'cached' | 'no_calls' | 'error'
    error?: string
  }> = []
  let processed = 0
  let cached = 0
  let errors = 0

  for (const tenant of tenants) {
    for (const rangeDays of ranges) {
      const release = await acquireConcurrencySlot()
      try {
        // Fetch call logs
        const { data: logs } = await getCallLogs(tenant.id, { limit: 200 })
        const since = new Date()
        since.setDate(since.getDate() - rangeDays)
        const rangeLogs = logs.filter((l) => new Date(l.created_at) >= since)

        if (rangeLogs.length === 0) {
          details.push({ tenantId: tenant.id, slug: tenant.slug, rangeDays, status: 'no_calls' })
          continue
        }

        // Build input + check cache
        const input = buildSummaryInput(rangeLogs, rangeDays)
        const inputHash = hashInput(input.text)

        const existing = await readTenantSummary(tenant.id, rangeDays)
        if (existing && existing.hash === inputHash) {
          cached++
          details.push({ tenantId: tenant.id, slug: tenant.slug, rangeDays, status: 'cached' })
          continue
        }

        // Generate
        const provider = await getAiProvider()
        const summary: SummaryOutput = await provider.generateSummary(input.text)

        await writeTenantSummary(tenant.id, rangeDays, {
          data: summary,
          model: provider.name,
          hash: inputHash,
          generated_at: new Date().toISOString(),
        })

        processed++
        details.push({ tenantId: tenant.id, slug: tenant.slug, rangeDays, status: 'generated' })
      } catch (err) {
        errors++
        details.push({
          tenantId: tenant.id,
          slug: tenant.slug,
          rangeDays,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      } finally {
        release()
      }
    }
  }

  return NextResponse.json({
    processed,
    cached,
    errors,
    totalTenants: tenants.length,
    ranges,
    details,
  })
}
