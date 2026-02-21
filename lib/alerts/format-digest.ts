/**
 * Alert Digest Formatter — prepares text summaries for notifications.
 *
 * Generates a human-readable digest of open alerts for a tenant or
 * across all tenants (ops). No sending — just text formatting.
 *
 * Future use: email/Slack notification payloads.
 */

import type { TenantAlert, AlertWithClient, AlertsSummary } from './types'

// ── Tenant digest ────────────────────────────────────────────────────────────

/**
 * Format a tenant-scoped alert digest (for client notifications).
 */
export function formatTenantDigest(
  tenantName: string,
  alerts: TenantAlert[],
): string {
  if (alerts.length === 0) {
    return [
      `${tenantName} — Alert Digest`,
      '',
      'No active alerts. Your AI reception system is operating within expected ranges.',
    ].join('\n')
  }

  const critical = alerts.filter((a) => a.severity === 'critical')
  const warning = alerts.filter((a) => a.severity === 'warning')
  const info = alerts.filter((a) => a.severity === 'info')

  const lines: string[] = [
    `${tenantName} — Alert Digest`,
    `${alerts.length} active alert${alerts.length !== 1 ? 's' : ''}`,
    '',
  ]

  if (critical.length > 0) {
    lines.push(`🔴 CRITICAL (${critical.length})`)
    for (const a of critical) {
      lines.push(`  • ${a.title}: ${a.description}`)
      lines.push(`    → ${a.recommendedAction}`)
    }
    lines.push('')
  }

  if (warning.length > 0) {
    lines.push(`🟡 WARNING (${warning.length})`)
    for (const a of warning) {
      lines.push(`  • ${a.title}: ${a.description}`)
    }
    lines.push('')
  }

  if (info.length > 0) {
    lines.push(`🔵 INFO (${info.length})`)
    for (const a of info) {
      lines.push(`  • ${a.title}: ${a.description}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ── Ops digest (cross-tenant) ────────────────────────────────────────────────

/**
 * Format a cross-tenant alert digest (for operator notifications).
 */
export function formatOpsDigest(
  summary: AlertsSummary,
  alerts: AlertWithClient[],
): string {
  const lines: string[] = [
    'Servify Operations — Alert Digest',
    '',
    `Open: ${summary.totalOpen} | Critical: ${summary.critical} | Warning: ${summary.warning} | Info: ${summary.info}`,
    `Affected tenants: ${summary.affectedTenants} | Unresolved >24h: ${summary.unresolvedOver24h}`,
    '',
  ]

  if (alerts.length === 0) {
    lines.push('All systems operating within expected ranges.')
    return lines.join('\n')
  }

  // Group by tenant
  const byTenant = new Map<string, AlertWithClient[]>()
  for (const a of alerts) {
    const existing = byTenant.get(a.clientName) ?? []
    existing.push(a)
    byTenant.set(a.clientName, existing)
  }

  const entries = Array.from(byTenant.entries())
  for (const [tenantName, tenantAlerts] of entries) {
    lines.push(`── ${tenantName} (${tenantAlerts.length} alert${tenantAlerts.length !== 1 ? 's' : ''})`)
    for (const a of tenantAlerts) {
      const sev = a.severity === 'critical' ? '🔴' : a.severity === 'warning' ? '🟡' : '🔵'
      lines.push(`  ${sev} ${a.title}: ${a.description}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
