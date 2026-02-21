import { redirect } from 'next/navigation'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getCallLogs } from '@/lib/dashboard/metrics'
import { listActiveClientServices } from '@/lib/dashboard/services-query'
import { DashboardLayout } from '@/components/dashboard/layout'
import { TenantNotFound } from '@/components/shared/tenant-not-found'
import { RoiSummaryCard } from '@/components/dashboard/roi-summary-card'
import { BookingProofTable } from '@/components/dashboard/booking-proof-table'
import { MissedCallRecoveryCard } from '@/components/dashboard/missed-call-recovery-card'
import { ExecutiveReportCard } from '@/components/dashboard/executive-report-card'
import { ServicePerformanceCard } from '@/components/dashboard/service-performance-card'
import { DataQualityCard } from '@/components/dashboard/data-quality-card'
import { ReportsPageHeader } from '@/components/dashboard/reports-page-header'
import type { BookedNotification } from '@/components/dashboard/notification-bell'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const { tenant, accessMode, needsTenantSelection } = await resolveTenantAccess()

  if (!tenant) {
    if (needsTenantSelection) redirect('/dashboard/select-tenant')
    return (
      <TenantNotFound
        reason={accessMode === 'authenticated' ? 'no_workspace' : 'not_found'}
      />
    )
  }

  // Fetch call logs (up to 500 for deeper analysis) + services in parallel
  const [{ data: callLogs }, activeServices] = await Promise.all([
    getCallLogs(tenant.id, { limit: 500 }),
    listActiveClientServices(tenant.id),
  ])

  const bookedNotifications: BookedNotification[] = []

  return (
    <DashboardLayout
      tenant={tenant}
      followUpCount={0}
      bookedNotificationCount={0}
      bookedNotifications={bookedNotifications}
    >
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Page header with presentation toggle */}
        <ReportsPageHeader />

        {/* ROI summary */}
        <RoiSummaryCard
          callLogs={callLogs}
          services={activeServices}
          currency={tenant.currency}
        />

        {/* Two-column layout for proof + recovery */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MissedCallRecoveryCard
            callLogs={callLogs}
            currency={tenant.currency}
          />
          <ExecutiveReportCard
            callLogs={callLogs}
            services={activeServices}
            currency={tenant.currency}
            tenantName={tenant.name}
          />
        </div>

        {/* Per-service performance breakdown */}
        <ServicePerformanceCard
          callLogs={callLogs}
          services={activeServices}
          currency={tenant.currency}
        />

        {/* Data quality / trust center — makes reporting defensible */}
        <DataQualityCard
          callLogs={callLogs}
          services={activeServices}
        />

        {/* Booking proof table — full width */}
        <BookingProofTable
          callLogs={callLogs}
          services={activeServices}
          currency={tenant.currency}
        />
      </div>
    </DashboardLayout>
  )
}
