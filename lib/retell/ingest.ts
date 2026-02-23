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
}

type Obj = Record<string, unknown>

// ── Tenant resolution ──────────────────────────────────────────────────────

async function resolveTenantId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  payload: Obj,
): Promise<string | null> {
  const agentId = str(payload, 'agent_id')
  const meta = (payload.metadata ?? {}) as Obj
  const slug = str(meta, 'tenant_slug', 'client_slug') ?? str(payload, 'client_slug')
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

function normalizeCallToRow(payload: Obj, tenantId: string): Obj {
  const meta = (payload.metadata ?? {}) as Obj
  const analysis = (payload.call_analysis ?? {}) as Obj

  const startMs = typeof payload.start_timestamp === 'number' ? payload.start_timestamp : null
  const endMs = typeof payload.end_timestamp === 'number' ? payload.end_timestamp : null
  const durationMs = typeof payload.duration_ms === 'number' ? payload.duration_ms : null
  const durationSec = durationMs ? Math.round(durationMs / 1000) : (endMs && startMs ? Math.round((endMs - startMs) / 1000) : null)

  // Cost: Retell may include cost or we derive later
  const costUsd = typeof payload.cost === 'number' ? payload.cost : null

  return {
    client_id: tenantId,
    external_call_id: str(payload, 'call_id', 'retell_call_id') ?? null,
    retell_agent_id: str(payload, 'agent_id') ?? null,
    agent_name: str(payload, 'agent_name') ?? str(meta, 'agent_name') ?? null,
    agent_provider: 'retell',
    call_status: str(payload, 'call_status', 'status') ?? null,
    direction: str(payload, 'direction') ?? str(meta, 'direction') ?? null,
    from_number: str(payload, 'from_number') ?? null,
    to_number: str(payload, 'to_number') ?? null,
    caller_phone: str(payload, 'from_number') ?? null,
    started_at: startMs ? new Date(startMs).toISOString() : null,
    ended_at: endMs ? new Date(endMs).toISOString() : null,
    duration_seconds: durationSec ?? 0,
    cost_usd: costUsd,
    recording_url: str(payload, 'recording_url') || null,
    summary: str(analysis, 'call_summary') ?? str(payload, 'call_summary') ?? null,
    ai_summary: str(analysis, 'call_summary') ?? null,
    transcript: str(payload, 'transcript') ?? null,
    call_summary_json: analysis.custom_analysis_data ?? analysis ?? null,
    ai_summary_json: analysis.custom_analysis_data ?? null,
    raw_payload: payload,
    disconnect_reason: str(payload, 'disconnect_reason') ?? null,
    // Metadata fields
    semantic_title: str(meta, 'semantic_title') ?? null,
    caller_name: str(meta, 'caller_name') ?? null,
    call_type: str(meta, 'call_type') ?? str(payload, 'call_type') ?? 'other',
    is_booked: meta.is_booked === true,
    is_lead: meta.is_lead === true,
    potential_revenue: typeof meta.potential_revenue === 'number' ? meta.potential_revenue : 0,
    booked_value: typeof meta.booked_value === 'number' ? meta.booked_value : 0,
    inquiries_value: typeof meta.inquiries_value === 'number' ? meta.inquiries_value : 0,
    disposition: str(meta, 'disposition') ?? null,
    sentiment: str(meta, 'sentiment') ?? null,
    intent: str(meta, 'intent') ?? null,
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
  const retellCallId = str(obj, 'call_id', 'retell_call_id') ?? undefined
  const eventType = str(obj, 'event', 'event_type') ?? 'call_ended'

  debug('Processing event:', { retellCallId, eventType })

  const supabase = createSupabaseServerClient()

  // Resolve tenant
  const tenantId = await resolveTenantId(supabase, obj)
  if (!tenantId) {
    debug('Could not resolve tenant for payload')
    return { ok: false, retellCallId, eventType, error: 'Could not resolve tenant' }
  }

  // Normalize to DB row
  const row = normalizeCallToRow(obj, tenantId)

  // Upsert by external_call_id if available
  if (row.external_call_id) {
    // Build update-only fields: don't overwrite non-null with null
    const updateFields = Object.fromEntries(
      Object.entries(row).filter(([, v]) => v !== null && v !== undefined),
    )
    // Always update updated_at
    updateFields.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('call_logs')
      .upsert(
        { ...row, created_at: new Date().toISOString() },
        { onConflict: 'client_id,external_call_id', ignoreDuplicates: false },
      )
      .select('id')
      .single()

    if (error) {
      debug('Upsert error:', error.message)
      return { ok: false, retellCallId, tenantId, eventType, error: error.message }
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
  return { ok: true, retellCallId: call.call_id, tenantId, callLogId: data.id }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function str(obj: Obj, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}
