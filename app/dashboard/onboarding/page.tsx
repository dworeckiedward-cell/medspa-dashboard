import { redirect } from 'next/navigation'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { DashboardLayout } from '@/components/dashboard/layout'
import { OnboardingWizard } from '@/components/dashboard/onboarding-wizard'
import { TenantNotFound } from '@/components/shared/tenant-not-found'
import type { BookedNotification } from '@/components/dashboard/notification-bell'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const { tenant, accessMode, needsTenantSelection } = await resolveTenantAccess()

  if (!tenant) {
    if (needsTenantSelection) redirect('/dashboard/select-tenant')
    return (
      <TenantNotFound
        reason={accessMode === 'authenticated' ? 'no_workspace' : 'not_found'}
      />
    )
  }

  const emptyNotifications: BookedNotification[] = []

  return (
    <DashboardLayout
      tenant={tenant}
      followUpCount={0}
      bookedNotificationCount={0}
      bookedNotifications={emptyNotifications}
    >
      <div className="p-6 max-w-2xl mx-auto animate-fade-in">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[var(--brand-text)]">Setup Wizard</h1>
          <p className="text-sm text-[var(--brand-muted)] mt-1">
            Complete these steps to get the most out of your AI receptionist dashboard.
          </p>
        </div>
        <OnboardingWizard
          tenantId={tenant.id}
          tenantSlug={tenant.slug}
          tenantName={tenant.name}
        />
      </div>
    </DashboardLayout>
  )
}
