/**
 * POST /api/webhooks/retell/summary
 *
 * Receives Retell's post-call summary webhook (or an n8n bridge) and persists
 * the AI summary + transcript into the matching call_logs row.
 *
 * ── Auth ─────────────────────────────────────────────────────────────────────
 * Checks x-webhook-secret header (or Authorization: Bearer <secret>) against
 * the CALL_SUMMARY_WEBHOOK_SECRET env var.
 *
 * ── Matching ──────────────────────────────────────────────────────────────────
 * Matches on call_logs.external_call_id = payload.call_id.
 * If no matching row is found, returns 404 — the call must be ingested via the
 * main /api/retell/webhook before a summary can be attached.
 *
 * ── Fields written ────────────────────────────────────────────────────────────
 * ai_summary          ← normalised.plainSummary
 * ai_summary_json     ← normalised.structuredSummary
 * transcript          ← normalised.transcriptText
 * recording_url       ← normalised.recordingUrl  (only if not already set)
 * summary_status      ← 'complete'
 * summary_updated_at  ← now()
 * updated_at          ← now()
 *
 * ── Response ──────────────────────────────────────────────────────────────────
 * 201  { success: true, callLogId, providerCallId, warnings? }
 * 404  No matching call_log row
 * 401  Auth failure
 * 400  Invalid body
 * 500  DB error or server misconfiguration
 */

import { NextRequest, NextResponse } from 'next/server'
import { normaliseCallSummary, validateNormalisedSummary } from '@/lib/integrations/retell/normalize-call-summary'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { safeCompare } from '@/lib/auth/timing-safe'
import { rateLimit, webhookLimiter } from '@/lib/api/rate-limit'

// ── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorised(req: NextRequest): boolean {
  const secret =
    req.headers.get('x-webhook-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  const expected = process.env.CALL_SUMMARY_WEBHOOK_SECRET
  if (!expected) return false
  return safeCompare(secret, expected)
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate limit
  const limited = rateLimit(req, webhookLimiter)
  if (limited) return limited

  // Auth
  if (!process.env.CALL_SUMMARY_WEBHOOK_SECRET) {
    console.error('[retell/summary] CALL_SUMMARY_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Normalise
  const normalised = normaliseCallSummary(rawBody)
  const warnings  = validateNormalisedSummary(normalised)

  if (normalised.providerCallId === 'unknown') {
    return NextResponse.json(
      {
        error: 'Cannot identify call — no call_id / callId field found in payload.',
        warnings,
      },
      { status: 400 },
    )
  }

  // DB upsert
  const supabase = createSupabaseServerClient()

  // 1. Find the matching call_log row
  const { data: existing, error: findError } = await supabase
    .from('call_logs')
    .select('id, recording_url')
    .eq('external_call_id', normalised.providerCallId)
    .maybeSingle()

  if (findError) {
    console.error('[retell/summary] DB lookup error:', findError.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!existing) {
    return NextResponse.json(
      {
        error: `No call_log found for external_call_id = ${normalised.providerCallId}. Ingest the call first via /api/retell/webhook.`,
        providerCallId: normalised.providerCallId,
      },
      { status: 404 },
    )
  }

  // 2. Build the update payload
  const updatePayload: Record<string, unknown> = {
    ai_summary:         normalised.plainSummary,
    ai_summary_json:    normalised.structuredSummary,
    transcript:         normalised.transcriptText,
    summary_status:     'complete',
    summary_updated_at: new Date().toISOString(),
    updated_at:         new Date().toISOString(),
  }

  // Only overwrite recording_url if we received a new one AND the row has none
  if (normalised.recordingUrl && !existing.recording_url) {
    updatePayload.recording_url = normalised.recordingUrl
  }

  // 3. Also surface top-level sentiment / intent to call_logs directly
  //    (these are already present from the main webhook for Retell payloads,
  //     but the structured summary may carry richer data from the LLM analysis)
  if (normalised.structuredSummary.sentiment) {
    updatePayload.sentiment = normalised.structuredSummary.sentiment
  }
  if (normalised.structuredSummary.intent) {
    updatePayload.intent = normalised.structuredSummary.intent
  }
  if (normalised.structuredSummary.urgency === 'high') {
    // Urgency high → flag for human follow-up if not already flagged
    updatePayload.human_followup_needed = true
    updatePayload.human_followup_reason =
      `High-urgency call identified by AI (urgency: ${normalised.structuredSummary.urgency})`
  }

  // 4. Persist
  const { error: updateError } = await supabase
    .from('call_logs')
    .update(updatePayload)
    .eq('id', existing.id)

  if (updateError) {
    console.error('[retell/summary] DB update error:', updateError.message)
    return NextResponse.json({ error: 'Database write failed' }, { status: 500 })
  }

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[retell/summary] Updated call_log', {
      id: existing.id,
      providerCallId: normalised.providerCallId,
      hasSummary: !!normalised.plainSummary,
      hasTranscript: !!normalised.transcriptText,
      warnings,
    })
  }

  return NextResponse.json(
    {
      success: true,
      callLogId: existing.id,
      providerCallId: normalised.providerCallId,
      ...(warnings.length > 0 && { warnings }),
    },
    { status: 201 },
  )
}
