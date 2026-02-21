import { redirect } from 'next/navigation'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getDashboardMetrics, getCallLogs } from '@/lib/dashboard/metrics'
import { DashboardLayout } from '@/components/dashboard/layout'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import { RoiChart } from '@/components/dashboard/roi-chart'
import { CallLogsTable } from '@/components/dashboard/call-logs-table'
import { TenantInfoCard } from '@/components/dashboard/tenant-info-card'
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

  // Parallel data fetch — metrics and call logs load simultaneously
  // SECURITY: client_id sourced from trusted tenant config, not URL
  const [metrics, { data: callLogs, count: totalCount }] = await Promise.all([
    getDashboardMetrics(tenant.id),
    getCallLogs(tenant.id, { limit: 100 }),
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

  return (
    <DashboardLayout
      tenant={tenant}
      followUpCount={followUpCount}
      bookedNotificationCount={bookedNotificationCount}
      bookedNotifications={bookedNotifications}
    >
      <div className="space-y-6 p-6 animate-fade-in">
        {/* Row 1: KPI cards */}
        <KpiCards metrics={metrics} currency={tenant.currency} />

        {/* Row 2: Revenue chart + Integration status */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <RoiChart data={metrics.chartSeries} currency={tenant.currency} />
          </div>
          <div>
            <TenantInfoCard tenant={tenant} />
          </div>
        </div>

        {/* Row 3: Call logs table */}
        <CallLogsTable
          initialData={callLogs}
          totalCount={totalCount}
          clientId={tenant.id}
        />
      </div>
    </DashboardLayout>
  )
}
