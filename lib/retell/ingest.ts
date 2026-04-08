/**
 * Canonical Retell webhook ingest handler.
 *
 * Normalizes all Retell event shapes into our call_logs schema and upserts.
 * Used by webhook routes and backfill endpoints.
 *
 * Tenant resolution priority:
 *   1. agent_id → tenant_retell_agents.agent_id
 *   2. agent_id → tenants.retell_agent_id (legacy single-agent)
 *   3. phone → tenants.retell_phone_number
 *   4. metadata.tenant_slug / client_slug → tenants.slug
 *   5. If unknown → return ok=false
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { RetellCall } from './api'

const DEBUG = process.env.DEBUG_RETELL === 'true'

function debug(...args: unknown[]) {
  if (DEBUG) console.log('[retell]', ...args)
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface IngestResult {
  ok: boolean
  retellCallId?: string
  tenantId?: string
  callLogId?: string
  eventType?: string
  error?: string
  skipped?: string
}

type Obj = Record<string, unknown>

// ── Tenant resolution ──────────────────────────────────────────────────────

async function resolveTenantId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  payload: Obj,
  outerPayload?: Obj,
): Promise<string | null> {
  const agentId = str(payload, 'agent_id')
  const meta = (payload.metadata ?? {}) as Obj
  const outerMeta = (outerPayload?.metadata ?? {}) as Obj
  const slug =
    str(meta, 'tenant_slug', 'client_slug') ??
    str(outerMeta, 'tenant_slug', 'client_slug') ??
    str(payload, 'client_slug') ??
    str(outerPayload ?? {}, 'client_slug')
  const fromNumber = str(payload, 'from_number')
  const toNumber = str(payload, 'to_number')

  // 1. agent_id → tenant_retell_agents (table may not exist yet)
  if (agentId) {
    try {
      const { data } = await supabase
        .from('tenant_retell_agents')
        .select('tenant_id')
        .eq('agent_id', agentId)
        .maybeSingle()
      if (data?.tenant_id) {
        debug('Tenant resolved via tenant_retell_agents:', data.tenant_id)
        return data.tenant_id
      }
    } catch {
      debug('tenant_retell_agents table not available, skipping')
    }
  }

  // 2. agent_id → tenants.retell_agent_id (legacy)
  if (agentId) {
    const { data } = await supabase
      .from('tenants')
      .select('id')
      .eq('retell_agent_id', agentId)
      .eq('is_active', true)
      .maybeSingle()
    if (data?.id) {
      debug('Tenant resolved via tenants.retell_agent_id:', data.id)
      return data.id
    }
  }

  // 3. phone → tenants.retell_phone_number
  const phone = toNumber ?? fromNumber
  if (phone) {
    const { data } = await supabase
      .from('tenants')
      .select('id')
      .eq('retell_phone_number', phone)
      .eq('is_active', true)
      .maybeSingle()
    if (data?.id) {
      debug('Tenant resolved via retell_phone_number:', data.id)
      return data.id
    }
  }

  // 4. slug
  if (slug) {
    const { data } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()
    if (data?.id) {
      debug('Tenant resolved via slug:', data.id)
      return data.id
    }
  }

  return null
}

// ── Normalize Retell call → DB row ─────────────────────────────────────────

/**
 * Normalize a Retell payload into a call_logs DB row.
 *
 * IMPORTANT: Only write columns confirmed to exist in production call_logs.
 * Migration-023 columns (from_number, to_number, started_at, ended_at,
 * cost_usd, retell_agent_id, call_status, call_summary_json, disconnect_reason)
 * may not exist — do NOT include them. The full Retell payload is stored in
 * raw_payload so values can be derived at read-time.
 */
// truthy handles boolean true and the string "true" / "yes" / "1" from LLM outputs
function truthy(obj: Obj, ...keys: string[]): boolean {
  for (const k of keys) {
    const v = obj[k]
    if (v === true || v === 'true' || v === 'yes' || v === '1' || v === 1) return true
  }
  return false
}

