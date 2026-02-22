/**
 * Alert & Incident domain types — persistent alert model.
 *
 * Extends the existing derived-only alerts (lib/ops/alerts.ts, lib/dashboard/exceptions.ts)
 * with a persistent lifecycle model: open → acknowledged → resolved.
 *
 * ── Key distinctions ─────────────────────────────────────────────────────────
 *
 * Existing:
 *   - deriveOpsAlerts()   → cross-tenant, ephemeral, re-derived on each page load
 *   - deriveExceptions()  → tenant-scoped, ephemeral, per-render
 *
 * New (this file):
 *   - TenantAlert         → persistent, lifecycle-managed, stored in DB
 *   - Can be acknowledged / resolved / muted by operators
 *   - Fingerprinted for deduplication
 */

// ── Alert source ─────────────────────────────────────────────────────────────

export type AlertSource =
  | 'integrations'
  | 'delivery_logs'
  | 'calls'
  | 'summaries_pipeline'
  | 'usage_allowance'
  | 'chat'
  | 'manual'

// ── Severity ─────────────────────────────────────────────────────────────────

export type AlertSeverity = 'info' | 'warning' | 'critical'

// ── Alert status (lifecycle) ─────────────────────────────────────────────────

export type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'muted'

// ── Confidence / data quality label ──────────────────────────────────────────

export type AlertConfidence = 'exact' | 'derived' | 'estimated'

// ── Alert rule key ───────────────────────────────────────────────────────────

export type AlertRuleKey =
  | 'integration_disconnected'
  | 'delivery_failures_spike'
  | 'no_recent_calls'
  | 'missed_call_rate_high'
  | 'booking_rate_drop'
  | 'usage_80_percent'
  | 'usage_over_limit'
  | 'usage_severe_overage'
  | 'pipeline_backlog'
  | 'data_stale'
  | 'all_integrations_down'
  | 'no_bookings_from_calls'
  | 'follow_up_backlog'
  | 'chat_ingestion_stale'
  | 'chat_unread_backlog'

// ── Core alert entity ────────────────────────────────────────────────────────

export interface TenantAlert {
  id: string
  clientId: string
  ruleKey: AlertRuleKey
  source: AlertSource
  severity: AlertSeverity
  status: AlertStatus
  confidence: AlertConfidence
  title: string
  description: string
  recommendedAction: string
  evidence: Record<string, unknown>
  fingerprint: string
  firstDetectedAt: string      // ISO 8601
  lastDetectedAt: string       // ISO 8601
  acknowledgedAt: string | null
  acknowledgedBy: string | null
  resolvedAt: string | null
  resolvedBy: string | null
  mutedUntil: string | null
  createdAt: string
  updatedAt: string
}

// ── Alert event (history) ────────────────────────────────────────────────────

export type AlertEventType =
  | 'detected'
  | 'updated'
  | 'acknowledged'
  | 'resolved'
  | 'reopened'
  | 'muted'

export interface TenantAlertEvent {
  id: string
  alertId: string
  eventType: AlertEventType
  actor: string | null
  payload: Record<string, unknown>
  createdAt: string
}

// ── Cross-tenant alert summary (for ops KPIs) ────────────────────────────────

export interface AlertsSummary {
  totalOpen: number
  critical: number
  warning: number
  info: number
  affectedTenants: number
  unresolvedOver24h: number
  acknowledgedPending: number
  resolvedToday: number
}

// ── Alert with client info (for ops table) ───────────────────────────────────

export interface AlertWithClient extends TenantAlert {
  clientName: string
  clientSlug: string
}
