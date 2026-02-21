import { redirect } from 'next/navigation'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { DashboardLayout } from '@/components/dashboard/layout'
import { IntegrationsCenter } from '@/components/dashboard/integrations-center'
import { TenantNotFound } from '@/components/shared/tenant-not-found'
import { getMockIntegrations } from '@/lib/dashboard/mock-data'
import { listCrmDeliveryLogs } from '@/lib/integrations/crm/query'
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

  // Real delivery logs from DB — newest first, up to 100 rows
  const deliveryLogs = await listCrmDeliveryLogs(tenant.id, undefined, 100)

  // Integration config — still mock until an integrations table exists
  const integrations = getMockIntegrations(tenant.id)

  const bookedNotifications: BookedNotification[] = []

  return (
    <DashboardLayout
      tenant={tenant}
      followUpCount={0}
      bookedNotificationCount={0}
      bookedNotifications={bookedNotifications}
    >
      <div className="p-6 space-y-5 animate-fade-in">
        <IntegrationsCenter
          integrations={integrations}
          deliveryLogs={deliveryLogs}
          tenant={tenant}
        />
      </div>
    </DashboardLayout>
  )
}
