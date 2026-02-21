/**
 * Alert Mutations — lifecycle actions and alert upsert.
 *
 * Supports:
 *   - Upsert alerts from derivation engine (fingerprint-based dedupe)
 *   - Acknowledge / Resolve / Reopen / Mute actions
 *   - Event logging for audit trail
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { AlertCandidate } from './derive'
import type { AlertStatus, AlertEventType } from './types'

// ── Upsert derived alerts ────────────────────────────────────────────────────

/**
 * Upsert alert candidates into the tenant_alerts table.
 * Uses fingerprint for deduplication: existing open alerts get updated,
 * new fingerprints create new rows.
 *
 * Returns count of created/updated alerts.
 */
export async function upsertAlerts(
  candidates: AlertCandidate[],
): Promise<{ created: number; updated: number; error?: string }> {
  if (candidates.length === 0) return { created: 0, updated: 0 }

  const supabase = createSupabaseServerClient()
  const now = new Date().toISOString()
  let created = 0
  let updated = 0

  for (const candidate of candidates) {
    // Check for existing active alert with same fingerprint
    const { data: existing } = await supabase
      .from('tenant_alerts')
      .select('id, status')
      .eq('fingerprint', candidate.fingerprint)
      .in('status', ['open', 'acknowledged'])
      .single()

    if (existing) {
      // Update last_detected_at and evidence
      await supabase
        .from('tenant_alerts')
        .update({
          last_detected_at: now,
          severity: candidate.severity,
          title: candidate.title,
          description: candidate.description,
          evidence: candidate.evidence,
          updated_at: now,
        })
        .eq('id', existing.id)
      updated++
    } else {
      // Insert new alert
      const severityRank = candidate.severity === 'critical' ? 0 : candidate.severity === 'warning' ? 1 : 2
      const { error } = await supabase
        .from('tenant_alerts')
        .insert({
          client_id: candidate.clientId,
          rule_key: candidate.ruleKey,
          source: candidate.source,
          severity: candidate.severity,
          severity_rank: severityRank,
          status: 'open',
          confidence: candidate.confidence,
          title: candidate.title,
          description: candidate.description,
          recommended_action: candidate.recommendedAction,
          evidence: candidate.evidence,
          fingerprint: candidate.fingerprint,
          first_detected_at: now,
          last_detected_at: now,
          created_at: now,
          updated_at: now,
        })

      if (error) {
        if (error.message?.includes('does not exist')) {
          return { created: 0, updated: 0, error: 'Table not yet created' }
        }
        console.error('[alerts/mutations] insert error:', error.message)
        continue
      }
      created++
    }
  }

  return { created, updated }
}

// ── Lifecycle actions ────────────────────────────────────────────────────────

export interface LifecycleResult {
  success: boolean
  error?: string
}

/**
 * Acknowledge an alert. Sets status to 'acknowledged' with actor + timestamp.
 */
export async function acknowledgeAlert(
  alertId: string,
  actor: string,
): Promise<LifecycleResult> {
  return transitionAlert(alertId, 'acknowledged', actor, 'acknowledged')
}

/**
 * Resolve an alert. Sets status to 'resolved' with actor + timestamp.
 */
export async function resolveAlert(
  alertId: string,
  actor: string,
): Promise<LifecycleResult> {
  return transitionAlert(alertId, 'resolved', actor, 'resolved')
}

/**
 * Reopen a resolved alert.
 */
export async function reopenAlert(
  alertId: string,
  actor: string,
): Promise<LifecycleResult> {
  return transitionAlert(alertId, 'open', actor, 'reopened')
}

/**
 * Mute an alert until a given timestamp.
 */
export async function muteAlert(
  alertId: string,
  actor: string,
  mutedUntil: string,
): Promise<LifecycleResult> {
  const supabase = createSupabaseServerClient()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('tenant_alerts')
    .update({
      status: 'muted',
      muted_until: mutedUntil,
      updated_at: now,
    })
    .eq('id', alertId)

  if (error) {
    if (error.message?.includes('does not exist')) {
      return { success: true } // graceful if table missing
    }
    return { success: false, error: error.message }
  }

  await logAlertEvent(alertId, 'muted', actor, { mutedUntil })
  return { success: true }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async function transitionAlert(
  alertId: string,
  newStatus: AlertStatus,
  actor: string,
  eventType: AlertEventType,
): Promise<LifecycleResult> {
  const supabase = createSupabaseServerClient()
  const now = new Date().toISOString()

  const updateFields: Record<string, unknown> = {
    status: newStatus,
    updated_at: now,
  }

  if (newStatus === 'acknowledged') {
    updateFields.acknowledged_at = now
    updateFields.acknowledged_by = actor
  } else if (newStatus === 'resolved') {
    updateFields.resolved_at = now
    updateFields.resolved_by = actor
  } else if (newStatus === 'open') {
    // Reopen — clear resolution fields
    updateFields.resolved_at = null
    updateFields.resolved_by = null
  }

  const { error } = await supabase
    .from('tenant_alerts')
    .update(updateFields)
    .eq('id', alertId)

  if (error) {
    if (error.message?.includes('does not exist')) {
      return { success: true }
    }
    return { success: false, error: error.message }
  }

  await logAlertEvent(alertId, eventType, actor)
  return { success: true }
}

async function logAlertEvent(
  alertId: string,
  eventType: AlertEventType,
  actor: string | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const supabase = createSupabaseServerClient()
  const now = new Date().toISOString()

  try {
    await supabase.from('tenant_alert_events').insert({
      alert_id: alertId,
      event_type: eventType,
      actor,
      payload,
      created_at: now,
    })
  } catch {
    // Table may not exist — silent
  }
}
