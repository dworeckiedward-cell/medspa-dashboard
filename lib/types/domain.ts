/**
 * Domain types for the CRM Lite / Ops layer.
 *
 * These are DECOUPLED from the raw Supabase DB schema — they represent
 * business entities that may be assembled from one or more DB tables,
 * computed fields, or external sources.
 *
 * DB-backed fields use camelCase here; DB raw types use snake_case (types/database.ts).
 */

// ─── Contact / Lead ───────────────────────────────────────────────────────────

export type ContactStatus =
  | 'new'
  | 'contacted'
  | 'interested'
  | 'booked'
  | 'lost'
  | 'reactivation'

export type ContactOwnerType = 'ai' | 'human'

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  booked: 'Booked',
  lost: 'Lost',
  reactivation: 'Reactivation',
}

export interface Contact {
  id: string
  tenantId: string
  fullName: string
  phone: string
  email: string | null
  tags: string[]
  source: string            // 'website' | 'google' | 'referral' | 'instagram' | 'phone' | 'walk-in'
  status: ContactStatus
  ownerType: ContactOwnerType
  priorityScore: number     // 0–100
  lastCallAt: string | null // ISO 8601
  nextActionAt: string | null
  createdAt: string
  updatedAt: string

  // Joined / computed — populated when fetching detail
  latestCallSummary?: CallSummary | null
  openFollowUpTasks?: FollowUpTask[]
  recentCalls?: CallLogEntry[]
  appointments?: Appointment[]
}

// ─── Call Log (domain view — flatter than raw DB) ─────────────────────────────

export interface CallLogEntry {
  id: string
  tenantId: string
  contactId: string | null
  direction: 'inbound' | 'outbound'
  callType: string
  durationSec: number
  outcome: string | null    // 'booked' | 'follow_up' | 'no_answer' | 'voicemail' | 'spam'
  startedAt: string
  endedAt: string | null
  provider: 'retell' | 'vapi' | 'bland' | 'custom'
  providerCallId: string | null
  recordingUrl: string | null
  transcriptText: string | null
  summaryStatus: 'pending' | 'complete' | 'failed' | 'not_applicable'
  transferToHuman: boolean
  agentVersion: string | null
  summary?: CallSummary | null
}

// ─── AI Call Summary (structured) ────────────────────────────────────────────

export interface StructuredSummary {
  intent: string | null
  sentiment: 'positive' | 'neutral' | 'negative' | null
  urgency: 'high' | 'medium' | 'low' | null
  objections: string[]
  outcome: string | null
  nextBestAction: string | null
  callbackScript: string | null
  keyFacts: string[]
  unansweredQuestions: string[]
}

export interface CallSummary {
  id: string
  callLogId: string
  tenantId: string
  provider: string           // e.g. 'retell' | 'openai' | 'claude'
  model: string | null
  plainSummary: string
  structuredSummary: StructuredSummary | null
  sentiment: 'positive' | 'neutral' | 'negative' | null
  urgency: 'high' | 'medium' | 'low' | null
  createdAt: string
}

// ─── Follow-up Tasks ──────────────────────────────────────────────────────────

export type FollowUpTaskType =
  | 'callback'
  | 'reminder'
  | 'reactivation'
  | 'human_review'

export type FollowUpTaskStatus = 'open' | 'in_progress' | 'done' | 'snoozed'

export type FollowUpPriority = 'high' | 'medium' | 'low'

export const FOLLOWUP_TYPE_LABELS: Record<FollowUpTaskType, string> = {
  callback: 'Callback',
  reminder: 'Reminder',
  reactivation: 'Reactivation',
  human_review: 'Human Review',
}

export interface FollowUpTask {
  id: string
  tenantId: string
  contactId: string
  taskType: FollowUpTaskType
  status: FollowUpTaskStatus
  reason: string
  dueAt: string            // ISO 8601
  priority: FollowUpPriority
  suggestedAction: string | null
  suggestedScript: string | null
  assignedTo: string | null
  createdAt: string
  updatedAt: string

  // Joined
  contact?: Contact
}

// ─── Appointments ─────────────────────────────────────────────────────────────

export type AppointmentStatus =
  | 'booked'
  | 'confirmed'
  | 'cancelled'
  | 'no_show'
  | 'completed'

export interface Appointment {
  id: string
  tenantId: string
  contactId: string
  externalId: string | null
  status: AppointmentStatus
  startAt: string
  endAt: string | null
  serviceName: string
  providerName: string | null
  valueEstimate: number
}

// ─── Integrations ─────────────────────────────────────────────────────────────

export type IntegrationProvider =
  | 'custom_webhook'
  | 'hubspot'
  | 'ghl'
  | 'pipedrive'

export type IntegrationStatus = 'active' | 'inactive' | 'error' | 'pending_setup'

