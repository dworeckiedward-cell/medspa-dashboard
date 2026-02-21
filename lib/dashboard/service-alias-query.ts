/**
 * Service Alias queries — tenant-scoped read operations.
 *
 * Gracefully returns empty array if migration 010 is not applied.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { ServiceAlias } from '@/lib/types/domain'

/**
 * List all service aliases for a tenant, joined with service name.
 * Returns [] if the table does not exist.
 */
export async function listServiceAliases(tenantId: string): Promise<ServiceAlias[]> {
  const supabase = createSupabaseServerClient()

  try {
    const { data, error } = await supabase
      .from('client_service_aliases')
      .select('*, services_catalog!inner(service_name)')
      .eq('client_id', tenantId)
      .order('priority', { ascending: false })
      .order('alias_text', { ascending: true })

    if (error) {
      // Table doesn't exist yet — graceful fallback
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return []
      }
      throw error
    }

    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      tenantId: row.client_id as string,
      aliasText: row.alias_text as string,
      serviceId: row.service_id as string,
      isActive: row.is_active as boolean,
      priority: row.priority as number,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      serviceName: (row.services_catalog as Record<string, unknown>)?.service_name as string | undefined,
    }))
  } catch {
    // Catch-all for missing table
    return []
  }
}

/**
 * List only active aliases for use in attribution enhancement.
 */
export async function listActiveAliases(tenantId: string): Promise<ServiceAlias[]> {
  const all = await listServiceAliases(tenantId)
  return all.filter((a) => a.isActive)
}