function normalizeCallToRow(payload: Obj, tenantId: string, originalPayload?: Obj): Obj | null {
  const meta = (payload.metadata ?? {}) as Obj
  // Skip web calls — browser-based test calls from Retell dashboard
  const callType = str(meta, 'call_type') ?? str(payload, 'call_type')
  if (callType === 'web_call') {
    return null
  }

  const analysis = (payload.call_analysis ?? {}) as Obj
  const cad = (analysis.custom_analysis_data ?? {}) as Obj
  const dynVars = (payload.retell_llm_dynamic_variables ?? {}) as Obj

  const startMs = typeof payload.start_timestamp === 'number' ? payload.start_timestamp : null
  const endMs = typeof payload.end_timestamp === 'number' ? payload.end_timestamp : null
  const durationMs = typeof payload.duration_ms === 'number' ? payload.duration_ms : null
  const durationSec = durationMs
    ? Math.round(durationMs / 1000)
    : endMs && startMs
      ? Math.round((endMs - startMs) / 1000)
      : null

  // booking_interest field from LLM analysis → disposition
  const bookingInterest = str(cad, 'booking_interest', 'bookingInterest')
  const cadDisposition = bookingInterest
    ? (bookingInterest === 'yes' || bookingInterest === 'true' ? 'booked' : 'not_interested')
    : str(cad, 'disposition')

  // Auto-detect leads: any real conversation (patient spoke, introduced themselves, etc.)
  const hasTranscript = typeof payload.transcript === 'string' && payload.transcript.trim().length > 0
  const resolvedCallerName =
    str(meta, 'caller_name') ?? str(cad, 'patient_name') ?? str(cad, 'caller_name') ??
    str(cad, 'patientName') ?? str(dynVars, 'first_name') ?? str(dynVars, 'patient_name') ?? null

  const resolvedCallSummary = str(analysis, 'call_summary') ?? str(payload, 'call_summary') ?? null

  // Sentiment resolution:
  //  • Inbound  → trust Retell's user_sentiment (reliable for real conversations)
  //  • Outbound → Retell defaults to "neutral" for voicemail/no-answer; derive
  //               from booking_interest instead, and suppress for missed calls.
  const direction = str(payload, 'direction') ?? str(meta, 'direction') ?? 'inbound'
  const disconnectReason = str(payload, 'disconnection_reason') ?? str(payload, 'disconnect_reason') ?? null
  const MISSED_REASONS = new Set(['voicemail_reached', 'machine_detected', 'dial_no_answer', 'dial_failed'])

  // human_followup_needed: starts from LLM flag, may be promoted by disconnect reason
  let humanFollowupNeeded = truthy(cad, 'human_followup_needed', 'humanFollowupNeeded')
  const humanFollowupReason = str(cad, 'human_followup_reason', 'humanFollowupReason')

  let resolvedSentiment: string | null
  if (direction === 'outbound' && disconnectReason && MISSED_REASONS.has(disconnectReason)) {
    // Voicemail / no-answer — no real conversation happened → follow_up
    resolvedSentiment = 'follow_up'
    humanFollowupNeeded = true
  } else if (direction === 'outbound') {
    // Outbound with real conversation: derive from booking_interest first
    if (bookingInterest === 'ready' || bookingInterest === 'warm' || bookingInterest === 'yes' || bookingInterest === 'true') {
      resolvedSentiment = 'positive'
    } else if (bookingInterest === 'not_interested' || bookingInterest === 'no') {
      resolvedSentiment = 'negative'
    } else if (humanFollowupNeeded) {
      resolvedSentiment = 'follow_up'
    } else {
      // Fall back to Retell's user_sentiment (same as inbound — reliable for real conversations)
      resolvedSentiment = (str(analysis, 'user_sentiment') ?? str(cad, 'sentiment') ?? str(meta, 'sentiment') ?? null)?.toLowerCase() ?? 'neutral'
    }
  } else {
    // Inbound: always trust Retell's user_sentiment — human_followup_needed is
    // independent and only controls the follow-up queue, not the sentiment display.
    resolvedSentiment = (str(analysis, 'user_sentiment') ?? str(cad, 'sentiment') ?? str(meta, 'sentiment') ?? null)?.toLowerCase() ?? null
  }

  console.log('[RetellWebhook] extracted fields:', {
    resolvedCallerName,
    resolvedCallSummary: resolvedCallSummary?.slice(0, 100) ?? null,
    resolvedSentiment,
    bookingInterest,
    hasTranscript,
    cad_patient_name: cad.patient_name,
    cad_keys: Object.keys(cad),
  })
  const autoIsLead =
    (durationSec !== null && durationSec >= 15) ||
    hasTranscript ||
    resolvedCallerName !== null ||
    (bookingInterest === 'ready' || bookingInterest === 'warm') ||
    truthy(cad, 'send_booking_link', 'sendBookingLink')

  return {
    // ── Core identifiers ──────────────────────────────────────────────
    client_id: tenantId,
    tenant_id: tenantId,
    external_call_id: str(payload, 'call_id', 'retell_call_id') ?? null,

    // ── Agent info ────────────────────────────────────────────────────
    agent_name: str(payload, 'agent_name') ?? str(meta, 'agent_name') ?? null,
    agent_provider: 'retell',

    // ── Call metadata ─────────────────────────────────────────────────
    direction: str(payload, 'direction') ?? str(meta, 'direction') ?? 'inbound',
    // For inbound calls: from_number = patient's phone.
    // For outbound calls: from_number = clinic phone, to_number = patient's phone.
    caller_phone: (str(payload, 'direction') === 'outbound'
      ? str(payload, 'to_number')
      : str(payload, 'from_number')) ?? null,
    caller_name: resolvedCallerName,
    contacted_at: startMs ? new Date(startMs).toISOString() : null,
    duration_seconds: durationSec ?? null,

    // ── Content ───────────────────────────────────────────────────────
    recording_url: str(payload, 'recording_url') || null,
    call_summary: resolvedCallSummary,
    summary: resolvedCallSummary,
    ai_summary: resolvedCallSummary,
    transcript: str(payload, 'transcript') ?? null,
    ai_summary_json: analysis.custom_analysis_data ?? (Object.keys(analysis).length > 0 ? analysis : null),
    // Store the original event wrapper so the full payload is in raw_payload
    raw_payload: originalPayload ?? payload,

    // ── Classification / outcome (from metadata or analysis) ─────────
    semantic_title: str(meta, 'semantic_title')
      ?? str(cad, 'semantic_title')
      ?? str(cad, 'call_title')
      ?? str(cad, 'semanticTitle')
      ?? str(analysis, 'call_summary')?.slice(0, 80)
      ?? resolvedCallerName  // Fall back to patient name so something useful shows in the table
      ?? null,
    call_type: str(meta, 'call_type') ?? str(payload, 'call_type') ?? 'other',
    is_booked: truthy(meta, 'is_booked') || truthy(cad, 'is_booked', 'isBooked'),
    is_lead: truthy(meta, 'is_lead') || truthy(cad, 'is_lead', 'isLead') || autoIsLead,
    // Retell's LLM estimate — may be overridden by resolveServiceRevenue after this function
    potential_revenue: typeof cad.potential_revenue === 'number'
      ? cad.potential_revenue
      : typeof meta.potential_revenue === 'number'
        ? meta.potential_revenue
        : 0,
    booked_value: typeof meta.booked_value === 'number' ? meta.booked_value : 0,
    inquiries_value: typeof meta.inquiries_value === 'number' ? meta.inquiries_value : 0,
    disposition: disconnectReason === 'voicemail_reached' || disconnectReason === 'machine_detected'
      ? 'voicemail'
      : disconnectReason === 'dial_no_answer' || disconnectReason === 'dial_failed'
        ? 'no_answer'
        : str(meta, 'disposition') ?? cadDisposition ?? null,
    sentiment: resolvedSentiment,
    intent: str(meta, 'intent') ?? str(cad, 'intent') ?? null,
    human_followup_needed: humanFollowupNeeded,
    ...(humanFollowupReason ? { human_followup_reason: humanFollowupReason } : {}),

    // ── Lead source ────────────────────────────────────────────────────
    lead_source: str(meta, 'lead_source') ?? null,

    // ── Lead status (funnel stage) ─────────────────────────────────────
    // Set automatically based on call signals; never downgrade (handled by ignoreDuplicates logic
    // — the PATCH /book/ly/[callId] route upgrades to 'clicked_link' separately).
    ...(truthy(cad, 'send_booking_link', 'sendBookingLink')
      ? { lead_status: 'booking_link_sent' }
      : autoIsLead
        ? { lead_status: 'new' }
        : {}),

    // ── FB Leads enrichment (migration 027) — purely additive ─────────
    ...(str(meta, 'fb_ad_id')       ? { fb_ad_id: str(meta, 'fb_ad_id') }             : {}),
    ...(str(meta, 'fb_campaign_id') ? { fb_campaign_id: str(meta, 'fb_campaign_id') }   : {}),
    ...(str(meta, 'fb_lead_id')     ? { fb_lead_id: str(meta, 'fb_lead_id') }           : {}),
    ...(str(meta, 'ad_set_name')    ? { ad_set_name: str(meta, 'ad_set_name') }         : {}),
    ...(typeof meta.lead_cost_cents === 'number' ? { lead_cost_cents: meta.lead_cost_cents } : {}),

    // ── outbound_type — follow_up agent detection ──────────────────────
    outbound_type: str(payload, 'agent_id') === 'agent_cadb92b746c62e309fe5c675e3'
      ? 'follow_up'
      : str(meta, 'outbound_type') ?? null,

    // ── Migration 023 columns ──────────────────────────────────────────
    disconnect_reason: str(payload, 'disconnection_reason') ?? str(payload, 'disconnect_reason') ?? null,

    // ── Migration 040: AI cost tracking ───────────────────────────────
    // Retell sends `cost` as a float dollar amount on the call object (e.g. 0.23 = $0.23).
    // Since we unwrap the payload before calling this function, payload.cost is direct.
    cost_cents: typeof payload.cost === 'number' ? Math.round(payload.cost * 100) : null,

    updated_at: new Date().toISOString(),
  }
}

