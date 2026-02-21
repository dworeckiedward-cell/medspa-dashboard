/**
 * Tenant-scoped mutation helpers for services_catalog.
 *
 * SERVER-SIDE ONLY — uses the service-role Supabase client.
 * Called from API route handlers, not directly from client components.
 *
 * All writes enforce client_id scoping to prevent cross-tenant mutations.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { ServicesCatalog } from '@/types/database'
import type { ClientService } from '@/lib/types/domain'

// ── Input shapes ──────────────────────────────────────────────────────────────

export interface CreateServiceInput {
  name: string
  category?: string | null
  priceCents?: number | null
  currency?: string
  durationMin?: number | null
  sortOrder?: number
}

export interface UpdateServiceInput {
  name?: string
  category?: string | null
  priceCents?: number | null
  currency?: string
  durationMin?: number | null
  sortOrder?: number
  isActive?: boolean
}

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

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Create a new service for a tenant.
 * Throws on DB error.
 */
export async function createClientService(
  tenantId: string,
  input: CreateServiceInput,
): Promise<ClientService> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('services_catalog')
    .insert({
      client_id:    tenantId,
      service_name: input.name.trim(),
      aliases:      [],
      category:     input.category ?? null,
      price_cents:  input.priceCents ?? null,
      currency:     input.currency ?? 'usd',
      duration_min: input.durationMin ?? null,
      sort_order:   input.sortOrder ?? 0,
      is_active:    true,
    })
    .select('*')
    .single()

  if (error) throw new Error(`[services-mutations] create error: ${error.message}`)
  return mapRow(data as ServicesCatalog)
}

/**
 * Update fields on an existing service.
 * Only updates provided fields; ignores undefined keys.
 * Throws on DB error or if the row doesn't belong to this tenant.
 */
export async function updateClientService(
  tenantId: string,
  id: string,
  input: UpdateServiceInput,
): Promise<ClientService> {
  const supabase = createSupabaseServerClient()

  // Build partial update — only include provided keys
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (input.name !== undefined)        patch.service_name = input.name.trim()
  if (input.category !== undefined)    patch.category     = input.category
  if (input.priceCents !== undefined)  patch.price_cents  = input.priceCents
  if (input.currency !== undefined)    patch.currency     = input.currency
  if (input.durationMin !== undefined) patch.duration_min = input.durationMin
  if (input.sortOrder !== undefined)   patch.sort_order   = input.sortOrder
  if (input.isActive !== undefined)    patch.is_active    = input.isActive

  const { data, error } = await supabase
    .from('services_catalog')
    .update(patch)
    .eq('client_id', tenantId)   // tenant-scoped
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw new Error(`[services-mutations] update error: ${error.message}`)
  return mapRow(data as ServicesCatalog)
}

/**
 * Soft-delete: set is_active = false.
 * Use this instead of hard delete to preserve historical revenue attribution.
 */
export async function deactivateClientService(tenantId: string, id: string): Promise<void> {
  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('services_catalog')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('client_id', tenantId)
    .eq('id', id)

  if (error) throw new Error(`[services-mutations] deactivate error: ${error.message}`)
}

/**
 * Move a service one position up or down in sort_order.
 * Swaps sort_order with the adjacent service in the list.
 * Throws on DB error.
 */
export async function reorderClientService(
  tenantId: string,
  id: string,
  direction: 'up' | 'down',
): Promise<void> {
  const supabase = createSupabaseServerClient()

  // Fetch all services ordered by sort_order
  const { data: rows, error: fetchError } = await supabase
    .from('services_catalog')
    .select('id, sort_order')
    .eq('client_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (fetchError || !rows) return

  const idx = rows.findIndex((r) => r.id === id)
  if (idx === -1) return

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= rows.length) return

  const a = rows[idx]
  const b = rows[swapIdx]

  // Swap sort_order values
  await Promise.all([
    supabase
      .from('services_catalog')
      .update({ sort_order: b.sort_order, updated_at: new Date().toISOString() })
      .eq('client_id', tenantId)
      .eq('id', a.id),
    supabase
      .from('services_catalog')
      .update({ sort_order: a.sort_order, updated_at: new Date().toISOString() })
      .eq('client_id', tenantId)
      .eq('id', b.id),
  ])
}
