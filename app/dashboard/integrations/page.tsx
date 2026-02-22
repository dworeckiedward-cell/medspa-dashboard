import { redirect } from 'next/navigation'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { DashboardLayout } from '@/components/dashboard/layout'
import { IntegrationsCenter } from '@/components/dashboard/integrations-center'
import { TenantNotFound } from '@/components/shared/tenant-not-found'
import { listCrmDeliveryLogs } from '@/lib/integrations/crm/query'
import { listClientIntegrations } from '@/lib/integrations/crm/config-query'
import { computeHealthSummary } from '@/lib/integrations/crm/health'
import type { BookedNotification } from '@/components/dashboard/notification-bell'

export const dynamic = 'force-dynamic'

export default async function IntegrationsPage() {
  const { tenant, accessMode, needsTenantSelection } = await resolveTenantAccess()

  if (!tenant) {
    if (needsTenantSelection) redirect('/dashboard/select-tenant')
    return (
      <TenantNotFound
        reason={accessMode === 'authenticated' ? 'no_workspace' : 'not_found'}
      />
    )
  }

  // Fetch integrations + delivery logs in parallel
  const [integrations, deliveryLogs] = await Promise.all([
    listClientIntegrations(tenant.id),
    listCrmDeliveryLogs(tenant.id, undefined, 100),
  ])

  const healthSummary = computeHealthSummary(integrations, deliveryLogs)

  const bookedNotifications: BookedNotification[] = []

  return (
    <DashboardLayout
      tenant={tenant}
      followUpCount={0}
      bookedNotificationCount={0}
      bookedNotifications={bookedNotifications}
    >
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 animate-fade-in">
        <IntegrationsCenter
          integrations={integrations}
          deliveryLogs={deliveryLogs}
          healthSummary={healthSummary}
          tenant={tenant}
        />
      </div>
    </DashboardLayout>
  )
}
