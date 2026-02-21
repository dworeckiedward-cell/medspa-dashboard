import { NextRequest, NextResponse } from 'next/server'
import { normaliseCallSummary, validateNormalisedSummary } from '@/lib/integrations/retell/normalize-call-summary'

/**
 * POST /api/webhooks/retell/call-summary
 *
 * Receives a post-call summary payload from Retell (or an n8n bridge) and:
 *  1. Authenticates the request via x-webhook-secret header
 *  2. Normalises the payload into the internal NormalisedCallSummary shape
 *  3. Stores it (DB if configured, dev-mode mock otherwise)
 *  4. Returns 201 with the normalised summary for easy debugging
 *
 * Authentication:
 *   Requires header: x-webhook-secret: <CALL_SUMMARY_WEBHOOK_SECRET env var>
 *   Alternatively: Authorization: Bearer <secret>
 *
 * Required env var:
 *   CALL_SUMMARY_WEBHOOK_SECRET — shared secret between this endpoint and Retell/n8n
 *
 * Optional env var:
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — if not set, storage is skipped (dev mode)
 */

export async function POST(request: NextRequest) {
  // ── Authentication ──────────────────────────────────────────────────────────
  const secret =
    request.headers.get('x-webhook-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  const expectedSecret = process.env.CALL_SUMMARY_WEBHOOK_SECRET

  if (!expectedSecret) {
    console.error('[call-summary webhook] CALL_SUMMARY_WEBHOOK_SECRET env var not set')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (!secret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── Normalise ───────────────────────────────────────────────────────────────
  const normalised = normaliseCallSummary(rawBody)

  const warnings = validateNormalisedSummary(normalised)
  if (warnings.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn('[call-summary webhook] Validation warnings:', warnings)
  }

  // ── Storage ─────────────────────────────────────────────────────────────────
  //
  // TODO: When the `call_summaries` table is created in Supabase:
  //
  //   const supabase = createSupabaseServerClient()
  //   const { error } = await supabase.from('call_summaries').upsert({
  //     provider_call_id: normalised.providerCallId,
  //     plain_summary:    normalised.plainSummary,
  //     structured_summary: normalised.structuredSummary,
  //     transcript_text:  normalised.transcriptText,
  //     recording_url:    normalised.recordingUrl,
  //     provider:         normalised.provider,
  //     model:            normalised.model,
  //     raw_payload:      normalised.rawPayload,
  //   }, { onConflict: 'provider_call_id' })
  //
  //   Also update call_logs.ai_summary + call_logs.ai_summary_json
  //   by joining on call_logs.external_call_id = normalised.providerCallId
  //
  // For now, log in dev mode and return the normalised payload so the caller
  // can confirm the mapping is correct without a DB dependency.

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[call-summary webhook] Normalised payload:', {
      providerCallId: normalised.providerCallId,
      hasSummary: !!normalised.plainSummary,
      hasTranscript: !!normalised.transcriptText,
      intent: normalised.structuredSummary.intent,
      sentiment: normalised.structuredSummary.sentiment,
      warnings,
    })
  }

  return NextResponse.json(
    {
      success: true,
      providerCallId: normalised.providerCallId,
      warnings: warnings.length > 0 ? warnings : undefined,
      // Return normalised summary only in non-production for debugging convenience
      ...(process.env.NODE_ENV !== 'production' && { normalised }),
    },
    { status: 201 },
  )
}