// ── Canonical handler ─────────────────────────────────────────────────────

/**
 * Process a Retell webhook payload or API call object.
 * Normalizes, resolves tenant, and upserts into call_logs.
 */
export async function handleRetellWebhook(
  payload: unknown,
): Promise<IngestResult> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'Invalid payload' }
  }

  const obj = payload as Obj

  // ── Unwrap Retell's nested format ─────────────────────────────────────────
  // Retell delivers: { event: "call_ended", call: { call_id, agent_id,
  //   call_analysis, transcript, recording_url, duration_ms, cost, ... } }
  // n8n may forward the same structure verbatim.
  // Flatten so all downstream code works on a single-level object.
  const eventType = str(obj, 'event', 'event_type') ?? 'call_ended'
  const callPayload: Obj =
    obj.call && typeof obj.call === 'object' && !Array.isArray(obj.call)
      ? { event: eventType, ...(obj.call as Obj) }
      : obj

  const retellCallId = str(callPayload, 'call_id', 'retell_call_id') ?? undefined

  console.log('[RetellWebhook] incoming event:', eventType, {
    has_call_wrapper: !!(obj.call && typeof obj.call === 'object'),
    call_id: retellCallId,
    agent_id: str(callPayload, 'agent_id'),
    direction: str(callPayload, 'direction'),
    from_number: str(callPayload, 'from_number'),
    to_number: str(callPayload, 'to_number'),
    has_transcript: !!(callPayload.transcript),
    has_recording_url: !!(callPayload.recording_url),
    has_call_analysis: !!(callPayload.call_analysis),
    duration_ms: callPayload.duration_ms,
    disconnection_reason: str(callPayload, 'disconnection_reason'),
    cost: callPayload.cost,
    metadata_keys: Object.keys((callPayload.metadata as Obj | null) ?? {}),
    cad_keys: Object.keys(
      ((callPayload.call_analysis as Obj | null)?.custom_analysis_data as Obj | null) ?? {}
    ),
  })
  // Full payload log (first 3000 chars) — helps debug field extraction issues
  console.log('[RetellWebhook] full payload:', JSON.stringify(obj).substring(0, 3000))

  const supabase = createSupabaseServerClient()

  // Resolve tenant (pass unwrapped payload so agent_id / phone are visible).
  // Also pass the outer obj so that n8n wrapper metadata.client_slug is used as fallback.
  const tenantId = await resolveTenantId(supabase, callPayload, obj)
  if (!tenantId) {
    console.warn('[RetellWebhook] Could not resolve tenant. Payload keys:', Object.keys(callPayload))
    return { ok: false, retellCallId, eventType, error: 'Could not resolve tenant' }
  }

  // Handle "test" events with a minimal row
  if (eventType === 'test' || eventType === 'ping') {
    const now = new Date().toISOString()
    const testRow = {
      client_id: tenantId,
      external_call_id: `test-${Date.now()}`,
      agent_provider: 'retell',
      contacted_at: now,
      duration_seconds: 0,
      call_type: 'other',
      ai_summary_json: obj,
      raw_payload: obj,
      created_at: now,
      updated_at: now,
    }

    const { data, error } = await supabase
      .from('call_logs')
      .insert(testRow)
      .select('id')
      .single()

    if (error) {
      debug('Test insert error:', error.message)
      return { ok: false, retellCallId, tenantId, eventType, error: error.message }
    }
    return { ok: true, retellCallId, tenantId, callLogId: data.id, eventType }
  }

  // Normalize to DB row — pass unwrapped callPayload for field extraction,
  // and the original outer obj so raw_payload stores the full event envelope.
  const row = normalizeCallToRow(callPayload, tenantId, obj)
  if (!row) return { ok: true, skipped: 'web_call' }

  // potential_revenue: only count positive-sentiment calls where we know the service
  // (negative/neutral calls are interest signals, not revenue commitments)
  const cad0 = ((callPayload.call_analysis as Obj | null)?.custom_analysis_data ?? {}) as Obj
  const serviceRequested = str(cad0, 'service_requested', 'serviceRequested', 'service', 'intent')
  const isPositive = (row.sentiment as string | null) === 'positive'
  row.potential_revenue = isPositive
    ? await resolveServiceRevenue(
        supabase,
        tenantId,
        serviceRequested,
        typeof row.potential_revenue === 'number' ? row.potential_revenue : 0,
      )
    : 0

  // Upsert by external_call_id if available
  if (row.external_call_id) {
    // Build update-only fields: skip nulls so wave-2 (enriched) never overwrites
    // wave-1 (basic) data with null, and vice-versa. E.g. caller_name from the
    // initial call_started event must survive the call_ended event if it's missing there.
    // Also skip boolean false for is_lead / is_booked — once true, never downgrade.
    const STICKY_TRUE = new Set(['is_lead', 'is_booked'])
    const updateFields = Object.fromEntries(
      Object.entries(row).filter(([k, v]) => {
        if (v === null || v === undefined) return false
        if (STICKY_TRUE.has(k) && v === false) return false
        return true
      }),
    )
    updateFields.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('call_logs')
      .upsert(
        // Use only non-null fields so existing DB values are never clobbered by null.
        // created_at is added here so it's set on INSERT but not on UPDATE (DB keeps original).
        { ...updateFields, created_at: new Date().toISOString() },
        { onConflict: 'client_id,external_call_id', ignoreDuplicates: false },
      )
      .select('id')
      .single()

    if (error) {
      debug('Upsert error:', error.message)
      return { ok: false, retellCallId, tenantId, eventType, error: error.message }
    }

    // Decrement wallet (fire-and-forget)
    const dur = typeof row.duration_seconds === 'number' ? row.duration_seconds : 0
    decrementWallet(supabase, tenantId, dur)

    // Track follow-up attempts (fire-and-forget)
    const callerPhoneU = row.caller_phone as string | null
    if (row.direction === 'outbound' && callerPhoneU) {
      updateFollowUpTracking(supabase, tenantId, callerPhoneU)
    }

    return { ok: true, retellCallId, tenantId, callLogId: data.id, eventType }
  }

  // No external_call_id — plain insert
  const { data, error } = await supabase
    .from('call_logs')
    .insert({ ...row, created_at: new Date().toISOString() })
    .select('id')
    .single()

  if (error) {
    debug('Insert error:', error.message)
    return { ok: false, retellCallId, tenantId, eventType, error: error.message }
  }

  // Decrement wallet (fire-and-forget)
  const dur = typeof row.duration_seconds === 'number' ? row.duration_seconds : 0
  decrementWallet(supabase, tenantId, dur)

  // Track follow-up attempts (fire-and-forget)
  const callerPhone = row.caller_phone as string | null
  if (row.direction === 'outbound' && callerPhone) {
    updateFollowUpTracking(supabase, tenantId, callerPhone)
  }

  return { ok: true, retellCallId, tenantId, callLogId: data.id, eventType }
}

