/**
 * Tenant-scoped read helpers for client_integrations.
 *
 * All queries filter by client_id — never expose cross-tenant data.
 * Uses the service-role Supabase client (server-side only).
 *
 * SECURITY: raw `config` (contains secrets) is NEVER returned.
 * Only `secrets_masked` is mapped to the domain type.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { ClientIntegrationDb } from '@/types/database'
import type { ClientIntegration, IntegrationProvider, ClientIntegrationStatus } from '@/lib/types/domain'

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

// ── Public query functions ────────────────────────────────────────────────────

/**
 * List all integrations for a tenant. Returns domain objects (secrets stripped).
 * Returns empty array on DB error (graceful fallback if table doesn't exist yet).
 */
export async function listClientIntegrations(tenantId: string): Promise<ClientIntegration[]> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('client_id', tenantId)
    .order('created_at', { ascending: true })

  if (error) {
    // Graceful fallback — table may not exist yet if migration hasn't run
    console.error('[crm/config-query] listClientIntegrations error:', error.message)
    return []
  }

  return ((data ?? []) as ClientIntegrationDb[]).map(mapRow)
}

/**
 * Fetch a single integration by ID, tenant-scoped. Secrets stripped.
 */
export async function getClientIntegration(
  tenantId: string,
  id: string,
): Promise<ClientIntegration | null> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('client_id', tenantId)
    .eq('id', id)
    .single()

  if (error || !data) return null
  return mapRow(data as ClientIntegrationDb)
}

/**
 * Fetch the raw config for an integration (server-only, contains secrets).
 * Used by the delivery service to resolve adapter config at dispatch time.
 * NEVER return this to the client.
 */
export async function getIntegrationRawConfig(
  tenantId: string,
  id: string,
): Promise<{ config: Record<string, unknown>; provider: string; eventToggles: Record<string, boolean>; isEnabled: boolean; status: string } | null> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('client_integrations')
    .select('config, provider, event_toggles, is_enabled, status')
    .eq('client_id', tenantId)
    .eq('id', id)
    .single()

  if (error || !data) return null

  const row = data as Pick<ClientIntegrationDb, 'config' | 'provider' | 'event_toggles' | 'is_enabled' | 'status'>
  return {
    config: row.config,
    provider: row.provider,
    eventToggles: row.event_toggles ?? {},
    isEnabled: row.is_enabled,
    status: row.status,
  }
}

/**
 * List enabled integrations for a specific provider (server-only, includes raw config).
 * Used by the delivery pipeline to find the right config for a provider.
 */
export async function listEnabledIntegrationConfigs(
  tenantId: string,
  provider: string,
): Promise<Array<{ id: string; config: Record<string, unknown>; eventToggles: Record<string, boolean> }>> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('client_integrations')
    .select('id, config, event_toggles')
    .eq('client_id', tenantId)
    .eq('provider', provider)
    .eq('is_enabled', true)
    .in('status', ['connected', 'testing'])

  if (error || !data) return []

  return (data as Pick<ClientIntegrationDb, 'id' | 'config' | 'event_toggles'>[]).map((row) => ({
    id: row.id,
    config: row.config,
    eventToggles: row.event_toggles ?? {},
  }))
}
