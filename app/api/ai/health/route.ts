/**
 * GET /api/ai/health
 *
 * Verifies Ollama connectivity and model availability instantly.
 * Use this to confirm VPS is wired before deploying.
 *
 * 200: { ok: true, provider, baseUrl, models, latencyMs }
 * 503: { ok: false, reason, hint, ...partial }
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  // ── Env var check ─────────────────────────────────────────────────────────
  const baseUrl = process.env.OLLAMA_BASE_URL
  const modelTags = process.env.OLLAMA_MODEL_TAGS
  const modelSummary = process.env.OLLAMA_MODEL_SUMMARY
  const modelFollowup = process.env.OLLAMA_MODEL_FOLLOWUP

  const missing: string[] = []
  if (!baseUrl) missing.push('OLLAMA_BASE_URL')
  if (!modelTags) missing.push('OLLAMA_MODEL_TAGS')
  if (!modelSummary) missing.push('OLLAMA_MODEL_SUMMARY')
  if (!modelFollowup) missing.push('OLLAMA_MODEL_FOLLOWUP')

  if (missing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        reason: `Missing required env vars: ${missing.join(', ')}`,
        hint: `Set ${missing.join(', ')} in your production runtime environment`,
      },
      { status: 503 },
    )
  }

  const cleanUrl = baseUrl!.replace(/\/$/, '')

  // ── Reachability probe ─────────────────────────────────────────────────────
  const start = Date.now()
  let availableModels: string[] = []

  try {
    const res = await fetch(`${cleanUrl}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const data = (await res.json()) as { models?: Array<{ name: string }> }
    availableModels = (data.models ?? []).map((m) => m.name)
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        reason: `Ollama not reachable at ${cleanUrl}: ${err instanceof Error ? err.message : String(err)}`,
        hint: 'Check that Ollama is running and bound to 0.0.0.0:11434. Add Environment="OLLAMA_HOST=0.0.0.0:11434" to the systemd unit, then: systemctl daemon-reload && systemctl restart ollama',
      },
      { status: 503 },
    )
  }

  const latencyMs = Date.now() - start

  // ── Model availability check ───────────────────────────────────────────────
  const models = {
    tags: modelTags!,
    summary: modelSummary!,
    followup: modelFollowup!,
  }

  const notPulled = Object.entries(models)
    .filter(
      ([, model]) =>
        !availableModels.some((m) => m === model || m.startsWith(`${model}:`)),
    )
    .map(([key, model]) => ({ key, model }))

  if (notPulled.length > 0) {
    const allModels = notPulled.map((e) => e.model)
    const uniqueModels = allModels.filter((m, i) => allModels.indexOf(m) === i)
    const pullCmds = uniqueModels.map((m) => `ollama pull ${m}`).join(' && ')
    return NextResponse.json(
      {
        ok: false,
        reason: `Models not available on Ollama: ${notPulled.map((e) => `${e.key}=${e.model}`).join(', ')}`,
        hint: `Run on your VPS: ${pullCmds}`,
        provider: 'ollama',
        baseUrl: cleanUrl,
        models,
        latencyMs,
      },
      { status: 503 },
    )
  }

  // ── All good ───────────────────────────────────────────────────────────────
  return NextResponse.json({
    ok: true,
    provider: 'ollama',
    baseUrl: cleanUrl,
    models,
    latencyMs,
  })
}
