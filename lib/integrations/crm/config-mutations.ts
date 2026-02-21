/**
 * Tenant-scoped mutation helpers for client_integrations.
 *
 * SERVER-SIDE ONLY — uses the service-role Supabase client.
 * Called from API route handlers, not directly from client components.
 *
 * SECURITY:
 * - Raw secrets are stored in `config` jsonb (server-only column).
 * - `secrets_masked` stores display-safe previews for the UI.
 * - All writes enforce client_id scoping to prevent cross-tenant mutations.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { ClientIntegrationDb } from '@/types/database'
import type { ClientIntegration, IntegrationProvider, ClientIntegrationStatus } from '@/lib/types/domain'

// ── Input shapes ──────────────────────────────────────────────────────────────

export interface CreateIntegrationInput {
  provider: IntegrationProvider
  name: string
  config: Record<string, unknown>
  eventToggles?: Record<string, boolean>
  eventMapping?: Record<string, string>
}

export interface UpdateIntegrationInput {
  name?: string
  config?: Record<string, unknown>
  isEnabled?: boolean
  status?: ClientIntegrationStatus
  eventToggles?: Record<string, boolean>
  eventMapping?: Record<string, string>
  lastTestAt?: string
  lastSuccessAt?: string
  lastErrorAt?: string
  lastErrorMessage?: string | null
}

// ── Secret masking ────────────────────────────────────────────────────────────

/** Keys that should be masked when stored in secrets_masked. */
const SECRET_KEYS = ['secret', 'webhookSecret', 'apiKey', 'accessToken', 'privateAppToken']

/**
 * Build a masked preview of config secrets.
 * Keeps non-secret keys visible, masks secret values to last 4 chars.
 */
export function buildSecretsMasked(config: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(config)) {
    if (SECRET_KEYS.includes(key) && typeof value === 'string' && value.length > 4) {
      masked[key] = '***' + value.slice(-4)
    } else if (SECRET_KEYS.includes(key) && typeof value === 'string') {
      masked[key] = '***'
    } else {
      masked[key] = value
    }
  }
  return masked
}

// ── Row mapper (strips raw config) ──────────────────────────────────────────

function mapRow(row: ClientIntegrationDb): ClientIntegration {
  return {
    id:               row.id,
    tenantId:         row.client_id,
    provider:         row.provider as IntegrationProvider,
    name:             row.name,
    status:           row.status as ClientIntegrationStatus,
    isEnabled:        row.is_enabled,
    secretsMasked:    row.secrets_masked,
    eventToggles:     row.event_toggles ?? {},
    eventMapping:     row.event_mapping ?? {},
    lastTestAt:       row.last_test_at,
    lastSuccessAt:    row.last_success_at,
    lastErrorAt:      row.last_error_at,
    lastErrorMessage: row.last_error_message,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  }
}

// ── Default event toggles per provider ──────────────────────────────────────

const DEFAULT_EVENT_TOGGLES: Record<string, Record<string, boolean>> = {
  custom_webhook: {
    'call.completed': true,
    'lead.created': true,
    'booking.created': true,
    'summary.created': true,
    'followup.required': true,
    'lead.status_updated': true,
  },
  hubspot: {
    'call.completed': true,
    'lead.created': true,
    'booking.created': true,
    'summary.created': true,
    'followup.required': false,
    'lead.status_updated': true,
  },
  ghl: {
    'call.completed': true,
    'lead.created': true,
    'booking.created': true,
    'summary.created': false,
    'followup.required': false,
    'lead.status_updated': true,
  },
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Create a new integration connection for a tenant.
 * Throws on DB error.
 */
export async function createClientIntegration(
  tenantId: string,
  input: CreateIntegrationInput,
): Promise<ClientIntegration> {
  const supabase = createSupabaseServerClient()

  const eventToggles = input.eventToggles ?? DEFAULT_EVENT_TOGGLES[input.provider] ?? {}
  const eventMapping = input.eventMapping ?? {}

  const { data, error } = await supabase
    .from('client_integrations')
    .insert({
      client_id:      tenantId,
      provider:       input.provider,
      name:           input.name.trim(),
      status:         'disconnected',
      is_enabled:     true,
      config:         input.config,
      secrets_masked: buildSecretsMasked(input.config),
      event_toggles:  eventToggles,
      event_mapping:  eventMapping,
    })
    .select('*')
    .single()

  if (error) throw new Error(`[crm/config-mutations] create error: ${error.message}`)
  return mapRow(data as ClientIntegrationDb)
}

/**
 * Update fields on an existing integration.
 * If config is provided, secrets_masked is rebuilt automatically.
 * Throws on DB error or if the row doesn't belong to this tenant.
 */
export async function updateClientIntegration(
  tenantId: string,
  id: string,
  input: UpdateIntegrationInput,
): Promise<ClientIntegration> {
  const supabase = createSupabaseServerClient()

  const patch: Record<string, unknown> = {}

  if (input.name !== undefined)           patch.name              = input.name.trim()
  if (input.isEnabled !== undefined)      patch.is_enabled        = input.isEnabled
  if (input.status !== undefined)         patch.status            = input.status
  if (input.eventToggles !== undefined)   patch.event_toggles     = input.eventToggles
  if (input.eventMapping !== undefined)   patch.event_mapping     = input.eventMapping
  if (input.lastTestAt !== undefined)     patch.last_test_at      = input.lastTestAt
  if (input.lastSuccessAt !== undefined)  patch.last_success_at   = input.lastSuccessAt
  if (input.lastErrorAt !== undefined)    patch.last_error_at     = input.lastErrorAt
  if (input.lastErrorMessage !== undefined) patch.last_error_message = input.lastErrorMessage

  // If config changes, also rebuild the masked view
  if (input.config !== undefined) {
    patch.config = input.config
    patch.secrets_masked = buildSecretsMasked(input.config)
  }

  const { data, error } = await supabase
    .from('client_integrations')
    .update(patch)
    .eq('client_id', tenantId)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw new Error(`[crm/config-mutations] update error: ${error.message}`)
  return mapRow(data as ClientIntegrationDb)
}

/**
 * Delete an integration connection.
 * Hard delete — audit trail lives in crm_delivery_logs.
 */
export async function deleteClientIntegration(
  tenantId: string,
  id: string,
): Promise<void> {
  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('client_integrations')
    .delete()
    .eq('client_id', tenantId)
    .eq('id', id)

  if (error) throw new Error(`[crm/config-mutations] delete error: ${error.message}`)
}

/**
 * Record a test result on an integration row.
 * Updates last_test_at + status + success/error timestamps.
 */
export async function recordTestResult(
  tenantId: string,
  id: string,
  success: boolean,
  errorMessage?: string,
): Promise<ClientIntegration> {
  const now = new Date().toISOString()
  const input: UpdateIntegrationInput = {
    lastTestAt: now,
    status: success ? 'connected' : 'error',
  }
  if (success) {
    input.lastSuccessAt = now
    input.lastErrorMessage = null
  } else {
    input.lastErrorAt = now
    input.lastErrorMessage = errorMessage ?? 'Test delivery failed'
  }
  return updateClientIntegration(tenantId, id, input)
}
