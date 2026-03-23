/**
 * Build compact input text for the agent-optimization insights prompt.
 *
 * Trims each call to MAX_SUMMARY_CHARS so the full batch fits comfortably
 * within a 4–8 k token context window. Sends aggregate stats first so the
 * LLM can reference them without recounting every row.
 */

import { hashInput } from '@/lib/ai/jobs'
import type { CallLog } from '@/types/database'

const MAX_CALLS = 60          // max outbound calls to include
const MAX_SUMMARY_CHARS = 150 // per-call summary length

export interface InsightInput {
  text: string
  inputHash: string
  callCount: number
}

export function buildInsightInput(
  outboundLogs: CallLog[],
  rangeDays: number,
): InsightInput {
  const logs = outboundLogs.slice(0, MAX_CALLS)

  // Aggregate stats (computed server-side; not delegated to LLM)
  const total = logs.length
  const contacted = logs.filter((c) => (c.duration_seconds ?? 0) > 20).length
  const leads = logs.filter((c) => c.is_lead).length
  const booked = logs.filter((c) => c.is_booked).length
  const noAnswer = logs.filter(
    (c) => c.disposition === 'no_answer' || (c.duration_seconds ?? 0) <= 5,
  ).length

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  // Per-call compact rows
  const callLines = logs.map((c) => {
    const raw = c.ai_summary ?? c.summary ?? c.transcript?.slice(0, MAX_SUMMARY_CHARS) ?? ''
    const summary = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_SUMMARY_CHARS)
    const parts: string[] = [
      `[${c.id.slice(0, 8)}]`,
      `${c.duration_seconds ?? 0}s`,
      c.disposition ?? 'unknown',
      c.is_booked ? 'BOOKED' : c.is_lead ? 'LEAD' : 'not_converted',
    ]
    if (summary) parts.push(`"${summary}"`)
    return parts.join(' | ')
  })

  const text = [
    `OUTBOUND CALL BATCH — last ${rangeDays} days, ${total} calls`,
    '',
    'AGGREGATE STATS:',
    `- Total outbound calls: ${total}`,
    `- Contact rate (>20s): ${pct(contacted)}%  (${contacted}/${total})`,
    `- Lead rate:           ${pct(leads)}%  (${leads}/${total})`,
    `- Booked rate:         ${pct(booked)}%  (${booked}/${total})`,
    `- No-answer / <5s:     ${noAnswer}`,
    '',
    'CALL ROWS (id | duration | disposition | outcome | "summary"):',
    ...callLines,
  ].join('\n')

  return { text, inputHash: hashInput(text), callCount: total }
}
