import type { Contact, ContactStatus, CallLogEntry, CallSummary } from '@/lib/types/domain'

/**
 * Pure-JS version of getLeadsFromCallLogs — no Supabase dependency.
 * Accepts a full call_logs row array, filters is_lead=true, groups by phone,
 * and returns Contact[]. Safe to call client-side.
 */
type Row = Record<string, unknown>

export function computeLeads(rows: Row[], tenantId: string): Contact[] {
  // Include rows explicitly flagged as leads OR calls with meaningful engagement:
  // duration > 15s with a caller name, or any call explicitly marked is_lead.
  const leadRows = rows.filter((r) =>
    r.is_lead === true ||
    (Number(r.duration_seconds) > 15 && r.caller_name !== null && r.caller_name !== ''),
  )

  // Group by caller_phone + caller_name so different-named people at the same
  // number appear as separate leads (e.g. family sharing a phone).
  // Falls back to phone-only when name is absent (avoids creating dupes for
  // the same person whose name is sometimes null).
  const byPhone = new Map<string, Row[]>()
  for (const row of leadRows) {
    const phone = (row.caller_phone as string | null) ?? (row.id as string)
    const name = (row.caller_name as string | null)?.trim() ?? ''
    const key = name ? `${phone}::${name}` : phone
    const group = byPhone.get(key) ?? []
    group.push(row)
    byPhone.set(key, group)
  }

  // Sort each group descending by created_at (rows arrive desc from DB but defensive sort)
  Array.from(byPhone.values()).forEach((group) => {
    group.sort((a: Row, b: Row) =>
      String(b.created_at).localeCompare(String(a.created_at)),
    )
  })

  const contacts: Contact[] = []

  for (const group of Array.from(byPhone.values())) {
    const latest = group[0]
    const hasBooking = group.some((r: Row) => r.is_booked === true)

    const dbStatus = latest.lead_status as ContactStatus | null
    const validStatuses: ContactStatus[] = [
      'new', 'contacted', 'booking_link_sent', 'clicked_link', 'booked',
      'lost', 'interested', 'reactivation', 'queued', 'not_interested', 'followup_needed',
    ]
    let status: ContactStatus =
      dbStatus && validStatuses.includes(dbStatus) ? dbStatus : 'new'

    if (!dbStatus || dbStatus === 'new') {
      if (hasBooking) status = 'booked'
      else if (latest.disposition === 'not_interested') status = 'not_interested'
      else if (latest.disposition === 'follow_up') status = 'interested'
      else if (group.length > 1) status = 'contacted'
    }

    let priorityScore = 30
    if (hasBooking) priorityScore = 90
    else if (latest.disposition === 'follow_up') priorityScore = 70
    else if (group.length > 1) priorityScore = 50

    const plainSummary =
      (latest.call_summary as string | null) ??
      (latest.ai_summary as string | null) ??
      (latest.summary as string | null) ??
      null

    const rawSentiment = latest.sentiment as string | null
    const sentiment =
      rawSentiment === 'positive' || rawSentiment === 'neutral' || rawSentiment === 'negative'
        ? rawSentiment
        : null

    const latestCallSummary: CallSummary | null = plainSummary
      ? {
          id: latest.id as string,
          callLogId: latest.id as string,
          tenantId,
          provider: 'retell',
          model: null,
          plainSummary,
          structuredSummary: buildStructuredSummary(
            latest.ai_summary_json as Record<string, unknown> | null,
            latest.intent as string | null,
            latest.disposition as string | null,
          ),
          sentiment,
          urgency: null,
          createdAt: (latest.updated_at as string | null) ?? (latest.created_at as string),
        }
      : null

    const recentCalls: CallLogEntry[] = group.map((r: Row) => ({
      id: r.id as string,
      tenantId,
      contactId: null,
      direction: ((r.direction as string | null) as 'inbound' | 'outbound' | null) ?? 'inbound',
      callType: 'phone',
      durationSec: (r.duration_seconds as number | null) ?? 0,
      outcome: resolveCallOutcome(r.lead_status as string | null, r.disposition as string | null),
      startedAt: r.created_at as string,
      endedAt: (r.updated_at as string | null) ?? (r.created_at as string),
      provider: 'retell',
      providerCallId: null,
      recordingUrl: (r.recording_url as string | null) ?? null,
      transcriptText: (r.transcript as string | null) ?? null,
      summaryStatus: 'not_applicable',
      transferToHuman: (r.human_followup_needed as boolean | null) ?? false,
      agentVersion: null,
      summary: buildCallSummaryForEntry(r, tenantId),
    }))

    contacts.push({
      id: latest.id as string,
      tenantId,
      fullName:
        (latest.caller_name as string | null) ??
        (latest.caller_phone as string | null) ??
        'Unknown',
      phone: (latest.caller_phone as string | null) ?? '',
      email: null,
      tags: [],
      source: (latest.lead_source as string | null) ?? 'phone',
      status,
      ownerType: 'ai',
      priorityScore,
      lastCallAt: latest.created_at as string,
      nextActionAt: latest.human_followup_needed ? (latest.created_at as string) : null,
      createdAt: group[group.length - 1].created_at as string,
      updatedAt: (latest.updated_at as string | null) ?? (latest.created_at as string),
      notes: (latest.notes as string | null) ?? null,
      bookingLinkClickedAt: (latest.booking_link_clicked_at as string | null) ?? null,
      latestCallSummary,
      recentCalls,
    })
  }

  return contacts
}

function buildStructuredSummary(
  aiSummaryJson: Record<string, unknown> | null,
  intent: string | null,
  disposition: string | null,
) {
  const cad = aiSummaryJson ?? {}
  const intentVal = intent ?? (cad.intent as string | null) ?? null
  const outcomeVal = disposition ?? (cad.outcome as string | null) ?? null
  return intentVal || outcomeVal
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
  const plainSummary =
    (row.call_summary as string | null) ??
    (row.ai_summary as string | null) ??
    (row.summary as string | null) ??
    null
  if (!plainSummary) return null

  const rawSentiment = row.sentiment as string | null
  const sentiment =
    rawSentiment === 'positive' || rawSentiment === 'neutral' || rawSentiment === 'negative'
      ? rawSentiment
      : null

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

// Prefer lead_status when it reflects a concrete action (booking link sent, booked, etc.)
// over the Retell-assigned disposition which can be incorrectly classified.
const ACTION_STATUSES = ['booking_link_sent', 'booked', 'clicked_link', 'interested', 'followup_needed']
function resolveCallOutcome(leadStatus: string | null, disposition: string | null): string | null {
  if (leadStatus && ACTION_STATUSES.includes(leadStatus)) return leadStatus
  return disposition ?? null
}
