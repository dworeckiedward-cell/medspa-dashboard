import { redirect } from 'next/navigation'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { logOperatorAction } from '@/lib/ops/audit'
import { getAllClientOverviews, getAllRecentDeliveryLogs } from '@/lib/ops/query'
import { listAllAlerts, getAlertsSummary } from '@/lib/alerts/query'
import { deriveAlertCandidates } from '@/lib/alerts/derive'
import { OpsAlertsConsole } from '@/components/ops/ops-alerts-console'
import type { AlertWithClient, AlertsSummary } from '@/lib/alerts/types'

export const dynamic = 'force-dynamic'

export default async function OpsAlertsPage() {
  // ── Access guard ─────────────────────────────────────────────────────────
  const access = await resolveOperatorAccess()
  if (!access.authorized) {
    redirect('/login')
  }

  // ── Audit log ──────────────────────────────────────────────────────────
  await logOperatorAction({
    operatorId: access.userId ?? 'unknown',
    operatorEmail: access.email,
    action: 'alerts_console_viewed',
  })

  // ── Try persistent alerts first ─────────────────────────────────────────
  const [persistedAlerts, persistedSummary] = await Promise.all([
    listAllAlerts({ status: ['open', 'acknowledged'] }),
    getAlertsSummary(),
  ])

  let alerts: AlertWithClient[] = persistedAlerts
  let summary: AlertsSummary = persistedSummary

  // ── Fallback: derive alerts if no persistent data ──────────────────────
  if (persistedAlerts.length === 0 && persistedSummary.totalOpen === 0) {
    const [overviews, deliveryLogs] = await Promise.all([
      getAllClientOverviews(),
      getAllRecentDeliveryLogs(24, 200),
    ])

    // Group delivery logs by client
    const logsByClient = new Map<string, typeof deliveryLogs>()
    for (const log of deliveryLogs) {
      const existing = logsByClient.get(log.client_id) ?? []
      existing.push(log)
      logsByClient.set(log.client_id, existing)
    }

    // Derive alerts per client
    const allCandidates: AlertWithClient[] = []
    const now = new Date().toISOString()

    for (const overview of overviews) {
      const clientLogs = logsByClient.get(overview.client.id) ?? []
      const candidates = deriveAlertCandidates({
        clientId: overview.client.id,
        callLogs: [], // call logs not fetched cross-tenant for perf
        deliveryLogs: clientLogs.map((l) => ({
          id: l.id,
          tenantId: l.client_id,
          integrationProvider: l.integration_provider,
          eventType: l.event_type,
          eventId: l.event_id,
          payload: l.payload as Record<string, unknown>,
          requestUrl: l.request_url,
          requestHeadersMasked: l.request_headers_masked as Record<string, unknown> | null,
          httpMethod: l.http_method,
          responseStatus: l.response_status,
          responseBodyPreview: l.response_body_preview,
          latencyMs: l.latency_ms,
          success: l.success,
          errorCode: (l.error_code ?? null) as import('@/lib/types/domain').CrmDeliveryErrorCode | null,
          errorMessage: l.error_message,
          createdAt: l.created_at,
        })),
        integrations: [], // integration detail not available cross-tenant
        usageSummary: null,
        servicesCount: 0,
      })

      for (const c of candidates) {
        allCandidates.push({
          id: `derived-${overview.client.id}-${c.ruleKey}`,
          clientId: c.clientId,
          ruleKey: c.ruleKey,
          source: c.source,
          severity: c.severity,
          status: 'open',
          confidence: c.confidence,
          title: c.title,
          description: c.description,
          recommendedAction: c.recommendedAction,
          evidence: c.evidence,
          fingerprint: c.fingerprint,
          firstDetectedAt: now,
          lastDetectedAt: now,
          acknowledgedAt: null,
          acknowledgedBy: null,
          resolvedAt: null,
          resolvedBy: null,
          mutedUntil: null,
          createdAt: now,
          updatedAt: now,
          clientName: overview.client.name,
          clientSlug: overview.client.slug,
        })
      }
    }

    alerts = allCandidates
    const clientIds = new Set(allCandidates.map((a) => a.clientId))

    summary = {
      totalOpen: allCandidates.filter((a) => a.status === 'open').length,
      critical: allCandidates.filter((a) => a.severity === 'critical').length,
      warning: allCandidates.filter((a) => a.severity === 'warning').length,
      info: allCandidates.filter((a) => a.severity === 'info').length,
      affectedTenants: clientIds.size,
      unresolvedOver24h: 0,
      acknowledgedPending: 0,
      resolvedToday: 0,
    }
  }

  return (
    <OpsAlertsConsole
      alerts={alerts}
      summary={summary}
      operatorEmail={access.email}
    />
  )
}
