/**
 * Tenant-scoped query helpers for crm_delivery_logs.
 *
 * All reads are always filtered by client_id — never expose cross-tenant data.
 * Uses the service-role Supabase client (server-side only).
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { CrmDeliveryLog, CrmDeliveryErrorCode } from '@/lib/types/domain'
import type { CrmDeliveryLog as DbCrmDeliveryLog } from '@/types/database'

// ── Mapper: DB row → domain object ────────────────────────────────────────────

function mapRow(row: DbCrmDeliveryLog): CrmDeliveryLog {
  return {
    id: row.id,
    tenantId: row.client_id,
    integrationProvider: row.integration_provider,
    eventType: row.event_type,
    eventId: row.event_id,
    payload: row.payload,
    requestUrl: row.request_url,
    requestHeadersMasked: row.request_headers_masked,
    httpMethod: row.http_method,
    responseStatus: row.response_status,
    responseBodyPreview: row.response_body_preview,
    latencyMs: row.latency_ms,
    success: row.success,
    errorCode: row.error_code as CrmDeliveryErrorCode | null,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }
}

// ── Filter type ────────────────────────────────────────────────────────────────

export interface ListCrmLogsFilters {
  /** Narrow to success or failure only. Omit for all. */
  success?: boolean
  /** Narrow to a specific provider slug. */
  provider?: string
  /** Narrow to a specific event type. */
  eventType?: string
}

// ── Public query functions ─────────────────────────────────────────────────────

/**
 * List CRM delivery logs for a tenant, sorted newest-first.
 * Returns at most `limit` rows (default 50).
 */
export async function listCrmDeliveryLogs(
  tenantId: string,
  filters?: ListCrmLogsFilters,
  limit = 50,
): Promise<CrmDeliveryLog[]> {
  const supabase = createSupabaseServerClient()

  let query = supabase
    .from('crm_delivery_logs')
    .select('*')
    .eq('client_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (filters?.success !== undefined) {
    query = query.eq('success', filters.success)
  }
  if (filters?.provider) {
    query = query.eq('integration_provider', filters.provider)
  }
  if (filters?.eventType) {
    query = query.eq('event_type', filters.eventType)
  }

  const { data, error } = await query

  if (error) {
    console.error('[crm/query] listCrmDeliveryLogs error:', error.message)
    return []
  }

  return ((data ?? []) as DbCrmDeliveryLog[]).map(mapRow)
}

/**
 * Fetch a single delivery log by ID, tenant-scoped.
 * Returns null if not found or if the row belongs to a different tenant.
 */
export async function getCrmDeliveryLogById(
  tenantId: string,
  id: string,
): Promise<CrmDeliveryLog | null> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('crm_delivery_logs')
    .select('*')
    .eq('client_id', tenantId)
    .eq('id', id)
    .single()

  if (error || !data) return null

  return mapRow(data as DbCrmDeliveryLog)
}
