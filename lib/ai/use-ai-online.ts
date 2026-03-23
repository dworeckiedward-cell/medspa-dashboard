'use client'

/**
 * useAiOnline / useAiStatus — module-singleton health check hooks.
 *
 * One HTTP request per page load, shared across every component that calls
 * these hooks (AiStatusPill, WeeklyAiSummaryCard, AiInsightsSection,
 * AiFollowupDraft, …).  No polling, no duplicate fetches.
 *
 * useAiOnline()  → boolean | null   (null = in flight)
 * useAiStatus()  → { ok, reason } | null
 */

import { useEffect, useState } from 'react'

export interface AiHealthResult {
  ok: boolean
  reason: string
}

// ── Module-level singleton ────────────────────────────────────────────────────

let _cache: AiHealthResult | null = null
let _promise: Promise<AiHealthResult> | null = null

function getOrFetch(): Promise<AiHealthResult> {
  if (_promise) return _promise

  _promise = fetch('/api/ai/health', { cache: 'no-store' })
    .then((r) => r.json())
    .then((data: { ok?: boolean; reason?: string }) => {
      _cache = {
        ok: data.ok === true,
        reason: data.reason ?? 'Ollama unreachable — check /api/ai/health',
      }
      return _cache
    })
    .catch(() => {
      _cache = { ok: false, reason: 'Ollama unreachable — check /api/ai/health' }
      return _cache
    })

  return _promise
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Returns true (online) / false (offline) / null (in flight).
 * Use to gate generate buttons: disable when null, hide when false.
 */
export function useAiOnline(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(
    _cache !== null ? _cache.ok : null,
  )

  useEffect(() => {
    if (_cache !== null) {
      setOnline(_cache.ok)
      return
    }
    let cancelled = false
    getOrFetch().then((result) => {
      if (!cancelled) setOnline(result.ok)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return online
}

/**
 * Returns the full health result once resolved (useful for AiStatusPill
 * which also needs the reason string). null while in flight.
 */
export function useAiStatus(): AiHealthResult | null {
  const [status, setStatus] = useState<AiHealthResult | null>(_cache)

  useEffect(() => {
    if (_cache !== null) {
      setStatus(_cache)
      return
    }
    let cancelled = false
    getOrFetch().then((result) => {
      if (!cancelled) setStatus(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return status
}
