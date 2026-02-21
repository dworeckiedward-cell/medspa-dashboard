/**
 * Cross-tenant Alerts — deterministic rules for the Operator Console.
 *
 * Surfaces operational issues across all tenants for proactive monitoring.
 * No LLM dependency — all rules are heuristic / threshold-based.
 */

import type { ClientOverview } from './query'
import type { ClientHealthScore } from './health-score'
import type { CrmDeliveryLog } from '@/types/database'

// ── Types ────────────────────────────────────────────────────────────────────

export type OpsAlertSeverity = 'critical' | 'warning' | 'info'

export interface OpsAlert {
  id: string
  severity: OpsAlertSeverity
  clientId: string
  clientName: string
  clientSlug: string
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}

// ── Alert derivation ─────────────────────────────────────────────────────────

interface AlertsInput {
  overviews: ClientOverview[]
  healthScores: Map<string, ClientHealthScore>
  deliveryLogs: CrmDeliveryLog[]
}

/**
 * Derive cross-tenant alerts from client overviews, health scores, and delivery logs.
 * Returns alerts sorted by severity (critical first), then client name.
 */
export function deriveOpsAlerts(input: AlertsInput): OpsAlert[] {
  const { overviews, healthScores, deliveryLogs } = input
  const alerts: OpsAlert[] = []

  // Group delivery failures by client
  const failuresByClient = new Map<string, number>()
  for (const log of deliveryLogs) {
    if (!log.success) {
      failuresByClient.set(
        log.client_id,
        (failuresByClient.get(log.client_id) ?? 0) + 1,
      )
    }
  }

  for (const overview of overviews) {
    const { client, callStats, integrationsCount, integrationsHealthy } = overview
    const health = healthScores.get(client.id)

    // ── 1. Critical health score ───────────────────────────────────────
    if (health && health.level === 'critical') {
      alerts.push({
        id: `health-critical-${client.id}`,
        severity: 'critical',
        clientId: client.id,
        clientName: client.name,
        clientSlug: client.slug,
        title: 'Client health critical',
        description: health.reasons.join('; '),
        actionLabel: 'View dashboard',
        actionHref: `/dashboard?tenant=${client.slug}`,
      })
    }

    // ── 2. Integration failures in last 24h ────────────────────────────
    const failures = failuresByClient.get(client.id) ?? 0
    if (failures > 5) {
      alerts.push({
        id: `delivery-failures-${client.id}`,
        severity: 'critical',
        clientId: client.id,
        clientName: client.name,
        clientSlug: client.slug,
        title: `${failures} delivery failures`,
        description: `${failures} CRM delivery failures in the last 24 hours`,
        actionLabel: 'Check integrations',
        actionHref: `/dashboard/integrations?tenant=${client.slug}`,
      })
    } else if (failures > 0) {
      alerts.push({
        id: `delivery-failures-${client.id}`,
        severity: 'warning',
        clientId: client.id,
        clientName: client.name,
        clientSlug: client.slug,
        title: `${failures} delivery failure${failures !== 1 ? 's' : ''}`,
        description: `CRM delivery issues detected in last 24 hours`,
        actionLabel: 'Check integrations',
        actionHref: `/dashboard/integrations?tenant=${client.slug}`,
      })
    }

    // ── 3. Unhealthy integrations ──────────────────────────────────────
    if (integrationsCount > 0 && integrationsHealthy === 0) {
      alerts.push({
        id: `integrations-down-${client.id}`,
        severity: 'critical',
        clientId: client.id,
        clientName: client.name,
        clientSlug: client.slug,
        title: 'All integrations unhealthy',
        description: `${integrationsCount} integration${integrationsCount !== 1 ? 's' : ''} configured but none healthy`,
        actionLabel: 'Fix integrations',
        actionHref: `/dashboard/integrations?tenant=${client.slug}`,
      })
    } else if (integrationsCount > 0 && integrationsHealthy < integrationsCount) {
      const unhealthy = integrationsCount - integrationsHealthy
      alerts.push({
        id: `integrations-partial-${client.id}`,
        severity: 'warning',
        clientId: client.id,
        clientName: client.name,
        clientSlug: client.slug,
        title: `${unhealthy} unhealthy integration${unhealthy !== 1 ? 's' : ''}`,
        description: `${integrationsHealthy}/${integrationsCount} integrations healthy`,
        actionLabel: 'Review',
        actionHref: `/dashboard/integrations?tenant=${client.slug}`,
      })
    }

    // ── 4. Zero activity (no calls in 30 days) ─────────────────────────
    if (callStats.totalCalls === 0 && overview.onboardingComplete) {
      alerts.push({
        id: `no-activity-${client.id}`,
        severity: 'warning',
        clientId: client.id,
        clientName: client.name,
        clientSlug: client.slug,
        title: 'No recent activity',
        description: 'No calls recorded in the last 30 days despite completed onboarding',
        actionLabel: 'View dashboard',
        actionHref: `/dashboard?tenant=${client.slug}`,
      })
    }

    // ── 5. Zero bookings despite activity ──────────────────────────────
    if (callStats.totalCalls >= 10 && callStats.bookedCalls === 0) {
      alerts.push({
        id: `no-bookings-${client.id}`,
        severity: 'warning',
        clientId: client.id,
        clientName: client.name,
        clientSlug: client.slug,
        title: 'No bookings from calls',
        description: `${callStats.totalCalls} calls handled but zero bookings`,
        actionLabel: 'View reports',
        actionHref: `/dashboard/reports?tenant=${client.slug}`,
      })
    }

    // ── 6. Onboarding stale ────────────────────────────────────────────
    if (!overview.onboardingComplete && overview.hasOnboarding) {
      alerts.push({
        id: `onboarding-stale-${client.id}`,
        severity: 'info',
        clientId: client.id,
        clientName: client.name,
        clientSlug: client.slug,
        title: 'Onboarding incomplete',
        description: 'Client has started but not completed onboarding',
        actionLabel: 'View setup',
        actionHref: `/dashboard?tenant=${client.slug}`,
      })
    }

    // ── 7. No integrations configured ──────────────────────────────────
    if (integrationsCount === 0 && overview.onboardingComplete) {
      alerts.push({
        id: `no-integrations-${client.id}`,
        severity: 'info',
        clientId: client.id,
        clientName: client.name,
        clientSlug: client.slug,
        title: 'No integrations',
        description: 'Client has no CRM integrations configured',
        actionLabel: 'Configure',
        actionHref: `/dashboard/integrations?tenant=${client.slug}`,
      })
    }
  }

  // Sort: critical first, then warning, then info; within same severity, by client name
  const severityOrder: Record<OpsAlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  }

  alerts.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity]
    if (sevDiff !== 0) return sevDiff
    return a.clientName.localeCompare(b.clientName)
  })

  return alerts
}
