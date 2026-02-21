/**
 * Alert Rules — centralized thresholds and rule configuration.
 *
 * Each rule defines:
 *   - key, source, severity (default)
 *   - title/description templates
 *   - recommended action text
 *   - confidence level
 *   - thresholds (no scattered magic numbers)
 */

import type { AlertRuleKey, AlertSource, AlertSeverity, AlertConfidence } from './types'

// ── Rule definition ──────────────────────────────────────────────────────────

export interface AlertRuleConfig {
  key: AlertRuleKey
  source: AlertSource
  defaultSeverity: AlertSeverity
  confidence: AlertConfidence
  title: string
  descriptionTemplate: string
  recommendedAction: string
  thresholds: Record<string, number>
}

// ── Centralized thresholds ───────────────────────────────────────────────────

export const ALERT_THRESHOLDS = {
  /** Delivery failures in 24h to trigger spike */
  deliveryFailuresCritical: 5,
  deliveryFailuresWarning: 1,

  /** Hours since last call to trigger stale alert */
  noRecentCallsHours: 72,

  /** Missed-call rate threshold (percent of total) */
  missedCallRateWarning: 30,
  missedCallRateCritical: 50,

  /** Booking rate drop below this triggers alert */
  bookingRateDropThreshold: 10,
  /** Minimum calls to evaluate booking rate */
  bookingRateMinCalls: 10,

  /** Usage allowance percent thresholds */
  usageWarningPercent: 80,
  usageCriticalPercent: 100,
  usageSevereOveragePercent: 120,

  /** Pending summaries count */
  pipelineBacklogThreshold: 10,

  /** Hours since last data refresh */
  dataStaleHours: 48,

  /** Follow-up backlog */
  followUpBacklogWarning: 10,
  followUpBacklogCritical: 25,
} as const

// ── Rule registry ────────────────────────────────────────────────────────────

