/**
 * /api/alerts — GET tenant-scoped alerts.
 *
 * Tenant-scoped via resolveTenantAccess().
 * Returns persistent alerts if table exists, otherwise derives from data.
 */

import { NextResponse } from 'next/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { listTenantAlerts } from '@/lib/alerts/query'
import { deriveAlertCandidates, type AlertCandidate } from '@/lib/alerts/derive'
import { getCallLogs } from '@/lib/dashboard/metrics'
import { listClientIntegrations } from '@/lib/integrations/crm/config-query'
import { listCrmDeliveryLogs } from '@/lib/integrations/crm/query'
import { listActiveClientServices } from '@/lib/dashboard/services-query'
import { getTenantUsageSummary } from '@/lib/billing/usage-query'
import { getConversationsKpiSummary } from '@/lib/chat/query'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { TenantAlert, AlertSeverity, AlertStatus, AlertConfidence } from '@/lib/alerts/types'

export async function GET() {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  // Try persistent alerts first
  const persistedAlerts = await listTenantAlerts(tenant.id, {
    status: ['open', 'acknowledged'],
  })

  if (persistedAlerts.length > 0) {
    return NextResponse.json({ alerts: persistedAlerts, source: 'persisted' })
  }

  // Fallback: derive alerts from live data
  const [{ data: callLogs }, integrations, deliveryLogs, services, usageSummary, chatKpi] = await Promise.all([
    getCallLogs(tenant.id, { limit: 100 }),
    listClientIntegrations(tenant.id),
    listCrmDeliveryLogs(tenant.id, undefined, 50),
    listActiveClientServices(tenant.id),
    getTenantUsageSummary(tenant.id),
    getConversationsKpiSummary(tenant.id),
  ])

  // Get last chat activity timestamp
  let lastChatActivityAt: string | null = null
  try {
    const supabase = createSupabaseServerClient()
    const { data: latestConv } = await supabase
      .from('chat_conversations')
      .select('last_message_at')
      .eq('client_id', tenant.id)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    lastChatActivityAt = (latestConv?.last_message_at as string) ?? null
  } catch {
    // Chat tables may not exist yet
  }

  const candidates = deriveAlertCandidates({
    clientId: tenant.id,
    callLogs,
    deliveryLogs,
    integrations,
    usageSummary,
    servicesCount: services.length,
    chatKpi,
    lastChatActivityAt,
  })

  // Map candidates to TenantAlert shape for consistent API response
  const now = new Date().toISOString()
  const alerts: TenantAlert[] = candidates.map((c, i) => ({
    id: `derived-${i}`,
    clientId: c.clientId,
    ruleKey: c.ruleKey,
    source: c.source,
    severity: c.severity as AlertSeverity,
    status: 'open' as AlertStatus,
    confidence: c.confidence as AlertConfidence,
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
  }))

  return NextResponse.json({ alerts, source: 'derived' })
}
