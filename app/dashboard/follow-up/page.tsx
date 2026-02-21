import { redirect } from 'next/navigation'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { DashboardLayout } from '@/components/dashboard/layout'
import { FollowUpQueue } from '@/components/dashboard/follow-up-queue'
import { TenantNotFound } from '@/components/shared/tenant-not-found'
import { getMockFollowUpTasks } from '@/lib/dashboard/mock-data'
import type { BookedNotification } from '@/components/dashboard/notification-bell'

export const dynamic = 'force-dynamic'

export default async function FollowUpPage() {
  const { tenant, accessMode, needsTenantSelection } = await resolveTenantAccess()

  if (!tenant) {
    if (needsTenantSelection) redirect('/dashboard/select-tenant')
    return (
      <TenantNotFound
        reason={accessMode === 'authenticated' ? 'no_workspace' : 'not_found'}
      />
    )
  }

  // TODO: Replace with real Supabase queries once follow_up_tasks table exists
  const tasks = getMockFollowUpTasks(tenant.id)

  const openTaskCount = tasks.filter((t) => t.status === 'open' || t.status === 'in_progress').length
  const bookedNotifications: BookedNotification[] = []

  return (
    <DashboardLayout
      tenant={tenant}
      followUpCount={openTaskCount}
      bookedNotificationCount={0}
      bookedNotifications={bookedNotifications}
    >
      <div className="p-6 space-y-5 animate-fade-in">
        <FollowUpQueue tasks={tasks} />
      </div>
    </DashboardLayout>
  )
}
