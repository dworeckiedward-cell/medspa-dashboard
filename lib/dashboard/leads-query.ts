import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Contact, ContactStatus, CallLogEntry, CallSummary } from '@/lib/types/domain'

/**
 * Derives leads from call_logs where is_lead = true.
 * Groups by caller_phone to produce one Contact per unique phone number.
 * Sorted by most recent call first.
 */
export async function getLeadsFromCallLogs(clientId: string): Promise<Contact[]> {
  const supabase = createSupabaseServerClient()

  const { data: rows, error } = await supabase
    .from('call_logs')
    .select(
      'id, client_id, caller_name, caller_phone, is_booked, is_lead, lead_source, lead_status, disposition, intent, created_at, updated_at, human_followup_needed, human_followup_reason, semantic_title, ai_summary_json, call_summary, summary, ai_summary, transcript, recording_url, direction, duration_seconds, sentiment',
    )
    .eq('client_id', clientId)
    .eq('is_lead', true)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error || !rows) {
    console.error('[leads-query] Failed to fetch leads:', error?.message)
    return []
  }

  // Group by phone number (or id if no phone)
  type Row = (typeof rows)[number]
  const byPhone = new Map<string, Row[]>()
  for (const row of rows) {
    const key = row.caller_phone ?? row.id
    const group = byPhone.get(key) ?? []
    group.push(row)
    byPhone.set(key, group)
  }

  const contacts: Contact[] = []

  const entries = Array.from(byPhone.values())
  for (const group of entries) {
    const latest = group[0] // already sorted desc
    const hasBooking = group.some((r: Row) => r.is_booked)

    // Derive status: prefer DB lead_status, fall back to heuristics
    const dbStatus = latest.lead_status as ContactStatus | null
    const validStatuses: ContactStatus[] = [
      'new', 'contacted', 'booking_link_sent', 'clicked_link', 'booked', 'lost',
      'interested', 'reactivation', 'queued', 'not_interested', 'followup_needed',
    ]
    let status: ContactStatus = dbStatus && validStatuses.includes(dbStatus) ? dbStatus : 'new'

    // Heuristic overrides (only when no explicit DB status or status is still 'new')
    if (!dbStatus || dbStatus === 'new') {
      if (hasBooking) {
        status = 'booked'
      } else if (latest.disposition === 'not_interested') {
        status = 'not_interested'
      } else if (latest.disposition === 'follow_up') {
        status = 'interested'
      } else if (group.length > 1) {
        status = 'contacted'
      }
    }

    // Priority: booked = 90, follow_up = 70, multiple calls = 50, single = 30
    let priorityScore = 30
    if (hasBooking) priorityScore = 90
    else if (latest.disposition === 'follow_up') priorityScore = 70
    else if (group.length > 1) priorityScore = 50

    // Build latestCallSummary from DB fields
    const plainSummary = (latest as Record<string, unknown>).call_summary as string | null
      ?? (latest as Record<string, unknown>).ai_summary as string | null
      ?? (latest as Record<string, unknown>).summary as string | null
      ?? null
    const rawSentiment = (latest as Record<string, unknown>).sentiment as string | null
    const sentiment =
      rawSentiment === 'positive' || rawSentiment === 'neutral' || rawSentiment === 'negative'
        ? rawSentiment
        : null

    const latestCallSummary: CallSummary | null = plainSummary ? {
      id: latest.id,
      callLogId: latest.id,
      tenantId: clientId,
      provider: 'retell',
      model: null,
      plainSummary,
      structuredSummary: buildStructuredSummary(latest.ai_summary_json, latest.intent, latest.disposition),
      sentiment,
      urgency: null,
      createdAt: latest.updated_at ?? latest.created_at,
    } : null

    // Build recentCalls for timeline + transcript
    const recentCalls: CallLogEntry[] = group.map((r) => ({
      id: r.id,
      tenantId: clientId,
      contactId: null,
      direction: ((r as Record<string, unknown>).direction as 'inbound' | 'outbound' | null) ?? 'inbound',
      callType: 'phone',
      durationSec: ((r as Record<string, unknown>).duration_seconds as number | null) ?? 0,
      outcome: r.disposition ?? null,
      startedAt: r.created_at,
      endedAt: r.updated_at ?? r.created_at,
      provider: 'retell',
      providerCallId: null,
      recordingUrl: ((r as Record<string, unknown>).recording_url as string | null) ?? null,
      transcriptText: ((r as Record<string, unknown>).transcript as string | null) ?? null,
      summaryStatus: 'not_applicable',
      transferToHuman: r.human_followup_needed ?? false,
      agentVersion: null,
      summary: buildCallSummaryForEntry(r, clientId),
    }))

    contacts.push({
      id: latest.id,
      tenantId: clientId,
      fullName: latest.caller_name ?? latest.caller_phone ?? 'Unknown',
      phone: latest.caller_phone ?? '',
      email: null,
      tags: [],
      source: latest.lead_source ?? 'phone',
      status,
      ownerType: 'ai',
      priorityScore,
      lastCallAt: latest.created_at,
      nextActionAt: latest.human_followup_needed ? latest.created_at : null,
      createdAt: group[group.length - 1].created_at,
      updatedAt: latest.updated_at ?? latest.created_at,
      latestCallSummary,
      recentCalls,
    })
  }

  return contacts
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>

function buildStructuredSummary(
  aiSummaryJson: Record<string, unknown> | null,
  intent: string | null,
  disposition: string | null,
) {
  const cad = (aiSummaryJson as Row | null) ?? {}
  const intentVal = intent ?? (cad.intent as string | null) ?? null
  const outcomeVal = disposition ?? (cad.outcome as string | null) ?? null
  return (intentVal || outcomeVal)
    ? {
        intent: intentVal,
        outcome: outcomeVal,
        objections: [],
        keyFacts: [],
        sentiment: null,
        urgency: null,
        nextBestAction: null,
        callbackScript: null,
        unansweredQuestions: [],
      }
    : null
}

function buildCallSummaryForEntry(row: Row, tenantId: string): CallSummary | null {
  const plainSummary = (row.call_summary as string | null)
    ?? (row.ai_summary as string | null)
    ?? (row.summary as string | null)
    ?? null
  if (!plainSummary) return null

  const rawSentiment = row.sentiment as string | null
  const sentiment =
    rawSentiment === 'positive' || rawSentiment === 'neutral' || rawSentiment === 'negative'
      ? rawSentiment : null

  return {
    id: row.id as string,
    callLogId: row.id as string,
    tenantId,
    provider: 'retell',
    model: null,
    plainSummary,
    structuredSummary: buildStructuredSummary(
      row.ai_summary_json as Record<string, unknown> | null,
      row.intent as string | null,
      row.disposition as string | null,
    ),
    sentiment,
    urgency: null,
    createdAt: (row.updated_at as string | null) ?? (row.created_at as string),
  }
}
