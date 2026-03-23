// ─── Database types — mirrors Supabase schema ─────────────────────────────────
// TODO: Replace with `supabase gen types typescript --project-id <id>` in production

// ── Enum-like call log discriminators ────────────────────────────────────────

export type CallDirection = 'inbound' | 'outbound'

export type OutboundType = 'speed_to_lead' | 'reminder' | 'reactivation' | 'campaign' | 'follow_up'

export type CallDisposition =
  | 'booked'
  | 'follow_up'
  | 'not_interested'
  | 'no_answer'
  | 'voicemail'
  | 'spam'
  | 'other'

export type CallSentiment = 'positive' | 'neutral' | 'negative' | 'follow_up'

export type CallIntent =
  | 'book_appointment'
  | 'inquiry'
  | 'cancel'
  | 'reschedule'
  | 'complaint'
  | 'other'

export const CALL_DISPOSITION_LABELS: Record<CallDisposition, string> = {
  booked: 'Booked',
  follow_up: 'Follow-up',
  not_interested: 'Not interested',
  no_answer: 'No answer',
  voicemail: 'Voicemail',
  spam: 'Spam',
  other: 'Other',
}

export const CALL_INTENT_LABELS: Record<CallIntent, string> = {
  book_appointment: 'Book appointment',
  inquiry: 'Inquiry',
  cancel: 'Cancel',
  reschedule: 'Reschedule',
  complaint: 'Complaint',
  other: 'Other',
}

export interface Client {
  id: string
  name: string
  slug: string                    // internal tenant key — used in subdomain + headers
  subdomain: string | null
  custom_domain: string | null
  logo_url: string | null
  brand_color: string | null      // hex e.g. #0EA5E9
  accent_color: string | null
  theme_mode: string              // 'dark' | 'light'
  retell_agent_id: string | null
  outbound_agent_id: string | null
  retell_phone_number: string | null
  n8n_webhook_url: string | null
  n8n_api_key_ref: string | null  // references secret manager key, NOT the secret itself
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  retainer_expiry: string | null  // ISO 8601 timestamp
  timezone: string                // e.g. 'America/New_York'
  currency: string                // e.g. 'USD'
  is_active: boolean
  created_at: string
  updated_at: string

  // ── AI System Control (migration 018) ─────────────────────────────────────
  ai_enabled: boolean
  ai_operating_mode: string       // 'live' | 'paused' | 'outbound_only' | 'inbound_only' | 'maintenance'
  ai_fallback_mode: string        // 'human_handoff' | 'voicemail_only' | 'capture_only' | 'disabled'
  ai_pause_reason: string | null  // 'holiday' | 'staff_preference' | 'testing' | 'billing_issue' | 'other'
  ai_pause_note: string | null
  ai_auto_resume_at: string | null
  ai_control_updated_at: string | null
  ai_control_updated_by: string | null

  // ── Dashboard variant (stored in clients table, extension point) ───────────
  /** @deprecated Use dashboard_mode instead. Kept for backward compatibility. */
  client_type?: 'clinic' | 'outbound' | null

  // ── Multi-vertical mode (migration 026) ──────────────────────────────────
  /** Controls which KPIs, lead pipeline, and UI sections the dashboard shows.
   *  'inbound_clinic' (default) | 'outbound_db' | 'fb_leads'
   *  Falls back to client_type mapping when null/undefined. */
  dashboard_mode?: 'inbound_clinic' | 'outbound_db' | 'fb_leads' | null
  /** Industry vertical for terminology and provider suggestions.
   *  Extensible string — e.g. 'medspa', 'dental', 'real_estate', 'general'. */
  business_vertical?: string | null

  // ── OPS-managed fields ──────────────────────────────────────────────────
  /** Clinic lifecycle status: onboarding → live → watch → canceled */
  client_status?: 'onboarding' | 'live' | 'watch' | 'canceled' | null
  /** Clinic website URL */
  website_url?: string | null

  // ── Wallet / usage-based billing (migration 028) ────────────────────────
  /** Pre-paid seconds remaining. Decremented after each call. */
  available_seconds: number

  // ── Stripe Connect (migration 036) ──────────────────────────────────────
  stripe_connect_account_id?: string | null
  stripe_connect_onboarded?: boolean
  platform_fee_percent?: number

