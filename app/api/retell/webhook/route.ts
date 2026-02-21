import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// ─── Retell/n8n Webhook Payload Schema ────────────────────────────────────────
// TODO: Update field names to match actual Retell API v2 spec once confirmed.
// See: https://docs.retell.ai/api-references/webhook
// This schema uses .passthrough() to allow unknown fields stored in raw_payload.

const RetellWebhookSchema = z.object({
  // Retell call identifier
  call_id: z.string().optional(),

  // Agent that handled the call — used for tenant resolution if no client_slug
  agent_id: z.string().optional(),

  // Explicit tenant routing (preferred for n8n workflows)
  client_slug: z.string().optional(),

  // Caller phone number (E.164 format)
  from_number: z.string().optional(),
  to_number: z.string().optional(),

  // Call duration — Retell uses ms, n8n may send seconds directly
  call_duration_ms: z.number().optional(),
  duration_seconds: z.number().optional(),

  // AI-generated content
  call_summary: z.string().optional(),
  transcript: z.string().optional(),

  // Recording
  recording_url: z.string().url().optional().or(z.literal('')),

  // Call type (can also be in metadata)
  call_type: z
    .enum(['inbound_inquiry', 'booking', 'reschedule', 'cancellation', 'support', 'spam', 'other'])
    .optional(),

  // Structured AI analysis — populated by n8n post-processing or Retell custom analysis
  metadata: z
    .object({
      semantic_title: z.string().optional(),
      caller_name: z.string().optional(),
      call_type: z.string().optional(),
      is_booked: z.boolean().optional(),
      is_lead: z.boolean().optional(),
      lead_confidence: z.number().min(0).max(1).optional(),
      potential_revenue: z.number().min(0).optional(),
      booked_value: z.number().min(0).optional(),
      inquiries_value: z.number().min(0).optional(),
      human_followup_needed: z.boolean().optional(),
      human_followup_reason: z.string().optional(),
      tags: z.array(z.string()).optional(),
      client_slug: z.string().optional(), // alt location for tenant routing
    })
    .optional(),
}).passthrough() // Store unknown fields in raw_payload without rejecting

export async function POST(request: NextRequest) {
  // ── Auth: Validate x-api-key or Bearer token ──────────────────────────────
  const apiKey =
    request.headers.get('x-api-key') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  const expectedKey = process.env.WEBHOOK_API_KEY

  if (!expectedKey) {
    console.error('[webhook] WEBHOOK_API_KEY env var not set')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (!apiKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = RetellWebhookSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const payload = parsed.data
  const supabase = createSupabaseServerClient()

  // ── Resolve tenant ────────────────────────────────────────────────────────
  // Priority: metadata.client_slug > top-level client_slug > agent_id lookup
  const clientSlug = payload.metadata?.client_slug ?? payload.client_slug

  let clientId: string | null = null

  if (clientSlug) {
    const { data } = await supabase
      .from('clients')
      .select('id')
      .eq('slug', clientSlug)
      .eq('is_active', true)
      .single()
    clientId = data?.id ?? null
  } else if (payload.agent_id) {
    const { data } = await supabase
      .from('clients')
      .select('id')
      .eq('retell_agent_id', payload.agent_id)
      .eq('is_active', true)
      .single()
    clientId = data?.id ?? null
  }

  if (!clientId) {
    return NextResponse.json(
      {
        error: 'Tenant not found',
        hint: 'Provide agent_id matching clients.retell_agent_id, or client_slug in body/metadata',
      },
      { status: 404 },
    )
  }

  // ── Map payload → call_log row ────────────────────────────────────────────
  const meta = payload.metadata ?? {}

  const durationSeconds =
    payload.duration_seconds ??
    (payload.call_duration_ms ? Math.round(payload.call_duration_ms / 1000) : 0)

  const callLogRow = {
    client_id: clientId,
    external_call_id: payload.call_id ?? null,
    caller_name: meta.caller_name ?? null,
    caller_phone: payload.from_number ?? null,
    semantic_title: meta.semantic_title ?? null,
    // call_type can be in metadata (preferred) or top-level
    call_type: (meta.call_type ?? payload.call_type ?? 'other') as string,
    summary: payload.call_summary ?? null,
    transcript: payload.transcript ?? null,
    recording_url: payload.recording_url || null,
    duration_seconds: durationSeconds,
    potential_revenue: meta.potential_revenue ?? 0,
    booked_value: meta.booked_value ?? 0,
    inquiries_value: meta.inquiries_value ?? 0,
    is_booked: meta.is_booked ?? false,
    lead_confidence: meta.lead_confidence ?? null,
    is_lead: meta.is_lead ?? false,
    human_followup_needed: meta.human_followup_needed ?? false,
    human_followup_reason: meta.human_followup_reason ?? null,
    tags: meta.tags ?? [],
    raw_payload: rawBody, // Store full original payload for debugging
  }

  // ── Write to DB: upsert if external_call_id known, insert otherwise ────────
  const isIdempotent = callLogRow.external_call_id !== null

  let dbData: { id: string } | null = null
  let dbError: { message: string } | null = null

  if (isIdempotent) {
    // Upsert: safe for n8n retries / Retell duplicate deliveries.
    // Relies on: UNIQUE INDEX call_logs_client_external_uniq
    //   ON call_logs (client_id, external_call_id)  — full index, not partial
    const result = await supabase
      .from('call_logs')
      .upsert(callLogRow, {
        onConflict: 'client_id,external_call_id',
        ignoreDuplicates: false, // always overwrite enriched fields on retry
      })
      .select('id')
      .single()
    dbData = result.data
    dbError = result.error
    if (process.env.NODE_ENV !== 'production') {
      console.debug(
        `[webhook] upsert call_id=${callLogRow.external_call_id} → ${result.error ? 'error' : 'ok'}`,
      )
    }
  } else {
    // No external_call_id — cannot deduplicate, plain insert.
    const result = await supabase.from('call_logs').insert(callLogRow).select('id').single()
    dbData = result.data
    dbError = result.error
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[webhook] insert (no external_call_id — not idempotent)')
    }
  }

  if (dbError) {
    console.error('[webhook] DB write failed:', dbError.message)
    return NextResponse.json({ error: 'Database write failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true, call_log_id: dbData!.id }, { status: 201 })
}