/**
 * Normalize a Retell API call object (from listCalls/getCall) and upsert.
 * Used by backfill and refresh endpoints.
 */
export async function ingestRetellCall(
  call: RetellCall,
  tenantId: string,
): Promise<IngestResult> {
  const supabase = createSupabaseServerClient()
  const row = normalizeCallToRow(call as unknown as Obj, tenantId)
  if (!row) return { ok: true, skipped: 'web_call' }

  // potential_revenue: only positive-sentiment calls
  const callObj = call as unknown as Obj
  const cad1 = ((callObj.call_analysis as Obj | null)?.custom_analysis_data ?? {}) as Obj
  const serviceReq = str(cad1, 'service_requested', 'serviceRequested', 'service', 'intent')
  const isPositive1 = (row.sentiment as string | null) === 'positive'
  row.potential_revenue = isPositive1
    ? await resolveServiceRevenue(
        supabase,
        tenantId,
        serviceReq,
        typeof row.potential_revenue === 'number' ? row.potential_revenue : 0,
      )
    : 0

  if (row.external_call_id) {
    const { data, error } = await supabase
      .from('call_logs')
      .upsert(
        { ...row, created_at: new Date().toISOString() },
        { onConflict: 'client_id,external_call_id', ignoreDuplicates: false },
      )
      .select('id')
      .single()

    if (error) {
      return { ok: false, retellCallId: call.call_id, tenantId, error: error.message }
    }
    const dur1 = typeof row.duration_seconds === 'number' ? row.duration_seconds : 0
    decrementWallet(supabase, tenantId, dur1)
    return { ok: true, retellCallId: call.call_id, tenantId, callLogId: data.id }
  }

  const { data, error } = await supabase
    .from('call_logs')
    .insert({ ...row, created_at: new Date().toISOString() })
    .select('id')
    .single()

  if (error) {
    return { ok: false, retellCallId: call.call_id, tenantId, error: error.message }
  }
  const dur2 = typeof row.duration_seconds === 'number' ? row.duration_seconds : 0
  decrementWallet(supabase, tenantId, dur2)
  return { ok: true, retellCallId: call.call_id, tenantId, callLogId: data.id }
}

