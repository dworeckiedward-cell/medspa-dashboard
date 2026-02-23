/**
 * POST /api/retell/webhook — Retell call event receiver.
 *
 * Auth (two paths):
 *
 * 1. HMAC signature (x-retell-signature) — Retell's dashboard "Test webhook"
 *    button and production webhooks sign the body with the Retell API Key
 *    using HMAC-SHA256. We verify by trying keys in order:
 *      a) RETELL_WEBHOOK_SECRET (if set and matches)
 *      b) RETELL_API_KEY        (Retell's actual signing key per their SDK)
 *
 * 2. Shared key — For manual curl/integration tests. Reads key from
 *    x-retell-webhook-key / x-webhook-key / x-api-key / Authorization Bearer
 *    and compares against RETELL_WEBHOOK_SECRET (primary) or WEBHOOK_API_KEY.
 */

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/auth/timing-safe'
import { rateLimit, webhookLimiter } from '@/lib/api/rate-limit'
import { handleRetellWebhook } from '@/lib/retell/ingest'

export const dynamic = 'force-dynamic'

const DEBUG = process.env.DEBUG_RETELL === 'true'

/** Compute HMAC-SHA256 hex digest. */
function hmacHex(body: string, key: string): string {
  return crypto.createHmac('sha256', key).update(body, 'utf8').digest('hex')
}

export async function POST(request: NextRequest) {
  // ── Rate limit ──────────────────────────────────────────────────────────────
  const limited = rateLimit(request, webhookLimiter)
  if (limited) return limited

  // ── Read raw body (needed for HMAC verification + JSON parsing) ────────────
  let rawBodyText: string
  try {
    rawBodyText = await request.text()
  } catch {
    return NextResponse.json({ error: 'Could not read request body' }, { status: 400 })
  }

  // ── Auth path 1: HMAC signature verification ──────────────────────────────
  const signature = request.headers.get('x-retell-signature')

  if (signature) {
    // Strip optional "sha256=" prefix, lowercase, trim
    const incoming = signature.trim().toLowerCase().replace(/^sha256=/, '')

    // Collect candidate signing keys (order: RETELL_WEBHOOK_SECRET, RETELL_API_KEY)
    const candidateKeys: string[] = []
    if (process.env.RETELL_WEBHOOK_SECRET) candidateKeys.push(process.env.RETELL_WEBHOOK_SECRET)
    if (process.env.RETELL_API_KEY) candidateKeys.push(process.env.RETELL_API_KEY)

    if (DEBUG) {
      console.log('[retell-webhook] auth path: hmac')
      console.log('[retell-webhook] RETELL_WEBHOOK_SECRET present:', !!process.env.RETELL_WEBHOOK_SECRET)
      console.log('[retell-webhook] RETELL_API_KEY present:', !!process.env.RETELL_API_KEY)
      console.log('[retell-webhook] candidate keys count:', candidateKeys.length)
    }

    if (candidateKeys.length === 0) {
      console.error('[retell-webhook] No signing keys configured (need RETELL_WEBHOOK_SECRET or RETELL_API_KEY)')
      return NextResponse.json(
        { error: 'Server misconfiguration: missing RETELL_WEBHOOK_SECRET' },
        { status: 500 },
      )
    }

    // Try each key — Retell's SDK signs with the API key, but we also accept
    // RETELL_WEBHOOK_SECRET in case the user configured it as the signing key.
    let matched = false
    for (const key of candidateKeys) {
      const computed = hmacHex(rawBodyText, key)
      if (safeCompare(incoming, computed)) {
        matched = true
        break
      }
    }

    if (!matched) {
      if (DEBUG) {
        console.log('[retell-webhook] HMAC mismatch — no candidate key matched')
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (DEBUG) {
      console.log('[retell-webhook] HMAC verified successfully')
    }
  } else {
    // ── Auth path 2: Plain shared-key headers ─────────────────────────────
    const keySources = [
      'x-retell-webhook-key',
      'x-webhook-key',
      'x-api-key',
    ] as const

    let incomingKey: string | null = null
    let usedHeader: string | null = null

    for (const name of keySources) {
      const val = request.headers.get(name)
      if (val) {
        incomingKey = val
        usedHeader = name
        break
      }
    }

    // Fallback: Authorization Bearer
    if (!incomingKey) {
      const authHeader = request.headers.get('authorization')
      if (authHeader) {
        incomingKey = authHeader.replace(/^Bearer\s+/i, '')
        usedHeader = 'authorization'
      }
    }

    const expectedKey = process.env.RETELL_WEBHOOK_SECRET || process.env.WEBHOOK_API_KEY

    if (DEBUG) {
      console.log('[retell-webhook] auth path: shared-key')
      console.log('[retell-webhook] header used:', usedHeader ?? 'none')
      console.log('[retell-webhook] expected key present:', !!expectedKey)
    }

    if (!expectedKey) {
      console.error('[retell-webhook] Neither RETELL_WEBHOOK_SECRET nor WEBHOOK_API_KEY is set')
      return NextResponse.json(
        { error: 'Server misconfiguration: missing RETELL_WEBHOOK_SECRET' },
        { status: 500 },
      )
    }

    if (!incomingKey || !safeCompare(incomingKey, expectedKey)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // ── Parse JSON from raw body ──────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = JSON.parse(rawBodyText)
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
