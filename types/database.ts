// ─── Database types — mirrors Supabase schema ─────────────────────────────────
// TODO: Replace with `supabase gen types typescript --project-id <id>` in production

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
  tags: string[]
  raw_payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
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
  potentialRevenue: number       // sum of potential_revenue (last 30d)
  hoursSaved: number             // sum(duration_seconds) / 3600
  leadConversionRate: number     // (booked / total leads) * 100
  chartSeries: ChartDataPoint[]
}

export interface ChartDataPoint {
  date: string           // 'MMM dd' formatted for display
  inquiries: number      // sum inquiries_value
  booked: number         // sum booked_value
  potential: number      // sum potential_revenue
}

// ─── Tenant context (passed via request headers set by middleware) ─────────────

export interface ResolvedTenant {
  slug: string
  source: 'subdomain' | 'custom_domain' | 'query_param' | 'header'
}
