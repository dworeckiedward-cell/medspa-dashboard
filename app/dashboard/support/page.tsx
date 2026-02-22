import { redirect } from 'next/navigation'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { listTenantRequests } from '@/lib/support/query'
import { DashboardLayout } from '@/components/dashboard/layout'
import { TenantNotFound } from '@/components/shared/tenant-not-found'
import { SupportPageClient } from '@/components/support/support-page-client'

export const dynamic = 'force-dynamic'

export default async function SupportPage() {
  const { tenant, accessMode, needsTenantSelection } = await resolveTenantAccess()

  if (!tenant) {
    if (needsTenantSelection) redirect('/dashboard/select-tenant')
    return (
      <TenantNotFound
        reason={accessMode === 'authenticated' ? 'no_workspace' : 'not_found'}
      />
    )
  }

  const requests = await listTenantRequests(tenant.id, { limit: 50 })

  return (
    <DashboardLayout tenant={tenant} followUpCount={0} bookedNotificationCount={0} bookedNotifications={[]}>
      <div className="p-4 sm:p-6 space-y-4">
        {/* Page heading */}
        <div>
          <h1 className="text-lg font-semibold text-[var(--brand-text)] tracking-tight">
            Support
          </h1>
          <p className="text-xs text-[var(--brand-muted)] mt-0.5">
            Submit and track support requests
          </p>
        </div>

        <SupportPageClient requests={requests} tenantSlug={tenant.slug} />
      </div>
    </DashboardLayout>
  )
}
