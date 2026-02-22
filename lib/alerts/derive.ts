/**
 * Alert Derivation Engine — produces TenantAlert candidates from existing data.
 *
 * Pure computation — no IO. Reads call stats, delivery logs, integrations,
 * usage, and produces fingerprinted alert candidates for upsert.
 *
 * Each alert includes a fingerprint for deduplication: same (client_id, rule_key, context)
 * maps to the same persisted record.
 */

import { ALERT_THRESHOLDS } from './rules'
import type {
  TenantAlert,
  AlertRuleKey,
  AlertSource,
  AlertSeverity,
  AlertConfidence,
} from './types'
import type { CallLog } from '@/types/database'
import type { ClientIntegration, CrmDeliveryLog } from '@/lib/types/domain'
import type { UsageSummary } from '@/lib/billing/types'
import type { ConversationsKpiSummary } from '@/lib/chat/types'

// ── Input type ───────────────────────────────────────────────────────────────

export interface AlertDerivationInput {
  clientId: string
  callLogs: CallLog[]
  deliveryLogs: CrmDeliveryLog[]
  integrations: ClientIntegration[]
  usageSummary: UsageSummary | null
  servicesCount: number
  chatKpi: ConversationsKpiSummary | null
  lastChatActivityAt: string | null
}

// ── Alert candidate (pre-persistence) ────────────────────────────────────────

export interface AlertCandidate {
  clientId: string
  ruleKey: AlertRuleKey
  source: AlertSource
  severity: AlertSeverity
  confidence: AlertConfidence
  title: string
  description: string
  recommendedAction: string
  evidence: Record<string, unknown>
  fingerprint: string
}

// ── Main derivation function ─────────────────────────────────────────────────

/**
 * Derive alert candidates for a single tenant from available data.
 * Returns deduplicated candidates sorted by severity (critical first).
 */
export function deriveAlertCandidates(input: AlertDerivationInput): AlertCandidate[] {
  const candidates: AlertCandidate[] = []

  deriveIntegrationAlerts(input, candidates)
  deriveDeliveryAlerts(input, candidates)
  deriveCallAlerts(input, candidates)
  derivePipelineAlerts(input, candidates)
  deriveUsageAlerts(input, candidates)
  deriveChatAlerts(input, candidates)

  // Sort: critical → warning → info
  const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }
  candidates.sort((a, b) => order[a.severity] - order[b.severity])

  return candidates
}

// ── Integration alerts ───────────────────────────────────────────────────────

function deriveIntegrationAlerts(
  { clientId, integrations }: AlertDerivationInput,
  out: AlertCandidate[],
): void {
  if (integrations.length === 0) return

  const healthy = integrations.filter(
    (i) => i.isEnabled && i.status === 'connected',
  ).length
  const unhealthy = integrations.filter(
    (i) => i.isEnabled && (i.status === 'disconnected' || i.status === 'error'),
  )

  // All integrations down
  if (healthy === 0 && integrations.length > 0) {
    out.push({
      clientId,
      ruleKey: 'all_integrations_down',
      source: 'integrations',
      severity: 'critical',
      confidence: 'exact',
      title: 'All integrations unhealthy',
      description: `${integrations.length} integration(s) configured but none healthy`,
      recommendedAction: 'Check integration connections immediately',
      evidence: { totalIntegrations: integrations.length, healthyCount: 0 },
      fingerprint: `${clientId}:all_integrations_down`,
    })
    return // skip per-integration alerts if all are down
  }

  // Per-integration disconnected/error
  for (const integration of unhealthy) {
    out.push({
      clientId,
      ruleKey: 'integration_disconnected',
      source: 'integrations',
      severity: 'warning',
      confidence: 'exact',
      title: `${integration.name} disconnected`,
      description: `${integration.name} (${integration.provider}) is ${integration.status}`,
      recommendedAction: 'Review integration settings and reconnect',
      evidence: {
        integrationId: integration.id,
        provider: integration.provider,
        status: integration.status,
      },
      fingerprint: `${clientId}:integration_disconnected:${integration.id}`,
    })
  }
}

// ── Delivery failure alerts ──────────────────────────────────────────────────

