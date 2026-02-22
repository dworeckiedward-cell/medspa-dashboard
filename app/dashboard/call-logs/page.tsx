import { redirect } from 'next/navigation'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getCallLogs } from '@/lib/dashboard/metrics'
import { DashboardLayout } from '@/components/dashboard/layout'
import { CallLogsTable } from '@/components/dashboard/call-logs-table'
import { TenantNotFound } from '@/components/shared/tenant-not-found'
import type { BookedNotification } from '@/components/dashboard/notification-bell'

// Always render fresh — logs must not be stale
export const dynamic = 'force-dynamic'

export default async function CallLogsPage() {
  const { tenant, accessMode, needsTenantSelection } = await resolveTenantAccess()

  if (!tenant) {
    if (needsTenantSelection) redirect('/dashboard/select-tenant')
    return (
      <TenantNotFound
        reason={accessMode === 'authenticated' ? 'no_workspace' : 'not_found'}
      />
    )
  }

  // Fetch more logs here (200) — this page is the dedicated call log view
  const { data: callLogs, count: totalCount } = await getCallLogs(tenant.id, { limit: 200 })

  const followUpCount = callLogs.filter((c) => c.human_followup_needed).length
  const bookedNotificationCount = callLogs.filter((c) => c.is_booked).length

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

  return (
    <DashboardLayout
      tenant={tenant}
      followUpCount={followUpCount}
      bookedNotificationCount={bookedNotificationCount}
      bookedNotifications={bookedNotifications}
    >
      <div className="p-4 sm:p-6 space-y-4 animate-fade-in">
        {/* Page heading */}
        <div>
          <h1 className="text-xl font-semibold text-[var(--brand-text)]">Call Logs</h1>
          <p className="text-sm text-[var(--brand-muted)] mt-1">
            All calls handled by your AI receptionist · {totalCount} total
          </p>
        </div>

        <CallLogsTable initialData={callLogs} totalCount={totalCount} clientId={tenant.id} />
      </div>
    </DashboardLayout>
  )
}
