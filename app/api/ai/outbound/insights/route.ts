/**
 * POST /api/ai/outbound/insights
 *
 * Generate agent-optimization insights for the current tenant's outbound calls.
 * Tenant-scoped via resolveTenantAccess.
 *
 * Body: { rangeDays: 7 | 30 | 45 | 60 }
 * Returns: { insight: StoredInsight, recommendations: Recommendation[], cached: boolean }
 *
 * Storage: tenants.branding.ai_modules.agent_optimization
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getCallLogs } from '@/lib/dashboard/metrics'
import { getAiProvider } from '@/lib/ai/provider'
import { hashInput, checkRateLimit, acquireConcurrencySlot } from '@/lib/ai/jobs'
import { buildInsightInput } from '@/lib/ai/agent-optimization/input'
import { readAgentOptimization, writeInsight } from '@/lib/ai/agent-optimization/store'
import { apiBadRequest, apiUnauthorized, apiInternalError } from '@/lib/api-utils'
import { logAiFailure } from '@/lib/ai/ops-log'
import type { Recommendation, StoredInsight } from '@/lib/ai/agent-optimization/types'

export const dynamic = 'force-dynamic'

const VALID_RANGES = new Set([7, 30, 45, 60])

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
      return apiBadRequest('rangeDays must be one of: 7, 30, 45, 60')
    }
  } catch {
    return apiBadRequest('Invalid JSON body')
  }

  // ── Rate limit ───────────────────────────────────────────────────────────
  if (!checkRateLimit(tenant.id, 'summary')) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429 },
    )
  }

  // ── Fetch outbound call logs in range ────────────────────────────────────
  const { data: logs } = await getCallLogs(tenant.id, { limit: 300 })
  const since = new Date()
  since.setDate(since.getDate() - rangeDays)
  const outboundLogs = logs.filter(
    (l) => l.direction === 'outbound' && new Date(l.created_at) >= since,
  )

  if (outboundLogs.length === 0) {
    return NextResponse.json({ error: 'No outbound calls in the selected period.' }, { status: 422 })
  }

  // ── Build input + hash check ─────────────────────────────────────────────
  const { text, inputHash, callCount } = buildInsightInput(outboundLogs, rangeDays)

  const existing = await readAgentOptimization(tenant.id)
  const cachedInsight = existing.insights[String(rangeDays)]
  if (cachedInsight && cachedInsight.input_hash === inputHash) {
    const recs = Object.values(existing.recommendations)
      .filter((r) => cachedInsight.data.recommendation_ids.includes(r.id))
    return NextResponse.json({ insight: cachedInsight, recommendations: recs, cached: true })
  }

  // ── Generate ─────────────────────────────────────────────────────────────
  const release = await acquireConcurrencySlot()
  try {
    const provider = await getAiProvider()
    const raw = await provider.generateInsights(text)

    // ── Compute deltas vs previous range (server-side, never delegated to LLM) ──
    const prevRange = rangeDays <= 7 ? 30 : rangeDays <= 30 ? 60 : 90
    const prevSince = new Date()
    prevSince.setDate(prevSince.getDate() - prevRange)
    const prevLogs = logs.filter(
      (l) => l.direction === 'outbound' && new Date(l.created_at) >= prevSince,
    )
    const pct = (n: number, total: number) => (total > 0 ? n / total : 0)
    const currContacted = outboundLogs.filter((l) => (l.duration_seconds ?? 0) > 20).length
    const currLeads = outboundLogs.filter((l) => l.is_lead).length
    const currBooked = outboundLogs.filter((l) => l.is_booked).length
    const prevContacted = prevLogs.filter((l) => (l.duration_seconds ?? 0) > 20).length
    const prevLeads = prevLogs.filter((l) => l.is_lead).length
    const prevBooked = prevLogs.filter((l) => l.is_booked).length
    const currDur =
      outboundLogs.reduce((s, l) => s + (l.duration_seconds ?? 0), 0) / (outboundLogs.length || 1)
    const prevDur =
      prevLogs.reduce((s, l) => s + (l.duration_seconds ?? 0), 0) / (prevLogs.length || 1)

    // ── Assign IDs to new recommendations ───────────────────────────────────
    const now = new Date().toISOString()
    const newRecommendations: Record<string, Recommendation> = {}
    const recommendationIds: string[] = []

    for (const rawRec of raw.recommendations) {
      const id = `rec_${hashInput(rawRec.title + now).slice(0, 10)}`
      newRecommendations[id] = {
        id,
        status: 'draft',
        created_at: now,
        approved_at: null,
        title: rawRec.title,
        rationale: rawRec.rationale,
        expected_impact: rawRec.expected_impact,
        diff: rawRec.diff,
        ab_plan: rawRec.ab_plan,
      }
      recommendationIds.push(id)
    }

    const insight: StoredInsight = {
      generated_at: now,
      model: provider.name,
      input_hash: inputHash,
      data: {
        top_objections: raw.top_objections,
        top_fail_reasons: raw.top_fail_reasons,
        winning_lines: raw.winning_lines,
        recommendation_ids: recommendationIds,
        comparison: {
          prev_range: prevRange,
          deltas: {
            connect_rate: pct(currContacted, outboundLogs.length) - pct(prevContacted, prevLogs.length),
            lead_rate: pct(currLeads, outboundLogs.length) - pct(prevLeads, prevLogs.length),
            booked_rate: pct(currBooked, outboundLogs.length) - pct(prevBooked, prevLogs.length),
            avg_duration: currDur - prevDur,
          },
        },
      },
    }

    await writeInsight(tenant.id, rangeDays, insight, newRecommendations)

    return NextResponse.json({
      insight,
      recommendations: Object.values(newRecommendations),
      cached: false,
      call_count: callCount,
    })
  } catch (err) {
    console.error('[ai/outbound/insights] Error:', err)
    await logAiFailure({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      route: 'api/ai/outbound/insights',
      model: process.env.OLLAMA_MODEL_INSIGHTS ?? process.env.OLLAMA_MODEL_SUMMARY ?? 'unknown',
      error: err,
    })
    return apiInternalError('AI generation failed')
  } finally {
    release()
  }
}