function deriveDeliveryAlerts(
  { clientId, deliveryLogs }: AlertDerivationInput,
  out: AlertCandidate[],
): void {
  const now = Date.now()
  const oneDayAgo = now - 24 * 60 * 60 * 1000

  const recent = deliveryLogs.filter((l) => Date.parse(l.createdAt) >= oneDayAgo)
  const failures = recent.filter((l) => !l.success)

  if (failures.length >= ALERT_THRESHOLDS.deliveryFailuresCritical) {
    out.push({
      clientId,
      ruleKey: 'delivery_failures_spike',
      source: 'delivery_logs',
      severity: 'critical',
      confidence: 'exact',
      title: `${failures.length} delivery failures`,
      description: `${failures.length} CRM delivery failures in the last 24 hours`,
      recommendedAction: 'Review delivery logs and check integration health',
      evidence: {
        failureCount: failures.length,
        totalDeliveries: recent.length,
        failureRate: recent.length > 0 ? Math.round((failures.length / recent.length) * 100) : 0,
      },
      fingerprint: `${clientId}:delivery_failures_spike`,
    })
  } else if (failures.length >= ALERT_THRESHOLDS.deliveryFailuresWarning) {
    out.push({
      clientId,
      ruleKey: 'delivery_failures_spike',
      source: 'delivery_logs',
      severity: 'warning',
      confidence: 'exact',
      title: `${failures.length} delivery failure${failures.length !== 1 ? 's' : ''}`,
      description: `CRM delivery issues detected in the last 24 hours`,
      recommendedAction: 'Review delivery logs and check integration health',
      evidence: { failureCount: failures.length, totalDeliveries: recent.length },
      fingerprint: `${clientId}:delivery_failures_spike`,
    })
  }
}

// ── Call-based alerts ────────────────────────────────────────────────────────

function deriveCallAlerts(
  { clientId, callLogs }: AlertDerivationInput,
  out: AlertCandidate[],
): void {
  const now = Date.now()

  // No recent calls
  if (callLogs.length > 0) {
    const mostRecent = Math.max(...callLogs.map((c) => Date.parse(c.created_at)))
    const hoursSinceLast = (now - mostRecent) / (60 * 60 * 1000)

    if (hoursSinceLast >= ALERT_THRESHOLDS.noRecentCallsHours) {
      out.push({
        clientId,
        ruleKey: 'no_recent_calls',
        source: 'calls',
        severity: 'warning',
        confidence: 'derived',
        title: 'No recent calls',
        description: `No calls received in the last ${Math.round(hoursSinceLast)} hours`,
        recommendedAction: 'Verify phone number is active and AI receptionist is running',
        evidence: { hoursSinceLast: Math.round(hoursSinceLast), lastCallAt: new Date(mostRecent).toISOString() },
        fingerprint: `${clientId}:no_recent_calls`,
      })
    }

    // Data stale
    if (hoursSinceLast >= ALERT_THRESHOLDS.dataStaleHours) {
      out.push({
        clientId,
        ruleKey: 'data_stale',
        source: 'calls',
        severity: 'info',
        confidence: 'derived',
        title: 'Data may be stale',
        description: `No new data received in ${Math.round(hoursSinceLast)}+ hours`,
        recommendedAction: 'Check AI receptionist and webhook connectivity',
        evidence: { hoursSinceLast: Math.round(hoursSinceLast) },
        fingerprint: `${clientId}:data_stale`,
      })
    }
  } else if (callLogs.length === 0) {
    // No calls at all — skip detailed call analysis
    return
  }

  // Missed-call rate
  const missedCalls = callLogs.filter(
    (c) => c.disposition === 'no_answer' || c.disposition === 'voicemail',
  )
  if (callLogs.length >= 5) {
    const missedRate = Math.round((missedCalls.length / callLogs.length) * 100)

    if (missedRate >= ALERT_THRESHOLDS.missedCallRateCritical) {
      out.push({
        clientId,
        ruleKey: 'missed_call_rate_high',
        source: 'calls',
        severity: 'critical',
        confidence: 'derived',
        title: 'High missed-call rate',
        description: `${missedRate}% of calls missed or sent to voicemail`,
        recommendedAction: 'Review call handling settings and agent availability',
        evidence: { missedRate, missedCount: missedCalls.length, totalCalls: callLogs.length },
        fingerprint: `${clientId}:missed_call_rate_high`,
      })
    } else if (missedRate >= ALERT_THRESHOLDS.missedCallRateWarning) {
      out.push({
        clientId,
        ruleKey: 'missed_call_rate_high',
        source: 'calls',
        severity: 'warning',
        confidence: 'derived',
        title: 'High missed-call rate',
        description: `${missedRate}% of calls missed or sent to voicemail`,
        recommendedAction: 'Review call handling settings and agent availability',
        evidence: { missedRate, missedCount: missedCalls.length, totalCalls: callLogs.length },
        fingerprint: `${clientId}:missed_call_rate_high`,
      })
    }
  }

  // Booking rate drop / no bookings
  const bookedCalls = callLogs.filter((c) => c.is_booked)
  if (callLogs.length >= ALERT_THRESHOLDS.bookingRateMinCalls) {
    const bookingRate = Math.round((bookedCalls.length / callLogs.length) * 100)

    if (bookedCalls.length === 0) {
      out.push({
        clientId,
        ruleKey: 'no_bookings_from_calls',
        source: 'calls',
        severity: 'warning',
        confidence: 'derived',
        title: 'No bookings from calls',
        description: `${callLogs.length} calls handled but zero bookings`,
        recommendedAction: 'Review call logs and AI receptionist configuration',
        evidence: { totalCalls: callLogs.length, bookedCalls: 0, bookingRate: 0 },
        fingerprint: `${clientId}:no_bookings_from_calls`,
      })
    } else if (bookingRate < ALERT_THRESHOLDS.bookingRateDropThreshold) {
      out.push({
        clientId,
        ruleKey: 'booking_rate_drop',
        source: 'calls',
        severity: 'warning',
        confidence: 'derived',
        title: 'Low booking rate',
        description: `Booking rate at ${bookingRate}% (${bookedCalls.length}/${callLogs.length} calls)`,
        recommendedAction: 'Review AI receptionist scripts and service catalog',
        evidence: { bookingRate, bookedCalls: bookedCalls.length, totalCalls: callLogs.length },
        fingerprint: `${clientId}:booking_rate_drop`,
      })
    }
  }

  // Follow-up backlog
  const followUps = callLogs.filter((c) => c.human_followup_needed)
  if (followUps.length >= ALERT_THRESHOLDS.followUpBacklogCritical) {
    out.push({
      clientId,
      ruleKey: 'follow_up_backlog',
      source: 'calls',
      severity: 'warning',
      confidence: 'exact',
      title: 'Follow-up backlog',
      description: `${followUps.length} calls flagged for human follow-up`,
      recommendedAction: 'Review flagged calls and assign follow-up tasks',
      evidence: { count: followUps.length },
      fingerprint: `${clientId}:follow_up_backlog`,
    })
  } else if (followUps.length >= ALERT_THRESHOLDS.followUpBacklogWarning) {
    out.push({
      clientId,
      ruleKey: 'follow_up_backlog',
      source: 'calls',
      severity: 'info',
      confidence: 'exact',
      title: 'Follow-up backlog',
      description: `${followUps.length} calls flagged for human follow-up`,
      recommendedAction: 'Review flagged calls and assign follow-up tasks',
      evidence: { count: followUps.length },
      fingerprint: `${clientId}:follow_up_backlog`,
    })
  }
}

