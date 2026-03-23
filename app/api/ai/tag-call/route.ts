/**
 * POST /api/ai/tag-call
 *
 * Generate AI tags for a single call log.
 * Tenant-scoped via resolveTenantAccess.
 * Async: returns immediately after processing (never blocks page render).
 *
 * Body: { callLogId: string }
 * Returns: { tags: TagsOutput, cached: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getCallLogById } from '@/lib/dashboard/metrics'
import { getAiProvider, type TagsOutput } from '@/lib/ai/provider'
import { buildCallInput } from '@/lib/ai/input'
import {
  hashInput,
  shouldProcess,
  persistCallAiResult,
  getCallAiData,
  checkRateLimit,
  acquireConcurrencySlot,
} from '@/lib/ai/jobs'
import { apiBadRequest, apiUnauthorized, apiNotFound, apiInternalError } from '@/lib/api-utils'
import { logAiFailure } from '@/lib/ai/ops-log'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // ── Auth + tenant ────────────────────────────────────────────────────────
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return apiUnauthorized('Tenant not found')

  // ── Body parse ───────────────────────────────────────────────────────────
  let callLogId: string
  try {
    const body = await request.json()
    callLogId = body.callLogId
    if (!callLogId || typeof callLogId !== 'string') {
      return apiBadRequest('callLogId is required')
    }
  } catch {
    return apiBadRequest('Invalid JSON body')
  }

  // ── Fetch call log (tenant-scoped) ───────────────────────────────────────
  const log = await getCallLogById(tenant.id, callLogId)
  if (!log) return apiNotFound('Call log not found or does not belong to this tenant')

  // ── Rate limit ───────────────────────────────────────────────────────────
  if (!checkRateLimit(tenant.id, 'tags')) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429 },
    )
  }

  // ── Build input + check cache ────────────────────────────────────────────
  const input = buildCallInput(log)
  const inputHash = hashInput(input.text)

  if (!shouldProcess(log, 'tags', inputHash)) {
    const existing = getCallAiData(log)
    return NextResponse.json({
      tags: existing.tags as unknown as TagsOutput,
      cached: true,
    })
  }

  // ── Generate ─────────────────────────────────────────────────────────────
  const release = await acquireConcurrencySlot()
  try {
    const provider = await getAiProvider()
    const tags = await provider.generateTags(input.text)

    // Persist into raw_payload.ai_modules.tags
    await persistCallAiResult(
      callLogId,
      'tags',
      tags as unknown as Record<string, unknown>,
      inputHash,
      provider.name,
    )

    return NextResponse.json({ tags, cached: false })
  } catch (err) {
    console.error('[ai/tag-call] Error:', err)
    await logAiFailure({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      route: 'api/ai/tag-call',
      model: process.env.OLLAMA_MODEL_TAGS ?? 'unknown',
      error: err,
    })
    return apiInternalError('AI generation failed')
  } finally {
    release()
  }
}
