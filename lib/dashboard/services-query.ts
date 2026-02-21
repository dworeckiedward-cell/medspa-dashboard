/**
 * Tenant-scoped read helpers for services_catalog.
 *
 * All queries filter by client_id — never expose cross-tenant data.
 * Uses the service-role Supabase client (server-side only).
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { ServicesCatalog } from '@/types/database'
import type { ClientService } from '@/lib/types/domain'

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(row: ServicesCatalog): ClientService {
  return {
    id:          row.id,
    tenantId:    row.client_id,
    name:        row.service_name,
    category:    row.category ?? null,
    priceCents:  row.price_cents ?? null,
    currency:    row.currency ?? 'usd',
    durationMin: row.duration_min ?? null,
    sortOrder:   row.sort_order ?? 0,
    isActive:    row.is_active,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  }
}

// ── Public query functions ────────────────────────────────────────────────────

/**
 * List all services for a tenant, ordered by sort_order then name.
 * Includes inactive services so they can be managed in the UI.
 */
export async function listClientServices(tenantId: string): Promise<ClientService[]> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('services_catalog')
    .select('*')
    .eq('client_id', tenantId)
    .order('sort_order', { ascending: true })
    .order('service_name', { ascending: true })

  if (error) {
    console.error('[services-query] listClientServices error:', error.message)
    return []
  }

  return ((data ?? []) as ServicesCatalog[]).map(mapRow)
}

/**
 * Fetch a single service by ID, tenant-scoped.
 * Returns null if not found or if the row belongs to a different tenant.
 */
export async function getClientService(
  tenantId: string,
  id: string,
): Promise<ClientService | null> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('services_catalog')
    .select('*')
    .eq('client_id', tenantId)
    .eq('id', id)
    .single()

  if (error || !data) return null
  return mapRow(data as ServicesCatalog)
}

/**
 * List active services only — used by revenue attribution helpers.
 */
export async function listActiveClientServices(tenantId: string): Promise<ClientService[]> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('services_catalog')
    .select('*')
    .eq('client_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[services-query] listActiveClientServices error:', error.message)
    return []
  }

  return ((data ?? []) as ServicesCatalog[]).map(mapRow)
}
