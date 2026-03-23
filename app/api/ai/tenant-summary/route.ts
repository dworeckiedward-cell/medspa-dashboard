/**
 * POST /api/ai/tenant-summary
 *
 * Generate executive summary for the current tenant.
 * Tenant-scoped via resolveTenantAccess.
 *
 * Body: { rangeDays: 7 | 30 | 45 | 60 | 365 }
 * Returns: { summary: SummaryOutput, cached: boolean, stored_at: string }
 *
 * Storage: tenants.branding.ai_modules.summary.<rangeDays>
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getCallLogs } from '@/lib/dashboard/metrics'
import { getAiProvider, type SummaryOutput } from '@/lib/ai/provider'
import { buildSummaryInput } from '@/lib/ai/input'
import { hashInput, checkRateLimit, acquireConcurrencySlot } from '@/lib/ai/jobs'
import { readTenantSummary, writeTenantSummary } from '@/lib/ai/tenant-summary-store'
import { apiBadRequest, apiUnauthorized, apiInternalError } from '@/lib/api-utils'
import { logAiFailure } from '@/lib/ai/ops-log'

export const dynamic = 'force-dynamic'

const VALID_RANGES = new Set([7, 30, 45, 60, 365])

export async function POST(request: NextRequest) {
  // ── Auth + tenant ────────────────────────────────────────────────────────
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return apiUnauthorized('Tenant not found')

  // ── Body parse ───────────────────────────────────────────────────────────
  let rangeDays: number
  try {
    const body = await request.json()
    rangeDays = body.rangeDays
    if (!VALID_RANGES.has(rangeDays)) {
      return apiBadRequest('rangeDays must be one of: 7, 30, 45, 60, 365')
    }
  } catch {
    return apiBadRequest('Invalid JSON body')
  }

  const storedAt = `tenants.branding.ai_modules.summary.${rangeDays}`

  // ── Rate limit ───────────────────────────────────────────────────────────
  if (!checkRateLimit(tenant.id, 'summary')) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429 },
    )
  }

  // ── Fetch call logs in range ─────────────────────────────────────────────
  const { data: logs } = await getCallLogs(tenant.id, { limit: 200 })

  // Filter to range
  const since = new Date()
  since.setDate(since.getDate() - rangeDays)
  const rangeLogs = logs.filter((l) => new Date(l.created_at) >= since)

  if (rangeLogs.length === 0) {
    return NextResponse.json({
      summary: {
        headline: 'No calls in the selected period',
        insights: ['No call data available for analysis.'],
        risks: ['No data to assess risks.'],
        recommended_actions: ['Ensure your AI receptionist is active and receiving calls.'],
      } satisfies SummaryOutput,
      cached: false,
      stored_at: storedAt,
    })
  }

  // ── Build input + check cache in tenants.branding ──────────────────────
  const input = buildSummaryInput(rangeLogs, rangeDays)
  const inputHash = hashInput(input.text)

  // Check existing cached summary
  const existing = await readTenantSummary(tenant.id, rangeDays)
  if (existing && existing.hash === inputHash) {
    return NextResponse.json({
      summary: existing.data,
      cached: true,
      stored_at: storedAt,
    })
  }

  // ── Generate ─────────────────────────────────────────────────────────────
  const release = await acquireConcurrencySlot()
  try {
    const provider = await getAiProvider()
    const summary = await provider.generateSummary(input.text)

    // Persist to tenants.branding
    await writeTenantSummary(tenant.id, rangeDays, {
      data: summary,
      model: provider.name,
      hash: inputHash,
      generated_at: new Date().toISOString(),
    })

    return NextResponse.json({
      summary,
      cached: false,
      stored_at: storedAt,
    })
  } catch (err) {
    console.error('[ai/tenant-summary] Error:', err)
    await logAiFailure({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      route: 'api/ai/tenant-summary',
      model: process.env.OLLAMA_MODEL_SUMMARY ?? 'unknown',
      error: err,
    })
    return apiInternalError('AI generation failed')
  } finally {
    release()
  }
}
