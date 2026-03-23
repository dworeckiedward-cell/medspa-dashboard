/**
 * POST /api/ops/retell/ping
 *
 * Temporary operator-only debug endpoint.
 * Calls listAgents() and listCalls(limit=1) to verify the Retell API key,
 * base URL, and request shapes are all working — without touching tenant data.
 *
 * Auth: OPS_WEBHOOK_SECRET via x-ops-key or Authorization: Bearer header.
 */

import { NextResponse } from 'next/server'
import { verifyOpsServerKey } from '@/lib/ops/server-key-auth'
import { listAgents, listCalls } from '@/lib/retell/api'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const keyResult = verifyOpsServerKey(request, 'retell/ping')

  if (keyResult.missingSecret) {
    return NextResponse.json(
      { ok: false, error: 'OPS_WEBHOOK_SECRET not configured on server' },
      { status: 500 },
    )
  }

  if (!keyResult.valid) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  // ── Pre-flight: RETELL_API_KEY ────────────────────────────────────────────
  if (!process.env.RETELL_API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'RETELL_API_KEY missing' },
      { status: 500 },
    )
  }

  // ── Smoke-test both endpoints ─────────────────────────────────────────────
  const results: Record<string, unknown> = {}

  // listAgents (POST /v2/list-agents)
  try {
    const agents = await listAgents()
    results.agents = { ok: true, count: agents.length }
  } catch (err: unknown) {
    results.agents = errSummary(err)
  }

  // listCalls (POST /v2/list-calls) — single call, no filter
  try {
    const page = await listCalls({ limit: 1 })
    results.calls = {
      ok: true,
      returnedArray: Array.isArray(page.calls),
      count: page.calls.length,
    }
  } catch (err: unknown) {
    results.calls = errSummary(err)
  }

  const allOk =
    (results.agents as { ok?: boolean })?.ok === true &&
    (results.calls as { ok?: boolean })?.ok === true

  return NextResponse.json(
    { ok: allOk, ...results },
    { status: allOk ? 200 : 502 },
  )
}

function errSummary(err: unknown): Record<string, unknown> {
  const status =
    err && typeof err === 'object' && 'status' in err
      ? (err as { status: number }).status
      : null
  const body =
    err && typeof err === 'object' && 'body' in err
      ? (err as { body: unknown }).body
      : undefined

  const bodySnippet = body
    ? JSON.stringify(body).slice(0, 300)
    : err instanceof Error
      ? err.message
      : String(err)

  return { ok: false, status, bodySnippet }
}
