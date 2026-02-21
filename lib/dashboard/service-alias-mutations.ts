/**
 * Service Alias mutations — tenant-scoped write operations.
 *
 * All writes enforce client_id scoping. Returns null/false on failure
 * (including migration-not-applied).
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { ServiceAlias } from '@/lib/types/domain'

export interface CreateAliasInput {
  aliasText: string
  serviceId: string
  priority?: number
}

export interface UpdateAliasInput {
  aliasText?: string
  serviceId?: string
  isActive?: boolean
  priority?: number
}

function mapRow(row: Record<string, unknown>): ServiceAlias {
  return {
    id: row.id as string,
    tenantId: row.client_id as string,
    aliasText: row.alias_text as string,
    serviceId: row.service_id as string,
    isActive: row.is_active as boolean,
    priority: row.priority as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

/**
 * Create a new service alias.
 */
export async function createServiceAlias(
  tenantId: string,
  input: CreateAliasInput,
): Promise<ServiceAlias | null> {
  const supabase = createSupabaseServerClient()

  try {
    const { data, error } = await supabase
      .from('client_service_aliases')
      .insert({
        client_id: tenantId,
        alias_text: input.aliasText.trim(),
        service_id: input.serviceId,
        priority: input.priority ?? 100,
      })
      .select()
      .single()

    if (error) return null
    return mapRow(data)
  } catch {
    return null
  }
}

/**
 * Update an existing service alias (tenant-scoped).
 */
export async function updateServiceAlias(
  tenantId: string,
  aliasId: string,
  input: UpdateAliasInput,
): Promise<ServiceAlias | null> {
  const supabase = createSupabaseServerClient()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.aliasText !== undefined) updates.alias_text = input.aliasText.trim()
  if (input.serviceId !== undefined) updates.service_id = input.serviceId
  if (input.isActive !== undefined) updates.is_active = input.isActive
  if (input.priority !== undefined) updates.priority = input.priority

  try {
    const { data, error } = await supabase
      .from('client_service_aliases')
      .update(updates)
      .eq('id', aliasId)
      .eq('client_id', tenantId)
      .select()
      .single()

    if (error) return null
    return mapRow(data)
  } catch {
    return null
  }
}

/**
 * Delete a service alias (hard delete, tenant-scoped).
 */
export async function deleteServiceAlias(
  tenantId: string,
  aliasId: string,
): Promise<boolean> {
  const supabase = createSupabaseServerClient()

  try {
    const { error } = await supabase
      .from('client_service_aliases')
      .delete()
      .eq('id', aliasId)
      .eq('client_id', tenantId)

    return !error
  } catch {
    return false
  }
}
