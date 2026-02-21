/**
 * Alert Query Helpers — read operations for persistent alerts.
 *
 * Supports both tenant-scoped reads (client dashboard) and
 * cross-tenant reads (ops console).
 *
 * Falls back to derived-only alerts when tenant_alerts table doesn't exist.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type {
  TenantAlert,
  AlertWithClient,
  AlertsSummary,
  AlertSeverity,
  AlertStatus,
  AlertSource,
  TenantAlertEvent,
} from './types'

// ── Tenant-scoped queries ────────────────────────────────────────────────────

/**
 * List alerts for a single tenant, sorted by severity then recency.
 */
export async function listTenantAlerts(
  clientId: string,
  opts?: {
    status?: AlertStatus[]
    severity?: AlertSeverity[]
    limit?: number
  },
): Promise<TenantAlert[]> {
  const supabase = createSupabaseServerClient()

  let query = supabase
    .from('tenant_alerts')
    .select('*')
    .eq('client_id', clientId)
    .order('severity_rank', { ascending: true })
    .order('last_detected_at', { ascending: false })
    .limit(opts?.limit ?? 50)

  if (opts?.status && opts.status.length > 0) {
    query = query.in('status', opts.status)
  }
  if (opts?.severity && opts.severity.length > 0) {
    query = query.in('severity', opts.severity)
  }

  const { data, error } = await query

  if (error) {
    if (error.message?.includes('does not exist')) return []
    console.warn('[alerts/query] listTenantAlerts error:', error.message)
    return []
  }

  return (data ?? []).map(mapAlertRow)
}

// ── Cross-tenant queries (ops) ───────────────────────────────────────────────

/**
 * List alerts across ALL tenants with filters. For ops console.
 */
export async function listAllAlerts(opts?: {
  status?: AlertStatus[]
  severity?: AlertSeverity[]
  source?: AlertSource[]
  clientId?: string
  limit?: number
}): Promise<AlertWithClient[]> {
  const supabase = createSupabaseServerClient()

  let query = supabase
    .from('tenant_alerts')
    .select('*, clients:client_id(name, slug)')
    .order('severity_rank', { ascending: true })
    .order('last_detected_at', { ascending: false })
    .limit(opts?.limit ?? 100)

  if (opts?.status && opts.status.length > 0) {
    query = query.in('status', opts.status)
  }
  if (opts?.severity && opts.severity.length > 0) {
    query = query.in('severity', opts.severity)
  }
  if (opts?.source && opts.source.length > 0) {
    query = query.in('source', opts.source)
  }
  if (opts?.clientId) {
    query = query.eq('client_id', opts.clientId)
  }

  const { data, error } = await query

  if (error) {
    if (error.message?.includes('does not exist')) return []
    console.warn('[alerts/query] listAllAlerts error:', error.message)
    return []
  }

  return (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (row as any).clients as { name: string; slug: string } | null
    return {
      ...mapAlertRow(row),
      clientName: client?.name ?? 'Unknown',
      clientSlug: client?.slug ?? '',
    }
  })
}

/**
 * Compute cross-tenant alert summary KPIs.
 */
export async function getAlertsSummary(): Promise<AlertsSummary> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('tenant_alerts')
    .select('id, client_id, severity, status, first_detected_at, resolved_at')

  if (error) {
    if (error.message?.includes('does not exist')) return emptySummary()
    console.warn('[alerts/query] getAlertsSummary error:', error.message)
    return emptySummary()
  }

  const rows = data ?? []
  const now = Date.now()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const openAlerts = rows.filter((r) => r.status === 'open' || r.status === 'acknowledged')
  const affectedTenantIds = new Set(openAlerts.map((r) => r.client_id))

  return {
    totalOpen: openAlerts.filter((r) => r.status === 'open').length,
    critical: openAlerts.filter((r) => r.severity === 'critical').length,
    warning: openAlerts.filter((r) => r.severity === 'warning').length,
    info: openAlerts.filter((r) => r.severity === 'info').length,
    affectedTenants: affectedTenantIds.size,
    unresolvedOver24h: openAlerts.filter(
      (r) => now - Date.parse(r.first_detected_at) > 24 * 60 * 60 * 1000,
    ).length,
    acknowledgedPending: rows.filter((r) => r.status === 'acknowledged').length,
    resolvedToday: rows.filter(
      (r) => r.status === 'resolved' && r.resolved_at && Date.parse(r.resolved_at) >= todayStart.getTime(),
    ).length,
  }
}

/**
 * List alert events (history) for a specific alert.
 */
export async function listAlertEvents(alertId: string): Promise<TenantAlertEvent[]> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('tenant_alert_events')
    .select('*')
    .eq('alert_id', alertId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    if (error.message?.includes('does not exist')) return []
    console.warn('[alerts/query] listAlertEvents error:', error.message)
    return []
  }

  return (data ?? []).map(mapEventRow)
}

// ── Row mappers ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAlertRow(row: any): TenantAlert {
  return {
    id: row.id,
    clientId: row.client_id,
    ruleKey: row.rule_key,
    source: row.source,
    severity: row.severity,
    status: row.status,
    confidence: row.confidence,
    title: row.title,
    description: row.description,
    recommendedAction: row.recommended_action ?? '',
    evidence: row.evidence ?? {},
    fingerprint: row.fingerprint,
    firstDetectedAt: row.first_detected_at,
    lastDetectedAt: row.last_detected_at,
    acknowledgedAt: row.acknowledged_at ?? null,
    acknowledgedBy: row.acknowledged_by ?? null,
    resolvedAt: row.resolved_at ?? null,
    resolvedBy: row.resolved_by ?? null,
    mutedUntil: row.muted_until ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEventRow(row: any): TenantAlertEvent {
  return {
    id: row.id,
    alertId: row.alert_id,
    eventType: row.event_type,
    actor: row.actor ?? null,
    payload: row.payload ?? {},
    createdAt: row.created_at,
  }
}

function emptySummary(): AlertsSummary {
  return {
    totalOpen: 0,
    critical: 0,
    warning: 0,
    info: 0,
    affectedTenants: 0,
    unresolvedOver24h: 0,
    acknowledgedPending: 0,
    resolvedToday: 0,
  }
}
