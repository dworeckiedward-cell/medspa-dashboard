/**
 * Integration health derivation helpers.
 *
 * Computes health badges and summary stats from integration config
 * and recent delivery log data. All functions are pure — no DB access.
 */

import type {
  ClientIntegration,
  IntegrationHealthLevel,
  IntegrationHealthSummary,
  CrmDeliveryLog,
} from '@/lib/types/domain'

// ── Single-integration health ────────────────────────────────────────────────

/**
 * Derive the health level for a single integration based on its status
 * and recent delivery history.
 */
export function deriveIntegrationHealth(
  integration: ClientIntegration,
  recentLogs?: CrmDeliveryLog[],
): IntegrationHealthLevel {
  // Not configured / disconnected
  if (integration.status === 'disconnected' || !integration.isEnabled) {
    return 'not_configured'
  }

  // Explicit error status
  if (integration.status === 'error') {
    return 'failing'
  }

  // If we have recent logs, use failure rate
  if (recentLogs && recentLogs.length > 0) {
    const providerLogs = recentLogs.filter(
      (l) => l.integrationProvider === integration.provider,
    )
    if (providerLogs.length > 0) {
      const failCount = providerLogs.filter((l) => !l.success).length
      const failRate = failCount / providerLogs.length
      if (failRate > 0.5) return 'failing'
      if (failRate > 0.1) return 'attention'
    }
  }

  // Check for recent errors without recent successes
  if (integration.lastErrorAt && !integration.lastSuccessAt) {
    return 'failing'
  }

  if (
    integration.lastErrorAt &&
    integration.lastSuccessAt &&
    integration.lastErrorAt > integration.lastSuccessAt
  ) {
    return 'attention'
  }

  // Connected + no issues
  if (integration.status === 'connected') {
    return 'healthy'
  }

  // Testing status
  if (integration.status === 'testing') {
    return 'attention'
  }

  return 'not_configured'
}

// ── Aggregate health summary ─────────────────────────────────────────────────

/**
 * Compute a summary of integration health across all integrations
 * and recent delivery logs for a tenant.
 *
 * @param integrations All integrations for the tenant
 * @param recentLogs   Delivery logs from the last 24h
 */
export function computeHealthSummary(
  integrations: ClientIntegration[],
  recentLogs: CrmDeliveryLog[],
): IntegrationHealthSummary {
  const totalIntegrations = integrations.length
  const activeIntegrations = integrations.filter(
    (i) => i.isEnabled && (i.status === 'connected' || i.status === 'testing'),
  ).length

  const failingIntegrations = integrations.filter((i) => {
    const health = deriveIntegrationHealth(i, recentLogs)
    return health === 'failing'
  }).length

  const deliveries24h = recentLogs.length
  const failures24h = recentLogs.filter((l) => !l.success).length
  const failureRate24h =
    deliveries24h > 0 ? Math.round((failures24h / deliveries24h) * 100) : null

  return {
    totalIntegrations,
    activeIntegrations,
    failingIntegrations,
    deliveries24h,
    failures24h,
    failureRate24h,
  }
}

// ── Health badge config ──────────────────────────────────────────────────────

export interface HealthBadgeConfig {
  label: string
  variant: 'success' | 'warning' | 'destructive' | 'muted'
  dotColor: string
}

export function getHealthBadgeConfig(level: IntegrationHealthLevel): HealthBadgeConfig {
  switch (level) {
    case 'healthy':
      return { label: 'Healthy', variant: 'success', dotColor: 'bg-emerald-500' }
    case 'attention':
      return { label: 'Attention', variant: 'warning', dotColor: 'bg-amber-500' }
    case 'failing':
      return { label: 'Failing', variant: 'destructive', dotColor: 'bg-rose-500' }
    case 'not_configured':
      return { label: 'Not configured', variant: 'muted', dotColor: 'bg-gray-400' }
  }
}
