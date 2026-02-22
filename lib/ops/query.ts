/**
 * Ops Console — cross-tenant query helpers.
 *
 * These queries fetch data across ALL tenants for the Servify operator console.
 * They use the service-role client (bypasses RLS) and are server-only.
 *
 * SECURITY: Only call these from ops routes that are protected by resolveOperatorAccess().
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { subDays } from 'date-fns'
import type { Client, CallLog, CrmDeliveryLog, ClientIntegrationDb } from '@/types/database'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ClientCallStats {
  clientId: string
  totalCalls: number
  bookedCalls: number
  bookingRate: number
  totalRevenue: number
  lastCallAt: string | null
}

export interface ClientOverview {
  client: Client
  callStats: ClientCallStats
  integrationsCount: number
  integrationsHealthy: number
  hasOnboarding: boolean
  onboardingComplete: boolean
}

// ── Queries ──────────────────────────────────────────────────────────────────

/** Fetch active clients ordered by creation date (capped at 200) */
export async function listAllClients(): Promise<Client[]> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[ops] listAllClients error:', error.message)
    return []
  }
  return (data ?? []) as Client[]
}

/** Fetch call stats for a single client (last 30 days) */
export async function getClientCallStats(
  clientId: string,
  days = 30,
): Promise<ClientCallStats> {
  const supabase = createSupabaseServerClient()
  const since = subDays(new Date(), days).toISOString()

  const { data: calls, error } = await supabase
    .from('call_logs')
    .select('id, is_booked, potential_revenue, created_at')
    .eq('client_id', clientId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (error || !calls) {
    return {
      clientId,
      totalCalls: 0,
      bookedCalls: 0,
      bookingRate: 0,
      totalRevenue: 0,
      lastCallAt: null,
    }
  }

  const totalCalls = calls.length
  const bookedCalls = calls.filter((c) => c.is_booked).length
  const totalRevenue = calls.reduce((sum, c) => sum + (c.potential_revenue ?? 0), 0)

  return {
    clientId,
    totalCalls,
    bookedCalls,
    bookingRate: totalCalls > 0 ? Math.round((bookedCalls / totalCalls) * 100) : 0,
    totalRevenue,
    lastCallAt: calls.length > 0 ? calls[0].created_at : null,
  }
}

/** Fetch integrations for a single client */
export async function getClientIntegrations(
  clientId: string,
): Promise<{ total: number; healthy: number }> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('client_integrations')
    .select('id, status, is_enabled')
    .eq('client_id', clientId)

  if (error || !data) {
    return { total: 0, healthy: 0 }
  }

  const integrations = data as Pick<ClientIntegrationDb, 'id' | 'status' | 'is_enabled'>[]
  return {
    total: integrations.length,
    healthy: integrations.filter(
      (i) => i.is_enabled && (i.status === 'connected' || i.status === 'testing'),
    ).length,
  }
}

/** Check onboarding state for a single client */
export async function getClientOnboardingState(
  clientId: string,
): Promise<{ exists: boolean; complete: boolean }> {
  const supabase = createSupabaseServerClient()

  try {
    const { data, error } = await supabase
      .from('client_onboarding_state')
      .select('is_completed')
      .eq('client_id', clientId)
      .limit(1)
      .maybeSingle()

    if (error) return { exists: false, complete: false }
    if (!data) return { exists: false, complete: false }

    return {
      exists: true,
      complete: (data as { is_completed: boolean }).is_completed === true,
    }
  } catch {
    return { exists: false, complete: false }
  }
}

/**
 * Build full overview for all clients.
 * Fetches clients first, then stats/integrations/onboarding in parallel batches.
 *
 * Performance note: for large tenant counts (50+), consider a single
 * aggregate query or materialized view. Current approach is fine for <50 tenants.
 */
export async function getAllClientOverviews(): Promise<ClientOverview[]> {
  const clients = await listAllClients()

  const overviews = await Promise.all(
    clients.map(async (client) => {
      const [callStats, integrations, onboarding] = await Promise.all([
        getClientCallStats(client.id),
        getClientIntegrations(client.id),
        getClientOnboardingState(client.id),
      ])

      return {
        client,
        callStats,
        integrationsCount: integrations.total,
        integrationsHealthy: integrations.healthy,
        hasOnboarding: onboarding.exists,
        onboardingComplete: onboarding.complete,
      }
    }),
  )

  return overviews
}

/** Fetch recent delivery logs across ALL tenants (for alerts) */
export async function getAllRecentDeliveryLogs(
  hoursBack = 24,
  limit = 200,
): Promise<CrmDeliveryLog[]> {
  const supabase = createSupabaseServerClient()
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('crm_delivery_logs')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[ops] getAllRecentDeliveryLogs error:', error.message)
    return []
  }
  return (data ?? []) as CrmDeliveryLog[]
}

/** Fetch recent call logs across ALL tenants (for alerts — lightweight select) */
export async function getAllRecentCallLogs(
  days = 7,
  limit = 500,
): Promise<Pick<CallLog, 'id' | 'client_id' | 'is_booked' | 'created_at' | 'disposition' | 'summary' | 'ai_summary' | 'summary_status'>[]> {
  const supabase = createSupabaseServerClient()
  const since = subDays(new Date(), days).toISOString()

  const { data, error } = await supabase
    .from('call_logs')
    .select('id, client_id, is_booked, created_at, disposition, summary, ai_summary, summary_status')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[ops] getAllRecentCallLogs error:', error.message)
    return []
  }
  return (data ?? []) as Pick<CallLog, 'id' | 'client_id' | 'is_booked' | 'created_at' | 'disposition' | 'summary' | 'ai_summary' | 'summary_status'>[]
}