// ── Follow-up tracking ────────────────────────────────────────────────────

/**
 * After an outbound call completes, find the most recent inbound call_log with
 * human_followup_needed=true for this phone and increment its follow_up_count.
 * If count reaches 3, mark it exhausted (human_followup_needed=false, lead_status=follow_up_exhausted).
 * Fire-and-forget — never blocks call ingestion.
 */
async function updateFollowUpTracking(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  tenantId: string,
  callerPhone: string,
): Promise<void> {
  try {
    const { data: original } = await supabase
      .from('call_logs')
      .select('id, follow_up_count')
      .eq('client_id', tenantId)
      .eq('caller_phone', callerPhone)
      .eq('human_followup_needed', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!original) return

    const newCount = ((original.follow_up_count as number) ?? 0) + 1
    const exhausted = newCount >= 3

    await supabase
      .from('call_logs')
      .update({
        follow_up_count: newCount,
        last_follow_up_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(exhausted ? { human_followup_needed: false, lead_status: 'follow_up_exhausted' } : {}),
      })
      .eq('id', original.id)

    debug('Follow-up tracking updated:', { phone: callerPhone, newCount, exhausted })
  } catch (err) {
    debug('Follow-up tracking update failed (non-blocking):', err)
  }
}

// ── Wallet: decrement available_seconds ───────────────────────────────────

