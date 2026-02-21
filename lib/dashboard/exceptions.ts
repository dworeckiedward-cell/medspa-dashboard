/**
 * Exception detection — deterministic rules engine.
 *
 * Analyzes call logs, delivery logs, and integration state to surface
 * operational issues. No LLM dependence — all rules are data-driven.
 *
 * Each exception includes severity, actionable copy, and optional CTA.
 */

import type { CallLog } from '@/types/database'
import type { CrmDeliveryLog, ClientIntegration } from '@/lib/types/domain'

// ── Types ───────────────────────────────────────────────────────────────────

export type ExceptionSeverity = 'critical' | 'warning' | 'info'

export interface DashboardException {
  id: string
  severity: ExceptionSeverity
  title: string
  description: string
  count: number
  actionLabel?: string
  actionHref?: string
}

// ── Detection rules ─────────────────────────────────────────────────────────

/**
 * Derive all active exceptions from dashboard data.
 * Returns deduplicated, sorted (critical → warning → info) list.
 */
export function deriveExceptions({
  callLogs,
  deliveryLogs,
  integrations,
  servicesCount,
}: {
  callLogs: CallLog[]
  deliveryLogs: CrmDeliveryLog[]
  integrations: ClientIntegration[]
  servicesCount: number
}): DashboardException[] {
  const exceptions: DashboardException[] = []

  // ── 1. Failed CRM deliveries (last 7 days) ─────────────────────────────
  const now = Date.now()
  const sevenDaysAgo = now - 7 * 86_400_000
  const recentDeliveries = deliveryLogs.filter(
    (l) => Date.parse(l.createdAt) >= sevenDaysAgo,
  )
  const failedDeliveries = recentDeliveries.filter((l) => !l.success)

  if (failedDeliveries.length > 0) {
    const failRate = recentDeliveries.length > 0
      ? Math.round((failedDeliveries.length / recentDeliveries.length) * 100)
      : 0
    exceptions.push({
      id: 'failed-deliveries',
      severity: failedDeliveries.length >= 10 ? 'critical' : 'warning',
      title: 'CRM delivery failures',
      description: `${failedDeliveries.length} failed in the last 7 days (${failRate}% failure rate)`,
      count: failedDeliveries.length,
      actionLabel: 'Review integrations',
      actionHref: '/dashboard/integrations',
    })
  }

  // ── 2. Calls without summaries ──────────────────────────────────────────
  const missingSummary = callLogs.filter(
    (c) => !c.ai_summary && !c.summary && c.summary_status !== 'not_applicable',
  )
  if (missingSummary.length > 0 && missingSummary.length > callLogs.length * 0.2) {
    exceptions.push({
      id: 'missing-summaries',
      severity: missingSummary.length > callLogs.length * 0.5 ? 'warning' : 'info',
      title: 'Calls missing summaries',
      description: `${missingSummary.length} of ${callLogs.length} calls have no AI summary`,
      count: missingSummary.length,
    })
  }

  // ── 3. Pending summary processing ──────────────────────────────────────
  const pendingSummaries = callLogs.filter((c) => c.summary_status === 'pending')
  if (pendingSummaries.length >= 5) {
    exceptions.push({
      id: 'pending-summaries',
      severity: 'info',
      title: 'Summary processing backlog',
      description: `${pendingSummaries.length} calls awaiting AI summarization`,
      count: pendingSummaries.length,
    })
  }

  // ── 4. Repeated missed calls from same number ──────────────────────────
  const missedByPhone = new Map<string, number>()
  for (const log of callLogs) {
    if (
      (log.disposition === 'no_answer' || log.disposition === 'voicemail') &&
      log.caller_phone
    ) {
      missedByPhone.set(log.caller_phone, (missedByPhone.get(log.caller_phone) ?? 0) + 1)
    }
  }
  const repeatedMissed = Array.from(missedByPhone.entries()).filter(([, count]) => count >= 3)
  if (repeatedMissed.length > 0) {
    const totalRepeated = repeatedMissed.reduce((s, [, c]) => s + c, 0)
    exceptions.push({
      id: 'repeated-missed',
      severity: 'warning',
      title: 'Repeated missed calls',
      description: `${repeatedMissed.length} caller${repeatedMissed.length !== 1 ? 's' : ''} missed 3+ times (${totalRepeated} total)`,
      count: repeatedMissed.length,
    })
  }

  // ── 5. Integration enabled but no recent successful deliveries ─────────
  const oneDayAgo = now - 86_400_000
  for (const integration of integrations) {
    if (!integration.isEnabled || integration.status === 'disconnected') continue

    const recentSuccess = deliveryLogs.some(
      (l) =>
        l.success &&
        l.integrationProvider === integration.provider &&
        Date.parse(l.createdAt) >= oneDayAgo,
    )
    const hasRecentCalls = callLogs.some(
      (c) => Date.parse(c.created_at) >= oneDayAgo,
    )

    if (!recentSuccess && hasRecentCalls) {
      exceptions.push({
        id: `integration-silent-${integration.id}`,
        severity: 'warning',
        title: `${integration.name} — no recent deliveries`,
        description: 'Integration is enabled but had no successful deliveries in 24h despite call activity',
        count: 1,
        actionLabel: 'Check integration',
        actionHref: '/dashboard/integrations',
      })
    }
  }

  // ── 6. No services configured ──────────────────────────────────────────
  if (servicesCount === 0 && callLogs.length > 0) {
    exceptions.push({
      id: 'no-services',
      severity: 'info',
      title: 'No services configured',
      description: 'Add services to improve revenue attribution accuracy in reports',
      count: 0,
      actionLabel: 'Add services',
      actionHref: '/dashboard/settings',
    })
  }

  // ── 7. Human follow-up backlog ─────────────────────────────────────────
  const followUpNeeded = callLogs.filter((c) => c.human_followup_needed)
  if (followUpNeeded.length >= 5) {
    exceptions.push({
      id: 'followup-backlog',
      severity: followUpNeeded.length >= 15 ? 'warning' : 'info',
      title: 'Follow-up backlog',
      description: `${followUpNeeded.length} calls flagged for human follow-up`,
      count: followUpNeeded.length,
    })
  }

  // Sort: critical → warning → info
  const severityOrder: Record<ExceptionSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  }
  exceptions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return exceptions
}