  // ── AI Budget (migration 040) ────────────────────────────────────────────
  /** Monthly AI spend budget in cents. Default $100 = 10000. */
  monthly_ai_budget_cents?: number
  /** Day of month the budget resets (1 = 1st). */
  ai_budget_reset_day?: number

  // ── Tenant feature flags (migration 050) ─────────────────────────────────
  /** JSONB feature flags. Keys: appointments_visible, booked_revenue_visible, jane_api.
   *  Missing key or true → feature enabled. Explicit false → feature disabled. */
  features?: Record<string, unknown> | null
}

export type CallType =
  | 'inbound_inquiry'
  | 'booking'
  | 'reschedule'
  | 'cancellation'
  | 'support'
  | 'spam'
  | 'other'

export const CALL_TYPE_LABELS: Record<CallType, string> = {
  inbound_inquiry: 'Inquiry',
  booking: 'Booking',
  reschedule: 'Reschedule',
  cancellation: 'Cancellation',
  support: 'Support',
  spam: 'Spam',
  other: 'Other',
}

export interface CallLog {
  id: string
  client_id: string
  external_call_id: string | null
  caller_name: string | null
  caller_phone: string | null
  semantic_title: string | null
  call_type: CallType | null
  summary: string | null
  transcript: string | null
  recording_url: string | null
  duration_seconds: number
  potential_revenue: number
  booked_value: number
  inquiries_value: number
  is_booked: boolean
  lead_confidence: number | null  // 0.00–1.00
  is_lead: boolean
  human_followup_needed: boolean
  human_followup_reason: string | null
  follow_up_count: number
  last_follow_up_at: string | null
  tags: string[]
  raw_payload: Record<string, unknown> | null
  created_at: string
  updated_at: string

  // ── Fields added in migration 004 (nullable for backward compat) ───────────
  direction: CallDirection | null              // 'inbound' | 'outbound'
  outbound_type: OutboundType | null          // outbound sub-classification
  response_time_seconds: number | null        // seconds from lead → first contact
  contacted_at: string | null                 // ISO timestamp of first contact
  ai_summary: string | null                   // structured AI-generated summary
  ai_summary_json: Record<string, unknown> | null  // full structured AI output
  disposition: CallDisposition | null         // call outcome
  sentiment: CallSentiment | null             // caller sentiment
  intent: CallIntent | null                   // primary caller intent
  booked_at: string | null                    // ISO timestamp of booking
  appointment_datetime: string | null         // scheduled appointment time
  lead_source: string | null                  // e.g. 'website', 'google'
  agent_provider: string | null               // e.g. 'retell', 'vapi'
  agent_name: string | null                   // agent config name

  // ── Fields added in migration 006 (AI summary pipeline) ───────────────────
  /** 'pending' | 'complete' | 'failed' | 'not_applicable' */
  summary_status: string | null
  summary_updated_at: string | null           // ISO 8601 timestamp

  // ── Fields added in migration 023 (Retell enhancements) ─────────────────
  from_number: string | null                  // E.164 from number
  to_number: string | null                    // E.164 to number
  started_at: string | null                   // ISO 8601 call start
  ended_at: string | null                     // ISO 8601 call end
  cost_usd: number | null                     // Retell call cost in USD
  retell_agent_id: string | null              // Retell agent that handled the call
  call_status: string | null                  // 'ended' | 'ongoing' | 'error' | 'registered'
  call_summary_json: Record<string, unknown> | null  // Retell custom_analysis_data
  call_summary: string | null                 // Plain text from call_analysis.call_summary (migration 038)
  disconnect_reason: string | null            // Retell disconnect reason

  // ── Fields added in migration 027 (FB Leads enrichment) ─────────────────
  fb_ad_id: string | null                     // Facebook Ad ID for cost attribution
  fb_campaign_id: string | null               // Facebook Campaign ID
  fb_lead_id: string | null                   // Facebook Lead ID
  lead_cost_cents: number | null              // Cost per lead in cents (from FB Ads or manual)
  ad_set_name: string | null                  // Facebook Ad Set name

  // ── AI cost tracking (migration 040) ─────────────────────────────────────
  /** Retell call cost in integer cents (e.g. 23 = $0.23). */
  cost_cents: number | null