// ── Pipeline alerts ──────────────────────────────────────────────────────────

function derivePipelineAlerts(
  { clientId, callLogs }: AlertDerivationInput,
  out: AlertCandidate[],
): void {
  const pendingSummaries = callLogs.filter((c) => c.summary_status === 'pending')

  if (pendingSummaries.length >= ALERT_THRESHOLDS.pipelineBacklogThreshold) {
    out.push({
      clientId,
      ruleKey: 'pipeline_backlog',
      source: 'summaries_pipeline',
      severity: 'info',
      confidence: 'exact',
      title: 'Summary processing backlog',
      description: `${pendingSummaries.length} calls awaiting AI summarization`,
      recommendedAction: 'Backlog will clear automatically — monitor if it persists',
      evidence: { pendingCount: pendingSummaries.length },
      fingerprint: `${clientId}:pipeline_backlog`,
    })
  }
}

// ── Usage alerts ─────────────────────────────────────────────────────────────

function deriveUsageAlerts(
  { clientId, usageSummary }: AlertDerivationInput,
  out: AlertCandidate[],
): void {
  // Only emit usage alerts when metering data is available (connected or derived)
  // Never emit for scaffold/placeholder data to avoid false positives
  if (!usageSummary) return
  if (!usageSummary.isMeteringConnected && usageSummary.confidence === 'estimated') return

  const confidence = usageSummary.confidence === 'exact' ? 'exact' as const : 'estimated' as const

  for (const allowance of usageSummary.allowances) {
    // 120%+ — severe overage
    if (allowance.usagePercent >= ALERT_THRESHOLDS.usageSevereOveragePercent) {
      out.push({
        clientId,
        ruleKey: 'usage_severe_overage',
        source: 'usage_allowance',
        severity: 'critical',
        confidence,
        title: 'Severe usage overage',
        description: `${allowance.metricLabel} at ${Math.round(allowance.usagePercent)}% — significant overage charges expected`,
        recommendedAction: 'Upgrade plan immediately or contact support to manage usage',
        evidence: {
          metric: allowance.metricType,
          percent: allowance.usagePercent,
          consumed: allowance.usageConsumed,
          included: allowance.allowanceIncluded,
          overageUnits: allowance.overageUnits,
        },
        fingerprint: `${clientId}:usage_severe_overage:${allowance.metricType}`,
      })
    } else if (allowance.usagePercent >= ALERT_THRESHOLDS.usageCriticalPercent) {
      // 100%+ — limit exceeded
      out.push({
        clientId,
        ruleKey: 'usage_over_limit',
        source: 'usage_allowance',
        severity: 'critical',
        confidence,
        title: 'Usage limit exceeded',
        description: `${allowance.metricLabel} at ${Math.round(allowance.usagePercent)}% — overage charges may apply`,
        recommendedAction: 'Review billing settings and consider plan upgrade',
        evidence: {
          metric: allowance.metricType,
          percent: allowance.usagePercent,
          consumed: allowance.usageConsumed,
          included: allowance.allowanceIncluded,
        },
        fingerprint: `${clientId}:usage_over_limit:${allowance.metricType}`,
      })
    } else if (allowance.usagePercent >= ALERT_THRESHOLDS.usageWarningPercent) {
      // 80%+ — approaching limit
      out.push({
        clientId,
        ruleKey: 'usage_80_percent',
        source: 'usage_allowance',
        severity: 'warning',
        confidence,
        title: 'Usage approaching limit',
        description: `${allowance.metricLabel} at ${Math.round(allowance.usagePercent)}% of monthly allowance`,
        recommendedAction: 'Monitor usage or consider upgrading your plan',
        evidence: {
          metric: allowance.metricType,
          percent: allowance.usagePercent,
          consumed: allowance.usageConsumed,
          included: allowance.allowanceIncluded,
        },
        fingerprint: `${clientId}:usage_80_percent:${allowance.metricType}`,
      })
    }
  }
}

