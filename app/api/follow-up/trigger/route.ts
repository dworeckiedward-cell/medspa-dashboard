import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { differenceInDays, parseISO } from 'date-fns'

// ── Config ────────────────────────────────────────────────────────────────────

const N8N_WEBHOOK = 'https://webhook.xce.pl/webhook/live-younger/follow-up-call'
const RATE_LIMIT_HOURS = 4

// Disconnect reasons that signal an unanswered call
const VOICEMAIL_REASONS = new Set([
  'voicemail_reached',
  'machine_detected',
])
const NO_ANSWER_REASONS = new Set([
  'dial_no_answer',
  'no_answer',
  'busy',
  'user_hangup', // very short — treated as declined
])

function buildLastCallContext(disconnectReason: string | null, summary: string | null): string {
  const reasonPhrase =
    disconnectReason && VOICEMAIL_REASONS.has(disconnectReason)
      ? 'We left a voicemail last time'
      : disconnectReason && NO_ANSWER_REASONS.has(disconnectReason)
        ? "We called but couldn't reach you"
        : 'We tried reaching you previously'

  if (summary) return `${reasonPhrase}. Previous call summary: ${summary}`
  return reasonPhrase
}

// ── Request body ──────────────────────────────────────────────────────────────

interface TriggerBody {
  phone?: unknown
  firstName?: unknown
  tenantSlug?: unknown
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Validate body
  const body = (await req.json()) as TriggerBody
  const phone = typeof body.phone === 'string' ? body.phone.trim() : null
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : 'there'

  if (!phone) {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  // ── Rate limit: max 1 follow-up trigger per phone per RATE_LIMIT_HOURS ──────
  const rateLimitCutoff = new Date(Date.now() - RATE_LIMIT_HOURS * 60 * 60 * 1000).toISOString()
  const { data: recentTriggers } = await supabase
    .from('call_logs')
    .select('id')
    .eq('client_id', tenant.id)
    .eq('caller_phone', phone)
    .eq('call_status', 'follow_up_triggered')
    .gte('created_at', rateLimitCutoff)
    .limit(1)

  if (recentTriggers && recentTriggers.length > 0) {
    return NextResponse.json(
      { error: `Follow-up already triggered for this contact in the last ${RATE_LIMIT_HOURS} hours` },
      { status: 429 },
    )
  }

  // ── Fetch last real call for this phone ──────────────────────────────────────
  const { data: lastCallRows } = await supabase
    .from('call_logs')
    .select('id, caller_phone, caller_name, disconnect_reason, call_summary, summary, created_at, campaign_type')
    .eq('client_id', tenant.id)
    .eq('caller_phone', phone)
    .neq('call_status', 'follow_up_triggered')
    .order('created_at', { ascending: false })
    .limit(1)

  const lastCall = lastCallRows?.[0] ?? null

  // Build context
  const disconnectReason = lastCall?.disconnect_reason ?? null
  const summaryText = (lastCall?.call_summary as string | null) ?? (lastCall?.summary as string | null) ?? null
  const lastCallContext = buildLastCallContext(disconnectReason, summaryText)

  const daysSince = lastCall?.created_at
    ? differenceInDays(new Date(), parseISO(lastCall.created_at as string))
    : null

  const campaignType = (lastCall?.campaign_type as string | null) ?? 'our services'
  const originalCallId = lastCall?.id ?? null

  // ── POST to n8n ──────────────────────────────────────────────────────────────
  try {
    const n8nRes = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        first_name: firstName,
        campaign_type: campaignType,
        tenant_slug: tenant.slug,
        last_call_context: lastCallContext,
        last_call_reason: disconnectReason ?? 'unknown',
        days_since_last_call: daysSince ?? 1,
        original_call_id: originalCallId,
      }),
    })

    if (!n8nRes.ok) {
      console.error('[follow-up/trigger] n8n returned', n8nRes.status)
      return NextResponse.json({ error: 'Failed to queue follow-up call' }, { status: 502 })
    }
  } catch (err) {
    console.error('[follow-up/trigger] n8n fetch error:', err)
    return NextResponse.json({ error: 'Failed to reach call system' }, { status: 502 })
  }

  // ── Insert tracking row (rate-limit sentinel + audit) ────────────────────────
  await supabase.from('call_logs').insert({
    client_id: tenant.id,
    caller_phone: phone,
    caller_name: firstName,
    call_status: 'follow_up_triggered',
    direction: 'outbound',
    call_summary: `Follow-up triggered from dashboard. Original call: ${originalCallId ?? 'unknown'}. Context: ${lastCallContext}`,
    campaign_type: campaignType,
    duration_seconds: 0,
    is_booked: false,
    is_lead: true,
    human_followup_needed: false,
    tags: ['follow_up_triggered'],
  })

  // ── Increment follow_up_count in outbound_call_tracker (best-effort) ─────────
  if (originalCallId) {
    try {
      await supabase.rpc('increment_follow_up_count', { p_call_log_id: originalCallId })
    } catch {
      // rpc may not exist yet — silently ignore
    }
  }

  return NextResponse.json({
    success: true,
    message: 'Follow-up call queued',
    context_sent: lastCallContext,
    days_since: daysSince,
  })
}