  // ── Lead management fields ────────────────────────────────────────────────
  /** Lead funnel stage (migration 037): new | contacted | booking_link_sent | clicked_link | booked | lost */
  lead_status: string | null
  /** Free-text notes added by clinic staff via the dashboard. */
  notes: string | null
  /** ISO 8601 timestamp — set when patient clicks the booking link SMS. */
  booking_link_clicked_at: string | null
  /** Campaign type for grouping (e.g. 'acupuncture', 'skin', 'botox'). */
  campaign_type: string | null
}

export interface ServicesCatalog {
  id: string
  client_id: string
  service_name: string
  aliases: string[]
  price_min: number | null
  price_max: number | null
  avg_price: number | null
  is_active: boolean
  created_at: string
  updated_at: string

  // ── Fields added in migration 007 (Services & Pricing Manager) ─────────────
  /** Free-form category label (e.g. "Injectables", "Laser", "Skin Care") */
  category: string | null
  /** Single list price in currency minor units (cents). null = quote-based. */
  price_cents: number | null
  /** ISO 4217 currency code, lowercase (e.g. 'usd', 'pln'). */
  currency: string
  /** Typical session length in minutes. */
  duration_min: number | null
  /** Display sort position — lower = higher in list. */
  sort_order: number
}

export interface KbVersion {
  id: string
  client_id: string
  version_label: string
  content: string
  source: string | null  // 'dashboard' | 'n8n' | 'api'
  is_active: boolean
  created_at: string
}

// ─── Dashboard computed types ─────────────────────────────────────────────────

export interface DashboardMetrics {
  appointmentsBooked: number
  potentialRevenue: number       // sum of paid bookings (real money collected)
  pipelineRevenue: number        // sum of call_logs.potential_revenue from is_lead=true calls
  hoursSaved: number             // sum(duration_seconds) / 3600
  leadConversionRate: number     // (booked / total leads) * 100
  /** Average response_time_seconds across leads in range; null if no data yet */
  avgSpeedSec: number | null
  chartSeries: ChartDataPoint[]

  /** Total call_logs rows in the period (including junk) */
  totalCalls: number
  /** Calls passing the meaningful-call filter */
  meaningfulCalls: number
  /** Lead rows (is_lead=true) among meaningful calls */
  totalLeads: number
  /** Meaningful inbound calls (direction='inbound') */
  inboundCalls: number
  /** Meaningful outbound calls (direction='outbound') */
  outboundSetterCalls: number
  /** Breakdown of non-meaningful calls */
  callBreakdown: {
    answered: number
    voicemail: number
    noAnswer: number
    junk: number        // spam, test, machine_detected, etc.
  }
}

export interface ChartDataPoint {
  date: string           // 'MMM dd' formatted for display
  inquiries: number      // sum inquiries_value
  booked: number         // sum booked_value
  potential: number      // sum potential_revenue
}

// ─── CRM delivery log (migration 005) ────────────────────────────────────────

export interface CrmDeliveryLog {
  id: string
  client_id: string
  integration_provider: string
  event_type: string
  event_id: string | null
  payload: Record<string, unknown>
  request_url: string | null
  request_headers_masked: Record<string, unknown> | null
  http_method: string
  response_status: number | null
  response_body_preview: string | null
  latency_ms: number | null
  success: boolean
  error_code: string | null
  error_message: string | null
  created_at: string
}

// ─── Client integrations (migration 008) ─────────────────────────────────────

export interface ClientIntegrationDb {
  id: string
  client_id: string
  provider: string                              // 'custom_webhook' | 'hubspot' | 'ghl'
  name: string                                  // display label
  status: string                                // 'connected' | 'disconnected' | 'error' | 'testing'
  is_enabled: boolean
  config: Record<string, unknown>               // full config with secrets (server-only)
  secrets_masked: Record<string, unknown> | null
  event_toggles: Record<string, boolean>        // e.g. {"call.completed":true}
  event_mapping: Record<string, string>         // local event → remote event name
  last_test_at: string | null
  last_success_at: string | null
  last_error_at: string | null
  last_error_message: string | null
  created_at: string
  updated_at: string
}

// ─── Tenant context (passed via request headers set by middleware) ─────────────

export interface ResolvedTenant {
  slug: string
  source: 'subdomain' | 'custom_domain' | 'query_param' | 'header' | 'cookie'
}