// ── Chat alerts ─────────────────────────────────────────────────────────────

function deriveChatAlerts(
  { clientId, chatKpi, lastChatActivityAt }: AlertDerivationInput,
  out: AlertCandidate[],
): void {
  // Only derive chat alerts when we have real data
  if (!chatKpi || chatKpi.totalConversations === 0) return

  const now = Date.now()

  // Chat ingestion stale — no new activity for N hours (only if tenant has chat history)
  if (lastChatActivityAt) {
    const hoursSinceLast = (now - Date.parse(lastChatActivityAt)) / (60 * 60 * 1000)

    if (hoursSinceLast >= ALERT_THRESHOLDS.chatIngestionStaleHours) {
      out.push({
        clientId,
        ruleKey: 'chat_ingestion_stale',
        source: 'chat',
        severity: 'warning',
        confidence: 'derived',
        title: 'Chat ingestion stale',
        description: `No new chat events received in ${Math.round(hoursSinceLast)}+ hours`,
        recommendedAction: 'Check chatbot webhook connectivity and n8n/ManyChat workflows',
        evidence: {
          hoursSinceLast: Math.round(hoursSinceLast),
          lastActivityAt: lastChatActivityAt,
        },
        fingerprint: `${clientId}:chat_ingestion_stale`,
      })
    }
  }

  // Unread conversations backlog
  const unread = chatKpi.unreadConversations
  if (unread >= ALERT_THRESHOLDS.chatUnreadBacklogCritical) {
    out.push({
      clientId,
      ruleKey: 'chat_unread_backlog',
      source: 'chat',
      severity: 'critical',
      confidence: 'exact',
      title: 'Large unread conversations backlog',
      description: `${unread} conversations awaiting review — potential missed leads`,
      recommendedAction: 'Review unread conversations in the Inbox to avoid missed leads',
      evidence: { unreadCount: unread, totalConversations: chatKpi.totalConversations },
      fingerprint: `${clientId}:chat_unread_backlog`,
    })
  } else if (unread >= ALERT_THRESHOLDS.chatUnreadBacklogWarning) {
    out.push({
      clientId,
      ruleKey: 'chat_unread_backlog',
      source: 'chat',
      severity: 'warning',
      confidence: 'exact',
      title: 'Unread conversations backlog',
      description: `${unread} conversations awaiting review`,
      recommendedAction: 'Review unread conversations in the Inbox',
      evidence: { unreadCount: unread, totalConversations: chatKpi.totalConversations },
      fingerprint: `${clientId}:chat_unread_backlog`,
    })
  }
}
