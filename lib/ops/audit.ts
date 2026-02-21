/**
 * Operator Audit Logging — scaffold.
 *
 * Records operator actions (support view, config changes, etc.)
 * for accountability and compliance.
 *
 * ── Current implementation ───────────────────────────────────────────────
 *
 * Logs to server console (structured JSON) + optional DB table.
 * If the ops_audit_log table doesn't exist yet, falls back to console-only.
 *
 * ── Production hardening TODO ────────────────────────────────────────────
 *
 *   □  Apply migration 011_ops_audit_log.sql
 *   □  Add retention policy (auto-delete after 90 days)
 *   □  Add audit log viewer in ops console
 *   □  Consider shipping to external log aggregator (Datadog, etc.)
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'

export type AuditAction =
  | 'ops_console_viewed'
  | 'support_view_started'
  | 'support_view_ended'
  | 'client_dashboard_opened'
  | 'client_reports_opened'
  | 'client_integrations_opened'
  | 'partners_console_viewed'
  | 'partner_detail_viewed'
  | 'alerts_console_viewed'

export interface AuditEntry {
  operatorId: string
  operatorEmail: string | null
  action: AuditAction
  targetClientId?: string
  targetClientSlug?: string
  metadata?: Record<string, unknown>
}

/**
 * Log an operator action. Writes to DB if table exists, always logs to console.
 */
export async function logOperatorAction(entry: AuditEntry): Promise<void> {
  const timestamp = new Date().toISOString()

  // Always log to server console (structured JSON for log aggregation)
  console.info(
    JSON.stringify({
      level: 'audit',
      timestamp,
      operator_id: entry.operatorId,
      operator_email: entry.operatorEmail,
      action: entry.action,
      target_client_id: entry.targetClientId ?? null,
      target_client_slug: entry.targetClientSlug ?? null,
      metadata: entry.metadata ?? {},
    }),
  )

  // Attempt DB write (graceful if table doesn't exist)
  try {
    const supabase = createSupabaseServerClient()
    await supabase.from('ops_audit_log').insert({
      operator_id: entry.operatorId,
      operator_email: entry.operatorEmail,
      action: entry.action,
      target_client_id: entry.targetClientId ?? null,
      target_client_slug: entry.targetClientSlug ?? null,
      metadata: entry.metadata ?? {},
      created_at: timestamp,
    })
  } catch {
    // Table likely doesn't exist yet — console log is the fallback
  }
}
