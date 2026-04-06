/**
 * POST /api/ingest — n8n event ingest endpoint.
 *
 * Implements the contract defined in n8n_event_contract.md.
 * Receives events from n8n workflows (GoHighLevel, Retell, Stripe, etc.)
 * and persists them into the appropriate tables.
 *
 * Auth: x-api-key header checked against N8N_API_KEY env var.
 *
 * Events:
 *   lead_created      → call_logs (is_lead=true)
 *   sms_sent          → call_logs (direction=outbound, call_type=sms)
 *   call_started      → call_logs (upsert by external_call_id)
 *   call_ended         → call_logs (upsert by external_call_id, updates duration/disposition)
 *   appointment_booked → call_logs (is_booked=true, booked_at, appointment_datetime)
 *   payment_confirmed → client_payment_logs + client_financial_events
 *   campaign_completed → client_financial_events
 *
 * Responses:
 *   200  { ok: true }
 *   400  { error: "..." }
 *   401  { error: "Unauthorized" }
 *   404  { error: "Client not found" }
 *   500  { error: "..." }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { safeCompare } from '@/lib/auth/timing-safe'
import { rateLimit, webhookLimiter } from '@/lib/api/rate-limit'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = [
  'lead_created',
  'sms_sent',
  'call_started',
  'call_initiated',
  'call_ended',
  'appointment_booked',
  'payment_confirmed',
  'campaign_completed',
] as const

type EventType = (typeof ALLOWED_TYPES)[number]

interface IngestBody {
  clientSlug: string
  type: EventType
  ts: string
  contactId?: string
  phone?: string
  meta?: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  // ── Rate limit ────────────────────────────────────────────────────────────
  const limited = rateLimit(req, webhookLimiter)
  if (limited) return limited

  // ── Auth ──────────────────────────────────────────────────────────────────
  const apiKey = req.headers.get('x-api-key')
  const expected = process.env.N8N_API_KEY

  if (!expected) {
    console.error('[ingest] N8N_API_KEY env var is not set')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (!apiKey || !safeCompare(apiKey, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: IngestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.clientSlug || !body.type || !body.ts) {
    return NextResponse.json(
      { error: 'Missing required fields: clientSlug, type, ts' },
      { status: 400 },
    )
  }

  if (!ALLOWED_TYPES.includes(body.type as EventType)) {
    return NextResponse.json(
      { error: `Unknown event type: ${body.type}. Allowed: ${ALLOWED_TYPES.join(', ')}` },
      { status: 400 },
    )
  }

  // ── Resolve tenant ────────────────────────────────────────────────────────
  const supabase = createSupabaseServerClient()

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', body.clientSlug)
    .eq('is_active', true)
    .maybeSingle()

  if (tenantError) {
    console.error('[ingest] Tenant lookup error:', tenantError.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!tenant) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const meta = body.meta ?? {}
  const now = body.ts

  // ── Dispatch by event type ────────────────────────────────────────────────
  try {
    switch (body.type) {
      case 'lead_created': {
        // No-op: the Retell webhook creates the call_log with the real call_id.
        // Pre-inserting here caused duplicate records (fake lead-{ts} + real call_id).
        break
      }

      case 'sms_sent': {
        const messageId =
          typeof meta.message_id === 'string' ? meta.message_id : null
        const { error } = await supabase.from('call_logs').insert({
          client_id: tenant.id,
          tenant_id: tenant.id,
          external_call_id: messageId
            ? `sms-${messageId}`
            : `sms-${Date.now()}`,
          caller_phone: body.phone ?? null,
          call_type: 'sms',
          direction: 'outbound',
          duration_seconds: 0,
          agent_provider: 'n8n',
          raw_payload: body,
          created_at: now,
          updated_at: now,
        })
        if (error) throw error
        break
      }

      case 'call_initiated': // alias for call_started (from n8n automation)
      case 'call_started': {
        const callId =
          typeof meta.call_id === 'string' ? meta.call_id : `call-${Date.now()}`
        const { error } = await supabase.from('call_logs').upsert(
          {
            client_id: tenant.id,
            tenant_id: tenant.id,
            external_call_id: callId,
            caller_phone: body.phone ?? null,
            direction: 'outbound',
            call_type: 'outbound_call',
            duration_seconds: 0,
            agent_provider: 'retell',
            agent_name: typeof meta.agent_id === 'string' ? meta.agent_id : null,
            raw_payload: body,
            created_at: now,
            updated_at: now,
          },
          { onConflict: 'client_id,external_call_id' },
        )
        if (error) throw error
        break
      }

      case 'call_ended': {
        const callId =
          typeof meta.call_id === 'string' ? meta.call_id : `call-${Date.now()}`
        const disposition = meta.in_voicemail === true ? 'voicemail' : 'other'
        const { error } = await supabase.from('call_logs').upsert(
          {
            client_id: tenant.id,
            tenant_id: tenant.id,
            external_call_id: callId,
            caller_phone: body.phone ?? null,
            direction: 'outbound',
            call_type: 'outbound_call',
            duration_seconds:
              typeof meta.duration_sec === 'number' ? meta.duration_sec : 0,
            disposition,
            summary:
              typeof meta.call_summary === 'string' ? meta.call_summary : null,
            agent_provider: 'retell',
            raw_payload: body,
            created_at: now,
            updated_at: now,
          },
          { onConflict: 'client_id,external_call_id' },
        )
        if (error) throw error
        break
      }

      case 'appointment_booked': {
        const service   = typeof meta.service      === 'string' ? meta.service      : null
        const eventId   = typeof meta.event_id     === 'string' ? meta.event_id     : null
        const callId    = typeof meta.call_id      === 'string' ? meta.call_id      : null
        const apptDate  = typeof meta.date         === 'string' ? meta.date         : null
        const apptTime  = typeof meta.time         === 'string' ? meta.time         : null
        const patientName = typeof meta.patient_name === 'string' ? meta.patient_name : null

        // Parse "2:30 PM" → "14:30:00"
        let appointmentDatetime: string | null = null
        if (apptDate && apptTime) {
          try {
            const m = apptTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
            if (m) {
              let h = parseInt(m[1])
              const mins = m[2]
              const mer = m[3].toUpperCase()
              if (mer === 'PM' && h < 12) h += 12
              if (mer === 'AM' && h === 12) h = 0
              appointmentDatetime = `${apptDate}T${String(h).padStart(2, '0')}:${mins}:00`
            }
          } catch { /* ignore */ }
        }

        // Look up service price from services_catalog
        let bookedValue = 0
        if (service) {
          const { data: svc } = await supabase
            .from('services_catalog')
            .select('price_min, price_max')
            .eq('client_id', tenant.id)
            .ilike('service_name', service)
            .maybeSingle()
          if (svc) bookedValue = (svc as { price_min: number | null; price_max: number | null }).price_min
            ?? (svc as { price_min: number | null; price_max: number | null }).price_max
            ?? 0
        }

        const extId = eventId ? `gcal-${eventId}` : callId ? `appt-${callId}` : `appt-${Date.now()}`

        const { error } = await supabase.from('call_logs').upsert(
          {
            client_id: tenant.id,
            tenant_id: tenant.id,
            external_call_id: extId,
            caller_phone: body.phone ?? null,
            caller_name: patientName,
            is_booked: true,
            is_lead: true,
            booked_at: now,
            appointment_datetime: appointmentDatetime,
            booked_value: bookedValue,
            call_type: 'lead',
            direction: 'inbound',
            duration_seconds: 0,
            agent_provider: 'n8n',
            sentiment: 'positive',
            disposition: 'booked',
            semantic_title: service ? `Booked: ${service}` : 'Appointment Booked',
            notes: service && apptDate && apptTime
              ? `AI booked: ${service} on ${apptDate} at ${apptTime}`
              : null,
            campaign_type: service ?? null,
            raw_payload: body,
            created_at: now,
            updated_at: now,
          },
          { onConflict: 'client_id,external_call_id' },
        )
        if (error) throw error

        // Clear follow-up flag for this phone — appointment booked, no callback needed
        if (body.phone) {
          await supabase
            .from('call_logs')
            .update({ human_followup_needed: false, updated_at: now })
            .eq('client_id', tenant.id)
            .eq('caller_phone', body.phone)
            .eq('human_followup_needed', true)
        }

        break
      }

      case 'payment_confirmed': {
        const amountCents =
          typeof meta.amount_cents === 'number' ? meta.amount_cents : 0
        const { error: paymentError } = await supabase
          .from('client_payment_logs')
          .insert({
            client_id: tenant.id,
            payment_type: 'other',
            amount: amountCents / 100,
            currency: typeof meta.currency === 'string' ? meta.currency : 'usd',
            status: 'paid',
            paid_at: now,
            source: 'stripe',
            external_payment_id:
              typeof meta.stripe_session_id === 'string'
                ? meta.stripe_session_id
                : null,
          })
        if (paymentError) throw paymentError

        const { error: eventError } = await supabase
          .from('client_financial_events')
          .insert({
            client_id: tenant.id,
            event_type: 'payment_confirmed',
            payload: body,
            actor_label: 'n8n',
          })
        if (eventError) throw eventError
        break
      }

      case 'campaign_completed': {
        const { error } = await supabase
          .from('client_financial_events')
          .insert({
            client_id: tenant.id,
            event_type: 'campaign_completed',
            payload: meta,
            actor_label: 'n8n',
          })
        if (error) throw error
        break
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[ingest] ${body.type} failed for ${body.clientSlug}:`, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
