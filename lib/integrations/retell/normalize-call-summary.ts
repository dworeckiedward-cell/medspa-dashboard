/**
 * Retell / n8n call summary normalizer.
 *
 * Accepts the raw payload from a Retell post-call webhook (or an n8n bridge)
 * and normalises it into the internal NormalisedCallSummary shape.
 *
 * Design goals:
 *  1. Flexible input — different Retell versions and n8n bridges use different keys
 *  2. Non-throwing — always returns a normalised object; missing fields → null
 *  3. Testable — pure function with no side effects
 *  4. Extensible — add new providers by creating sibling normalizers
 */

import type { NormalisedCallSummary, StructuredSummary } from '@/lib/types/domain'

// ── Raw payload shape accepted from Retell / n8n ──────────────────────────────
// We intentionally use `unknown` and cast defensively — payloads vary.

type Obj = Record<string, unknown>

// ── Safe accessor helpers ─────────────────────────────────────────────────────

function str(obj: Obj, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

function num(obj: Obj, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'number' && isFinite(v)) return v
    if (typeof v === 'string') {
      const n = parseFloat(v)
      if (isFinite(n)) return n
    }
  }
  return null
}

function bool(obj: Obj, ...keys: string[]): boolean | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'boolean') return v
    if (v === 'true') return true
    if (v === 'false') return false
  }
  return null
}

function arr(obj: Obj, ...keys: string[]): string[] {
  for (const k of keys) {
    const v = obj[k]
    if (Array.isArray(v)) return v.map(String)
    if (typeof v === 'string' && v.includes(',')) return v.split(',').map((s) => s.trim())
  }
  return []
}

function nested(obj: Obj, ...keys: string[]): Obj | null {
  for (const k of keys) {
    const v = obj[k]
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Obj
  }
  return null
}

// ── Sentiment / urgency / intent extraction ──────────────────────────────────

type Sentiment = 'positive' | 'neutral' | 'negative'
type Urgency = 'high' | 'medium' | 'low'

function normaliseSentiment(raw: string | null): Sentiment | null {
  if (!raw) return null
  const v = raw.toLowerCase()
  if (v.includes('positive') || v.includes('happy') || v.includes('satisfied')) return 'positive'
  if (v.includes('negative') || v.includes('frustrated') || v.includes('angry')) return 'negative'
  if (v.includes('neutral') || v.includes('mixed')) return 'neutral'
  return null
}

function normaliseUrgency(raw: string | null, score: number | null): Urgency | null {
  if (raw) {
    const v = raw.toLowerCase()
    if (v.includes('high') || v.includes('urgent') || v.includes('asap')) return 'high'
    if (v.includes('medium') || v.includes('moderate')) return 'medium'
    if (v.includes('low')) return 'low'
  }
  if (score !== null) {
    if (score >= 0.7) return 'high'
    if (score >= 0.4) return 'medium'
    return 'low'
  }
  return null
}

// ── Main normaliser ───────────────────────────────────────────────────────────

/**
 * Normalise a raw Retell (or n8n bridge) post-call payload into the internal
 * NormalisedCallSummary shape.
 *
 * Key name variations handled:
 *  call_id / callId / id
 *  transcript / call_transcript / transcriptText
 *  call_summary / summary / call_analysis.summary
 *  call_analysis.custom_analysis_data / metadata / structured_data
 */
export function normaliseCallSummary(raw: unknown): NormalisedCallSummary {
  const payload: Obj = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Obj)
    : {}

  // ── Provider call ID ────────────────────────────────────────────────────────
  const providerCallId =
    str(payload, 'call_id', 'callId', 'id', 'retell_call_id') ?? 'unknown'

  // ── Transcript ──────────────────────────────────────────────────────────────
  const transcriptText = str(payload, 'transcript', 'call_transcript', 'transcriptText')

  // ── Recording URL ───────────────────────────────────────────────────────────
  const recordingUrl = str(payload, 'recording_url', 'recordingUrl', 'audio_url')

  // ── Plain summary ───────────────────────────────────────────────────────────
  const plainSummary = str(payload, 'call_summary', 'summary', 'plain_summary', 'callSummary')

  // ── Structured analysis (various nesting patterns) ──────────────────────────
  // Pattern 1: payload.call_analysis.custom_analysis_data (Retell native)
  // Pattern 2: payload.metadata (our existing webhook pattern)
  // Pattern 3: payload.structured_data / payload.analysis
  const analysisBlock =
    nested(payload, 'call_analysis') ??
    nested(payload, 'metadata') ??
    nested(payload, 'structured_data') ??
    nested(payload, 'analysis') ??
    payload

  const customData =
    nested(analysisBlock, 'custom_analysis_data') ??
    nested(analysisBlock, 'structured_summary') ??
    analysisBlock

  // ── Sentiment / urgency ─────────────────────────────────────────────────────
  const rawSentiment = str(customData, 'sentiment', 'caller_sentiment')
  const rawUrgency = str(customData, 'urgency', 'urgency_level')
  const urgencyScore = num(customData, 'urgency_score')

  const structuredSummary: Partial<StructuredSummary> = {
    intent:
      str(customData, 'intent', 'caller_intent', 'primary_intent') ?? undefined,

    sentiment:
      normaliseSentiment(rawSentiment) ??
      normaliseSentiment(str(analysisBlock, 'sentiment')) ??
      undefined,

    urgency:
      normaliseUrgency(rawUrgency, urgencyScore) ??
      normaliseUrgency(str(analysisBlock, 'urgency'), null) ??
      undefined,

    objections:
      arr(customData, 'objections', 'objection_list', 'concerns') ||
      arr(analysisBlock, 'objections'),

    outcome:
      str(customData, 'outcome', 'call_outcome', 'result') ?? undefined,

    nextBestAction:
      str(customData, 'next_best_action', 'nextBestAction', 'recommended_action') ?? undefined,

    callbackScript:
      str(customData, 'callback_script', 'callbackScript', 'suggested_script') ?? undefined,

    keyFacts:
      arr(customData, 'key_facts', 'keyFacts', 'facts', 'key_points'),

    unansweredQuestions:
      arr(customData, 'unanswered_questions', 'unansweredQuestions', 'open_questions'),
  }

  // ── Model / provider metadata ────────────────────────────────────────────────
  const model =
    str(payload, 'model', 'llm_model') ??
    str(analysisBlock, 'model') ??
    null

  return {
    providerCallId,
    transcriptText,
    plainSummary,
    structuredSummary,
    recordingUrl,
    provider: 'retell',
    model,
    rawPayload: payload,
  }
}

/**
 * Validate that the normalised summary has the minimum data needed to be useful.
 * Returns an array of warning strings (empty = all good).
 */
export function validateNormalisedSummary(summary: NormalisedCallSummary): string[] {
  const warnings: string[] = []
  if (summary.providerCallId === 'unknown') warnings.push('No call ID found — cannot deduplicate')
  if (!summary.plainSummary) warnings.push('No plain summary extracted')
  if (!summary.transcriptText) warnings.push('No transcript text extracted')
  if (!summary.structuredSummary.intent) warnings.push('No intent extracted')
  return warnings
}
