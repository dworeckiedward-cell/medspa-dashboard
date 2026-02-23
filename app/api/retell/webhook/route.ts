import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/auth/timing-safe'
import { rateLimit, webhookLimiter } from '@/lib/api/rate-limit'
import { handleRetellWebhook } from '@/lib/retell/ingest'

export async function POST(request: NextRequest) {
  // ── Rate limit ──────────────────────────────────────────────────────────────
  const limited = rateLimit(request, webhookLimiter)
  if (limited) return limited

  // ── Auth: Validate x-api-key or Bearer token ──────────────────────────────
  const apiKey =
    request.headers.get('x-api-key') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  const expectedKey = process.env.WEBHOOK_API_KEY

  if (!expectedKey) {
    console.error('[webhook] WEBHOOK_API_KEY env var not set')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (!apiKey || !safeCompare(apiKey, expectedKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── Delegate to canonical handler ─────────────────────────────────────────
  const result = await handleRetellWebhook(rawBody)

  if (!result.ok) {
    const status = result.error === 'Could not resolve tenant' ? 404 : 500
    return NextResponse.json(
      {
        error: result.error ?? 'Processing failed',
        retellCallId: result.retellCallId,
        hint: status === 404
          ? 'Provide agent_id matching tenant_retell_agents or tenants.retell_agent_id, or client_slug in metadata'
          : undefined,
      },
      { status },
    )
  }

  return NextResponse.json(
    {
      success: true,
      call_log_id: result.callLogId,
      retell_call_id: result.retellCallId,
      event_type: result.eventType,
    },
    { status: 201 },
  )
}