export const ALERT_RULES: AlertRuleConfig[] = [
  {
    key: 'integration_disconnected',
    source: 'integrations',
    defaultSeverity: 'warning',
    confidence: 'exact',
    title: 'Integration disconnected',
    descriptionTemplate: '{integrationName} is disconnected or in error state',
    recommendedAction: 'Review integration settings and reconnect',
  thresholds: {},
  },
  {
    key: 'all_integrations_down',
    source: 'integrations',
    defaultSeverity: 'critical',
    confidence: 'exact',
    title: 'All integrations unhealthy',
    descriptionTemplate: '{count} integration(s) configured but none healthy',
    recommendedAction: 'Check integration connections immediately',
    thresholds: {},
  },
  {
    key: 'delivery_failures_spike',
    source: 'delivery_logs',
    defaultSeverity: 'warning',
    confidence: 'exact',
    title: 'CRM delivery failures',
    descriptionTemplate: '{count} delivery failures in the last 24 hours',
    recommendedAction: 'Review delivery logs and check integration health',
    thresholds: {
      critical: ALERT_THRESHOLDS.deliveryFailuresCritical,
      warning: ALERT_THRESHOLDS.deliveryFailuresWarning,
    },
  },
  {
    key: 'no_recent_calls',
    source: 'calls',
    defaultSeverity: 'warning',
    confidence: 'derived',
    title: 'No recent calls',
    descriptionTemplate: 'No calls received in the last {hours} hours',
    recommendedAction: 'Verify phone number is active and AI receptionist is running',
    thresholds: { hours: ALERT_THRESHOLDS.noRecentCallsHours },
  },
  {
    key: 'missed_call_rate_high',
    source: 'calls',
    defaultSeverity: 'warning',
    confidence: 'derived',
    title: 'High missed-call rate',
    descriptionTemplate: '{rate}% of calls missed or sent to voicemail',
    recommendedAction: 'Review call handling settings and agent availability',
    thresholds: {
      warning: ALERT_THRESHOLDS.missedCallRateWarning,
      critical: ALERT_THRESHOLDS.missedCallRateCritical,
    },
  },
  {
    key: 'booking_rate_drop',
    source: 'calls',
    defaultSeverity: 'warning',
    confidence: 'derived',
    title: 'Low booking rate',
    descriptionTemplate: 'Booking rate at {rate}% ({booked}/{total} calls)',
    recommendedAction: 'Review AI receptionist scripts and service catalog',
    thresholds: {
      rateThreshold: ALERT_THRESHOLDS.bookingRateDropThreshold,
      minCalls: ALERT_THRESHOLDS.bookingRateMinCalls,
    },
  },
  {
    key: 'no_bookings_from_calls',
    source: 'calls',
    defaultSeverity: 'warning',
    confidence: 'derived',
    title: 'No bookings from calls',
    descriptionTemplate: '{totalCalls} calls handled but zero bookings',
    recommendedAction: 'Review call logs and AI receptionist configuration',
    thresholds: { minCalls: ALERT_THRESHOLDS.bookingRateMinCalls },
  },
  {
    key: 'usage_80_percent',
    source: 'usage_allowance',
    defaultSeverity: 'warning',
    confidence: 'estimated',
    title: 'Usage approaching limit',
    descriptionTemplate: '{metric} at {percent}% of monthly allowance',
    recommendedAction: 'Monitor usage or consider upgrading your plan',
    thresholds: { percent: ALERT_THRESHOLDS.usageWarningPercent },
  },
  {
    key: 'usage_over_limit',
    source: 'usage_allowance',
    defaultSeverity: 'critical',
    confidence: 'estimated',
    title: 'Usage limit exceeded',
    descriptionTemplate: '{metric} at {percent}% — overage charges may apply',
    recommendedAction: 'Review billing settings and consider plan upgrade',
    thresholds: { percent: ALERT_THRESHOLDS.usageCriticalPercent },
  },
  {
    key: 'usage_severe_overage',
    source: 'usage_allowance',
    defaultSeverity: 'critical',
    confidence: 'estimated',
    title: 'Severe usage overage',
    descriptionTemplate: '{metric} at {percent}% — significant overage charges expected',
    recommendedAction: 'Upgrade plan immediately or contact support to manage usage',
    thresholds: { percent: ALERT_THRESHOLDS.usageSevereOveragePercent },
  },
  {
    key: 'pipeline_backlog',
    source: 'summaries_pipeline',
    defaultSeverity: 'info',
    confidence: 'exact',
    title: 'Summary processing backlog',
    descriptionTemplate: '{count} calls awaiting AI summarization',
    recommendedAction: 'Backlog will clear automatically — monitor if it persists',
    thresholds: { count: ALERT_THRESHOLDS.pipelineBacklogThreshold },
  },
  {
    key: 'data_stale',
    source: 'calls',
    defaultSeverity: 'info',
    confidence: 'derived',
    title: 'Data may be stale',
    descriptionTemplate: 'No new data received in {hours}+ hours',
    recommendedAction: 'Check AI receptionist and webhook connectivity',
    thresholds: { hours: ALERT_THRESHOLDS.dataStaleHours },
  },
  {
    key: 'follow_up_backlog',
    source: 'calls',
    defaultSeverity: 'warning',
    confidence: 'exact',
    title: 'Follow-up backlog',
    descriptionTemplate: '{count} calls flagged for human follow-up',
    recommendedAction: 'Review flagged calls and assign follow-up tasks',
    thresholds: {
      warning: ALERT_THRESHOLDS.followUpBacklogWarning,
      critical: ALERT_THRESHOLDS.followUpBacklogCritical,
    },
  },
]

/**
 * Look up a rule configuration by key.
 */
export function getRuleConfig(key: AlertRuleKey): AlertRuleConfig | undefined {
  return ALERT_RULES.find((r) => r.key === key)
}
