/**
 * AI Input Trimming — builds compact input bundles for LLM calls.
 *
 * Key principle: "wow output with minimal tokens".
 * - Prefer ai_summary over transcript (it's already distilled)
 * - For transcript: take first 20% + last 20%, hard cap total chars
 * - Always include metadata for context
 */

import type { CallLog } from '@/types/database'

// ── Config ───────────────────────────────────────────────────────────────────

const TRANSCRIPT_CHAR_CAP = Number(process.env.AI_CONTEXT_LIMIT ?? 4096) * 2
const TRANSCRIPT_SLICE_PCT = 0.2 // 20% from each end
const SUMMARY_CALLS_CAP = 50    // max calls for tenant summary

// ── Per-call input (for tags + follow-up) ────────────────────────────────────

export interface CallInputBundle {
  /** Compact text representation ready for LLM prompt */
  text: string
  /** Character count for debugging/logging */
  charCount: number
}

/**
 * Build compact input for a single call (tags or follow-up generation).
 *
 * Priority: ai_summary > transcript excerpt > metadata-only.
 */
export function buildCallInput(log: CallLog): CallInputBundle {
  const lines: string[] = []

  // ── Metadata header (always included — cheap, high signal) ──────────────
  lines.push('## Call Metadata')
  if (log.semantic_title) lines.push(`Title: ${log.semantic_title}`)
  if (log.direction) lines.push(`Direction: ${log.direction}`)
  lines.push(`Duration: ${log.duration_seconds}s`)
  lines.push(`Booked: ${log.is_booked ? 'yes' : 'no'}`)
  lines.push(`Lead: ${log.is_lead ? 'yes' : 'no'}`)
  if (log.agent_name) lines.push(`Agent: ${log.agent_name}`)
  if (log.caller_name) lines.push(`Caller: ${log.caller_name}`)
  if (log.disposition) lines.push(`Disposition: ${log.disposition}`)
  if (log.sentiment) lines.push(`Sentiment: ${log.sentiment}`)
  if (log.intent) lines.push(`Intent: ${log.intent}`)
  if (log.human_followup_needed) {
    lines.push(`Follow-up needed: yes`)
    if (log.human_followup_reason) lines.push(`Follow-up reason: ${log.human_followup_reason}`)
  }

  // ── AI summary (primary source — already distilled by Retell) ───────────
  const aiSummary = extractAiSummaryText(log)
  if (aiSummary) {
    lines.push('')
    lines.push('## AI Summary')
    lines.push(aiSummary)
  }

  // ── Transcript excerpt (secondary — trimmed aggressively) ───────────────
  if (log.transcript) {
    const excerpt = trimTranscript(log.transcript, TRANSCRIPT_CHAR_CAP)
    if (excerpt) {
      lines.push('')
      lines.push('## Transcript Excerpt')
      lines.push(excerpt)
    }
  }

  const text = lines.join('\n')
  return { text, charCount: text.length }
}

// ── Tenant summary input ─────────────────────────────────────────────────────

/**
 * Build compact input for tenant-level summary generation.
 *
 * Takes recent call logs and produces a condensed overview.
 * Each call: semantic_title + ai_summary (prefer) + tiny excerpt (optional).
 */
export function buildSummaryInput(logs: CallLog[], rangeDays: number): CallInputBundle {
  const capped = logs.slice(0, SUMMARY_CALLS_CAP)

  const lines: string[] = [
    `## Tenant Summary Input (last ${rangeDays} days, ${capped.length} of ${logs.length} calls)`,
    '',
  ]

  // ── Aggregate stats ─────────────────────────────────────────────────────
  const totalCalls = logs.length
  const booked = logs.filter((l) => l.is_booked).length
  const leads = logs.filter((l) => l.is_lead).length
  const followups = logs.filter((l) => l.human_followup_needed).length
  const totalRevenue = logs.reduce((sum, l) => sum + (l.booked_value ?? 0), 0)
  const avgDuration = totalCalls > 0
    ? Math.round(logs.reduce((s, l) => s + (l.duration_seconds ?? 0), 0) / totalCalls)
    : 0

  lines.push('### Aggregate Metrics')
  lines.push(`Total calls: ${totalCalls}`)
  lines.push(`Booked: ${booked} (${totalCalls > 0 ? Math.round((booked / totalCalls) * 100) : 0}%)`)
  lines.push(`Leads: ${leads}`)
  lines.push(`Follow-ups needed: ${followups}`)
  lines.push(`Total booked revenue: $${totalRevenue.toLocaleString()}`)
  lines.push(`Avg duration: ${avgDuration}s`)
  lines.push('')

  // ── Per-call summaries (compact) ────────────────────────────────────────
  lines.push('### Recent Calls')

  for (const log of capped) {
    const parts: string[] = []
    if (log.semantic_title) parts.push(log.semantic_title)
    else parts.push(`Call ${log.id.slice(0, 8)}`)

    if (log.is_booked) parts.push('[BOOKED]')
    if (log.human_followup_needed) parts.push('[FOLLOWUP]')
    if (log.disposition) parts.push(`(${log.disposition})`)

    const summary = extractAiSummaryText(log)
    if (summary) {
      // Truncate long summaries to keep total size manageable
      parts.push(`— ${summary.slice(0, 200)}`)
    }

    lines.push(`- ${parts.join(' ')}`)
  }

  const text = lines.join('\n')
  return { text, charCount: text.length }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the best available AI summary text from a call log.
 * Checks ai_summary (plain text), ai_summary_json, and call_summary_json.
 */
function extractAiSummaryText(log: CallLog): string | null {
  // 1. Plain text summary
  if (log.ai_summary && log.ai_summary.length > 10) {
    return log.ai_summary
  }

  // 2. Structured summary JSON — flatten key fields
  if (log.ai_summary_json && typeof log.ai_summary_json === 'object') {
    const json = log.ai_summary_json as Record<string, unknown>
    const parts: string[] = []
    if (typeof json.outcome === 'string') parts.push(`Outcome: ${json.outcome}`)
    if (typeof json.intent === 'string') parts.push(`Intent: ${json.intent}`)
    if (typeof json.nextBestAction === 'string') parts.push(`Next: ${json.nextBestAction}`)
    if (Array.isArray(json.keyFacts)) {
      parts.push(`Facts: ${(json.keyFacts as string[]).slice(0, 3).join('; ')}`)
    }
    if (parts.length > 0) return parts.join('. ')
  }

  // 3. Call summary JSON
  if (log.call_summary_json && typeof log.call_summary_json === 'object') {
    const json = log.call_summary_json as Record<string, unknown>
    if (typeof json.summary === 'string') return json.summary
  }

  // 4. Basic summary field
  if (log.summary && log.summary.length > 10) {
    return log.summary
  }

  return null
}

/**
 * Trim transcript to first 20% + last 20%, respecting a hard character cap.
 * Returns null if transcript is too short to be useful.
 */
function trimTranscript(transcript: string, charCap: number): string | null {
  if (!transcript || transcript.length < 50) return null

  // Short transcripts: use as-is
  if (transcript.length <= charCap) return transcript

  const sliceSize = Math.floor(charCap * TRANSCRIPT_SLICE_PCT)
  const head = transcript.slice(0, sliceSize)
  const tail = transcript.slice(-sliceSize)

  return `${head}\n\n[... middle trimmed for brevity ...]\n\n${tail}`
}