export interface Integration {
  id: string
  tenantId: string
  provider: IntegrationProvider
  status: IntegrationStatus
  configJson: Record<string, unknown>
  lastSyncedAt: string | null
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export interface IntegrationSyncLog {
  id: string
  tenantId: string
  integrationId: string
  direction: 'inbound' | 'outbound'
  eventType: string          // 'lead.created' | 'call.completed' | etc.
  status: 'success' | 'failed' | 'pending'
  payloadJson: Record<string, unknown> | null
  responseJson: Record<string, unknown> | null
  error: string | null
  createdAt: string
}

// ─── Client Integrations (DB-backed, migration 008) ─────────────────────────

export type ClientIntegrationStatus = 'connected' | 'disconnected' | 'error' | 'testing'

/** Domain view of a client_integrations row — secrets stripped, safe for UI. */
export interface ClientIntegration {
  id: string
  tenantId: string
  provider: IntegrationProvider
  name: string
  status: ClientIntegrationStatus
  isEnabled: boolean
  /** Masked secrets only — never raw config. */
  secretsMasked: Record<string, unknown> | null
  eventToggles: Record<string, boolean>
  eventMapping: Record<string, string>
  lastTestAt: string | null
  lastSuccessAt: string | null
  lastErrorAt: string | null
  lastErrorMessage: string | null
  createdAt: string
  updatedAt: string
}

/** Health badge derived from integration status + recent delivery history. */
export type IntegrationHealthLevel = 'healthy' | 'attention' | 'failing' | 'not_configured'

export interface IntegrationHealthSummary {
  totalIntegrations: number
  activeIntegrations: number
  failingIntegrations: number
  deliveries24h: number
  failures24h: number
  failureRate24h: number | null
}

// ─── CRM delivery log ─────────────────────────────────────────────────────────

/**
 * Error codes for CRM event delivery failures.
 * Stored in crm_delivery_logs.error_code.
 */
export type CrmDeliveryErrorCode =
  | 'NOT_CONFIGURED'      // No adapter / config missing for this provider
  | 'NOT_IMPLEMENTED'     // Adapter stub not yet implemented (e.g. HubSpot placeholder)
  | 'TIMEOUT'             // AbortController / fetch timeout
  | 'NETWORK_ERROR'       // ECONNREFUSED, DNS failure, etc.
  | 'HTTP_ERROR'          // Non-2xx HTTP response from CRM
  | 'SKIPPED_DISABLED'    // Event toggle is off for this event type
  | 'SKIPPED_NOT_CONNECTED' // Integration is disconnected or disabled
  | 'VALIDATION_ERROR'    // Payload validation failed
  | 'UNKNOWN_ERROR'       // Anything else

export interface CrmDeliveryLog {
  id: string
  tenantId: string
  integrationProvider: string
  eventType: string
  eventId: string | null
  payload: Record<string, unknown>
  requestUrl: string | null
  requestHeadersMasked: Record<string, unknown> | null
  httpMethod: string
  responseStatus: number | null
  responseBodyPreview: string | null
  latencyMs: number | null
  success: boolean
  errorCode: CrmDeliveryErrorCode | null
  errorMessage: string | null
  createdAt: string
}

// ─── Services & Pricing ───────────────────────────────────────────────────────

/** Friendly camelCase view of a ServicesCatalog row. */
export interface ClientService {
  id: string
  tenantId: string
  name: string
  category: string | null
  /** List price in minor units (e.g. cents). null = quote-based. */
  priceCents: number | null
  /** ISO 4217 currency code, lowercase. */
  currency: string
  /** Typical session length in minutes. */
  durationMin: number | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export type BillingStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'unpaid'

/**
 * Portable billing summary — maps to a Stripe subscription or a local billing table.
 * All monetary amounts in currency minor units (cents).
 */
export interface BillingSummary {
  tenantId: string
  planName: string
  status: BillingStatus
  /** Recurring price in minor units (e.g. 29900 = $299.00). */
  amountCents: number
  /** ISO 4217 currency code, lowercase. */
  currency: string
  interval: 'month' | 'year'
  /** ISO 8601 timestamp of the next charge / renewal. */
  nextBillingAt: string | null
  trialEndsAt?: string | null
  cancelAt?: string | null
  canceledAt?: string | null
  paymentMethodBrand?: string | null   // e.g. 'visa', 'mastercard'
  paymentMethodLast4?: string | null
  customerPortalUrl?: string | null
  invoicesUrl?: string | null
  updatedAt?: string | null
}

// ─── Retell / provider-agnostic normalised call summary payload ───────────────

export interface NormalisedCallSummary {
  providerCallId: string
  transcriptText: string | null
  plainSummary: string | null
  structuredSummary: Partial<StructuredSummary>
  recordingUrl: string | null
  provider: string
  model: string | null
  rawPayload: Record<string, unknown>
}