/**
 * Atomically decrement the tenant's available_seconds after a call.
 * Uses a DB-side RPC (migration 028) with GREATEST(0, ...) to prevent
 * going negative and avoid race conditions.
 * Fire-and-forget — a failed decrement must never block call ingestion.
 */
async function decrementWallet(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  tenantId: string,
  durationSec: number,
): Promise<void> {
  if (durationSec <= 0) return
  try {
    await supabase.rpc('decrement_wallet', {
      p_client_id: tenantId,
      p_seconds: durationSec,
    })
    debug('Wallet decremented:', { tenantId, durationSec })
  } catch (err) {
    debug('Wallet decrement failed (non-blocking):', err)
  }
}

// ── Service price resolution ──────────────────────────────────────────────

/**
 * Fuzzy-match `serviceRequested` against tenant_services.name and return
 * the matched price in dollars (price_cents / 100).
 *
 * Strategy:
 *   1. Direct substring: service name ILIKE '%<serviceRequested>%'  (DESC price)
 *   2. Word-by-word: try each meaningful word from serviceRequested    (DESC price, price > 0)
 *   3. Fall back to the provided `fallback` value (Retell's LLM estimate)
 */
async function resolveServiceRevenue(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  tenantId: string,
  serviceRequested: string | null,
  fallback: number,
): Promise<number> {
  if (!serviceRequested) return fallback

  // 1. Direct substring match on full string
  const { data: direct } = await supabase
    .from('tenant_services')
    .select('price_cents')
    .eq('tenant_id', tenantId)
    .ilike('name', `%${serviceRequested}%`)
    .order('price_cents', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (direct?.price_cents != null && direct.price_cents > 0) {
    debug('Service revenue resolved (direct):', serviceRequested, '->', direct.price_cents)
    return direct.price_cents / 100
  }

  // 2. Word-by-word fallback — skip short/stop words
  const words = serviceRequested.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
  for (const word of words) {
    const { data: byWord } = await supabase
      .from('tenant_services')
      .select('price_cents')
      .eq('tenant_id', tenantId)
      .ilike('name', `%${word}%`)
      .gt('price_cents', 0)
      .order('price_cents', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (byWord?.price_cents != null && byWord.price_cents > 0) {
      debug('Service revenue resolved (word):', word, '->', byWord.price_cents)
      return byWord.price_cents / 100
    }
  }

  debug('Service revenue: no match for', serviceRequested, '— using fallback', fallback)
  return fallback
}

// ── Helpers ────────────────────────────────────────────────────────────────

function str(obj: Obj, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}
