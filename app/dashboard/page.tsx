import { redirect } from 'next/navigation'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getDashboardMetrics, getCallLogs } from '@/lib/dashboard/metrics'
import { listActiveClientServices } from '@/lib/dashboard/services-query'
import { listClientIntegrations } from '@/lib/integrations/crm/config-query'
import { computeHealthSummary } from '@/lib/integrations/crm/health'
import { listCrmDeliveryLogs } from '@/lib/integrations/crm/query'
import { getMockBillingSummary } from '@/lib/dashboard/billing'
import { deriveExceptions } from '@/lib/dashboard/exceptions'
import { deriveRecommendedActions } from '@/lib/dashboard/recommended-actions'
import { listServiceAliases } from '@/lib/dashboard/service-alias-query'
import { DashboardLayout } from '@/components/dashboard/layout'
import { DashboardTabs } from '@/components/dashboard/dashboard-tabs'
import { TenantNotFound } from '@/components/shared/tenant-not-found'
import type { BookedNotification } from '@/components/dashboard/notification-bell'

// Always render fresh — tenant data and call logs must not be stale
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const { tenant, accessMode, needsTenantSelection } = await resolveTenantAccess()

  if (!tenant) {
    if (needsTenantSelection) redirect('/dashboard/select-tenant')
    return (
      <TenantNotFound
        reason={accessMode === 'authenticated' ? 'no_workspace' : 'not_found'}
      />
    )
  }

  // Parallel data fetch — metrics, call logs, services, integrations, billing
  // SECURITY: client_id sourced from trusted tenant config, not URL
  const [
    metrics,
    { data: callLogs, count: totalCount },
    activeServices,
    integrations,
    deliveryLogs,
    billing,
  ] = await Promise.all([
    getDashboardMetrics(tenant.id),
    getCallLogs(tenant.id, { limit: 100 }),
    listActiveClientServices(tenant.id),
    listClientIntegrations(tenant.id),
    listCrmDeliveryLogs(tenant.id, undefined, 50),
    Promise.resolve(getMockBillingSummary(tenant.id)),
  ])

  const followUpCount = callLogs.filter((c) => c.human_followup_needed).length

  // Most recent booked appointments for the notification bell (desc by time, max 5)
  const bookedNotifications: BookedNotification[] = callLogs
    .filter((c) => c.is_booked)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      title: c.semantic_title ?? 'Appointment booked',
      created_at: c.created_at,
      caller_name: c.caller_name,
      potential_revenue: c.potential_revenue > 0 ? c.potential_revenue : null,
    }))

  const bookedNotificationCount = callLogs.filter((c) => c.is_booked).length

  // Integration health for system status card
  const healthSummary = computeHealthSummary(integrations, deliveryLogs)
  const failedDeliveries = deliveryLogs.filter((l) => !l.success).length

  // Alias count (for recommended actions — graceful if migration not applied)
  const aliases = await listServiceAliases(tenant.id)

  // Operational exceptions + recommended actions (pure computation, no IO)
  const exceptions = deriveExceptions({
    callLogs,
    deliveryLogs,
    integrations,
    servicesCount: activeServices.length,
  })

  const recommendedActions = deriveRecommendedActions({
    callLogs,
    services: activeServices,
    integrations,
    deliveryLogs,
    aliasCount: aliases.length,
  })

  return (
    <DashboardLayout
      tenant={tenant}
      followUpCount={followUpCount}
      bookedNotificationCount={bookedNotificationCount}
      bookedNotifications={bookedNotifications}
    >
      <DashboardTabs
        metrics={metrics}
        callLogs={callLogs}
        totalCount={totalCount}
        currency={tenant.currency}
        clientId={tenant.id}
        tenant={tenant}
        services={activeServices}
        failedDeliveries={failedDeliveries}
        integrationsCount={integrations.length}
        integrationsHealthy={healthSummary.activeIntegrations}
        billing={billing}
        exceptions={exceptions}
        recommendedActions={recommendedActions}
      />
    </DashboardLayout>
  )
}
