/**
 * AI Job Control — caching, dedup, rate limiting, and concurrency.
 *
 * Storage: call_logs.raw_payload.ai_modules.meta (per-call hashes)
 * Rate limiting: in-memory token bucket per tenant+mode+hour
 * Concurrency: Promise-based semaphore (default 1, max 2)
 *
 * NO schema changes required.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { CallLog } from '@/types/database'

// ── Types ────────────────────────────────────────────────────────────────────

export type AiMode = 'tags' | 'followup' | 'summary'

interface AiModulesMeta {
  tags?: { hash: string; model: string; updated_at: string }
  followup?: { hash: string; model: string; updated_at: string }
  summary?: { hash: string; model: string; updated_at: string }
}

interface AiModulesData {
  tags?: Record<string, unknown>
  followup?: Record<string, unknown>
  tenant_summary?: Record<string, unknown>
  meta?: AiModulesMeta
}

// ── Stable hash ──────────────────────────────────────────────────────────────

/**
 * Simple stable hash for dedup. Uses a fast non-crypto hash.
 * Not for security — just cache invalidation.
 */
export function hashInput(input: string): string {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h = ((h << 5) - h + ch) | 0
  }
  // Convert to positive hex string
  return (h >>> 0).toString(16).padStart(8, '0')
}

// ── Per-call metadata ────────────────────────────────────────────────────────

/**
 * Extract AI module metadata from a call log's raw_payload.
 */
export function getCallAiMeta(log: CallLog): AiModulesMeta {
  const raw = log.raw_payload as Record<string, unknown> | null
  if (!raw) return {}
  const modules = raw.ai_modules as AiModulesData | undefined
  return modules?.meta ?? {}
}

/**
 * Extract stored AI module data from a call log.
 */
export function getCallAiData(log: CallLog): AiModulesData {
  const raw = log.raw_payload as Record<string, unknown> | null
  if (!raw) return {}
  return (raw.ai_modules as AiModulesData) ?? {}
}

/**
 * Check if processing should be skipped (already done with same input hash).
 */
export function shouldProcess(log: CallLog, mode: AiMode, newHash: string): boolean {
  const meta = getCallAiMeta(log)
  const existing = meta[mode === 'summary' ? 'summary' : mode]
  if (!existing) return true
  return existing.hash !== newHash
}

/**
 * Persist AI module results into call_logs.raw_payload.ai_modules.
 * Merges into existing raw_payload without overwriting other data.
 */
export async function persistCallAiResult(
  callLogId: string,
  mode: AiMode,
  result: Record<string, unknown>,
  inputHash: string,
  modelName: string,
): Promise<void> {
  const supabase = createSupabaseServerClient()

  // Fetch current raw_payload to merge
  const { data: current } = await supabase
    .from('call_logs')
    .select('raw_payload')
    .eq('id', callLogId)
    .maybeSingle()

  const rawPayload = (current?.raw_payload as Record<string, unknown>) ?? {}
  const aiModules = (rawPayload.ai_modules as AiModulesData) ?? {}
  const meta = aiModules.meta ?? {}

  // Store result in appropriate key
  const dataKey = mode === 'summary' ? 'tenant_summary' : mode
  const updatedModules: AiModulesData = {
    ...aiModules,
    [dataKey]: result,
    meta: {
      ...meta,
      [mode]: {
        hash: inputHash,
        model: modelName,
        updated_at: new Date().toISOString(),
      },
    },
  }

  const { error } = await supabase
    .from('call_logs')
    .update({
      raw_payload: { ...rawPayload, ai_modules: updatedModules },
    })
    .eq('id', callLogId)

  if (error) {
    console.error(`[ai/jobs] Failed to persist ${mode} for ${callLogId}:`, error.message)
    throw new Error(`Failed to persist AI result: ${error.message}`)
  }
}

// ── Rate limiter (in-memory token bucket) ────────────────────────────────────

const MAX_JOBS_PER_HOUR = Number(process.env.AI_MAX_JOBS_PER_TENANT_PER_HOUR ?? 30)

interface BucketEntry {
  count: number
  resetAt: number // epoch ms
}

const rateBuckets = new Map<string, BucketEntry>()

function getBucketKey(clientId: string, mode: AiMode): string {
  const hourBucket = Math.floor(Date.now() / 3_600_000)
  return `${clientId}:${mode}:${hourBucket}`
}

/**
 * Check and consume a rate limit token. Returns true if allowed.
 */
export function checkRateLimit(clientId: string, mode: AiMode): boolean {
  const key = getBucketKey(clientId, mode)
  const now = Date.now()
  const hourEnd = (Math.floor(now / 3_600_000) + 1) * 3_600_000

  const entry = rateBuckets.get(key)

  if (!entry || now >= entry.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: hourEnd })
    return true
  }

  if (entry.count >= MAX_JOBS_PER_HOUR) return false

  entry.count++
  return true
}

// Clean up old entries periodically (every hour)
if (typeof globalThis !== 'undefined') {
  const cleanup = () => {
    const now = Date.now()
    const entries = Array.from(rateBuckets.entries())
    for (const [key, entry] of entries) {
      if (now >= entry.resetAt) rateBuckets.delete(key)
    }
  }
  // Use globalThis to avoid multiple intervals in dev (HMR)
  const g = globalThis as unknown as { _aiRateCleanup?: ReturnType<typeof setInterval> }
  if (!g._aiRateCleanup) {
    g._aiRateCleanup = setInterval(cleanup, 3_600_000)
  }
}

// ── Concurrency semaphore ────────────────────────────────────────────────────

const MAX_CONCURRENCY = Math.min(Number(process.env.AI_MAX_CONCURRENCY ?? 1), 2)

let _running = 0
const _queue: Array<() => void> = []

/**
 * Acquire a concurrency slot. Resolves when a slot is available.
 * Returns a release function to call when done.
 */
export function acquireConcurrencySlot(): Promise<() => void> {
  if (_running < MAX_CONCURRENCY) {
    _running++
    return Promise.resolve(() => {
      _running--
      if (_queue.length > 0) {
        const next = _queue.shift()!
        _running++
        next()
      }
    })
  }

  return new Promise<() => void>((resolve) => {
    _queue.push(() => {
      resolve(() => {
        _running--
        if (_queue.length > 0) {
          const next = _queue.shift()!
          _running++
          next()
        }
      })
    })
  })
}
