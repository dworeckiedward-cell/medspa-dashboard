import { redirect } from 'next/navigation'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { DashboardLayout } from '@/components/dashboard/layout'
import { LeadsTable } from '@/components/dashboard/leads-table'
import { TenantNotFound } from '@/components/shared/tenant-not-found'
import { getMockContacts, getMockFollowUpTasks } from '@/lib/dashboard/mock-data'
import type { BookedNotification } from '@/components/dashboard/notification-bell'

// Always render fresh — lead state must not be stale
export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const { tenant, accessMode, needsTenantSelection } = await resolveTenantAccess()

  if (!tenant) {
    if (needsTenantSelection) redirect('/dashboard/select-tenant')
    return (
      <TenantNotFound
        reason={accessMode === 'authenticated' ? 'no_workspace' : 'not_found'}
      />
    )
  }

  // TODO: Replace with real Supabase queries once contact/lead tables exist
  const contacts = getMockContacts(tenant.id)
  const tasks = getMockFollowUpTasks(tenant.id)

  const followUpCount = tasks.filter((t) => t.status === 'open' || t.status === 'in_progress').length

  // For notification bell — derive booked contacts as notifications
  const bookedNotifications: BookedNotification[] = contacts
    .filter((c) => c.status === 'booked' && c.lastCallAt)
    .sort((a, b) => (b.lastCallAt ?? '').localeCompare(a.lastCallAt ?? ''))
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      title: `${c.fullName} booked`,
      created_at: c.lastCallAt!,
      caller_name: c.fullName,
      potential_revenue: c.appointments?.[0]?.valueEstimate ?? null,
    }))

  return (
    <DashboardLayout
      tenant={tenant}
      followUpCount={followUpCount}
      bookedNotificationCount={bookedNotifications.length}
      bookedNotifications={bookedNotifications}
    >
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 animate-fade-in">
        <LeadsTable contacts={contacts} />
      </div>
    </DashboardLayout>
  )
}
