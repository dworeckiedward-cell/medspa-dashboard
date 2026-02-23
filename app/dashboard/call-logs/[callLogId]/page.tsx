import { redirect, notFound } from 'next/navigation'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getCallLogById } from '@/lib/dashboard/metrics'
import { DashboardLayout } from '@/components/dashboard/layout'
import { TenantNotFound } from '@/components/shared/tenant-not-found'
import { CallDetailView } from '@/components/dashboard/call-detail-view'

export const dynamic = 'force-dynamic'

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ callLogId: string }>
}) {
  const { tenant, accessMode, needsTenantSelection } = await resolveTenantAccess()

  if (!tenant) {
    if (needsTenantSelection) redirect('/dashboard/select-tenant')
    return (
      <TenantNotFound
        reason={accessMode === 'authenticated' ? 'no_workspace' : 'not_found'}
      />
    )
  }

  const { callLogId } = await params

  const callLog = await getCallLogById(tenant.id, callLogId)

  if (!callLog) {
    notFound()
  }

  return (
    <DashboardLayout
      tenant={tenant}
      followUpCount={0}
      bookedNotificationCount={0}
      bookedNotifications={[]}
    >
      <CallDetailView callLog={callLog} />
    </DashboardLayout>
  )
}
