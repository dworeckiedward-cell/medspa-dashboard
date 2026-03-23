/**
 * POST /api/ai/followup-draft
 *
 * Generate follow-up SMS draft for a flagged call.
 * Tenant-scoped via resolveTenantAccess.
 *
 * Body: { callLogId: string }
 * Returns: { followup: FollowupOutput, cached: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getCallLogById } from '@/lib/dashboard/metrics'
import { getAiProvider, type FollowupOutput } from '@/lib/ai/provider'
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
  if (!checkRateLimit(tenant.id, 'followup')) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429 },
    )
  }

  // ── Build input + check cache ────────────────────────────────────────────
  const input = buildCallInput(log)
  const inputHash = hashInput(input.text)

  if (!shouldProcess(log, 'followup', inputHash)) {
    const existing = getCallAiData(log)
    return NextResponse.json({
      followup: existing.followup as unknown as FollowupOutput,
      cached: true,
    })
  }

  // ── Generate ─────────────────────────────────────────────────────────────
  const release = await acquireConcurrencySlot()
  try {
    const provider = await getAiProvider()
    const followup = await provider.generateFollowup(input.text)

    await persistCallAiResult(
      callLogId,
      'followup',
      followup as unknown as Record<string, unknown>,
      inputHash,
      provider.name,
    )

    return NextResponse.json({ followup, cached: false })
  } catch (err) {
    console.error('[ai/followup-draft] Error:', err)
    await logAiFailure({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      route: 'api/ai/followup-draft',
      model: process.env.OLLAMA_MODEL_FOLLOWUP ?? 'unknown',
      error: err,
    })
    return apiInternalError('AI generation failed')
  } finally {
    release()
  }
}
