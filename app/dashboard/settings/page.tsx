import { redirect } from 'next/navigation'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { DashboardLayout } from '@/components/dashboard/layout'
import { TenantNotFound } from '@/components/shared/tenant-not-found'
import {
  AppearanceSection,
  NotificationSection,
  AdvancedSection,
  CopyableValue,
} from '@/components/dashboard/settings-sections'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const { tenant, accessMode, needsTenantSelection } = await resolveTenantAccess()

  if (!tenant) {
    if (needsTenantSelection) redirect('/dashboard/select-tenant')
    return (
      <TenantNotFound
        reason={accessMode === 'authenticated' ? 'no_workspace' : 'not_found'}
      />
    )
  }

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'yourdomain.com'
  const domain = tenant.custom_domain || `${tenant.subdomain || tenant.slug}.${appDomain}`

  return (
    <DashboardLayout tenant={tenant} followUpCount={0} bookedNotificationCount={0} bookedNotifications={[]}>
      <div className="max-w-2xl mx-auto p-6 pb-16">
        {/* Sticky page heading */}
        <div className="sticky top-14 z-10 -mx-6 px-6 pt-5 pb-4 mb-6 bg-[var(--brand-bg)]/95 backdrop-blur border-b border-[var(--brand-border)] transition-colors duration-200">
          <h1 className="text-xl font-semibold text-[var(--brand-text)]">Settings</h1>
          <p className="text-sm text-[var(--brand-muted)] mt-1">
            Manage your workspace appearance and preferences.
          </p>
        </div>

        <div className="space-y-8">
          {/* Appearance */}
          <AppearanceSection />

          {/* Notifications */}
          <NotificationSection />

          {/* Workspace — read-only tenant config */}
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--brand-text)]">Workspace</h2>
              <p className="text-xs text-[var(--brand-muted)] mt-0.5">
                Tenant configuration managed from the Servify platform. Contact support to make changes.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 space-y-3">
              {/* Static rows */}
              {(
                [
                  { label: 'Name', value: tenant.name },
                  { label: 'Timezone', value: tenant.timezone },
                  { label: 'Currency', value: tenant.currency },
                ] as const
              ).map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4 border-b border-[var(--brand-border)] pb-3"
                >
                  <span className="text-xs text-[var(--brand-muted)] shrink-0">{row.label}</span>
                  <span className="text-xs font-medium text-[var(--brand-text)] truncate text-right">
                    {row.value}
                  </span>
                </div>
              ))}

              {/* Slug — copyable */}
              <div className="flex items-center justify-between gap-4 border-b border-[var(--brand-border)] pb-3">
                <span className="text-xs text-[var(--brand-muted)] shrink-0">Slug</span>
                <CopyableValue value={tenant.slug} />
              </div>

              {/* Domain — copyable */}
              <div className="flex items-center justify-between gap-4 border-b border-[var(--brand-border)] pb-3">
                <span className="text-xs text-[var(--brand-muted)] shrink-0">Domain</span>
                <CopyableValue value={domain} />
              </div>

              {/* Brand color chip */}
              <div className="flex items-center justify-between gap-4 border-b border-[var(--brand-border)] pb-3">
                <span className="text-xs text-[var(--brand-muted)] shrink-0">Brand color</span>
                <div className="flex items-center gap-2">
                  <div
                    className="h-4 w-4 rounded-full border border-black/10 shrink-0"
                    style={{ background: tenant.brand_color ?? 'var(--brand-primary)' }}
                  />
                  <span className="text-xs font-mono font-medium text-[var(--brand-text)]">
                    {tenant.brand_color ?? '#2563EB'}
                  </span>
                </div>
              </div>

              {/* Access mode — demo until Lovable auth is wired in */}
              <div className="flex items-center justify-between gap-4 border-b border-[var(--brand-border)] pb-3">
                <span className="text-xs text-[var(--brand-muted)] shrink-0">Access mode</span>
                <span className="text-xs font-medium text-[var(--brand-text)] capitalize">
                  {accessMode}
                </span>
              </div>

              {/* Theme source indicator */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-[var(--brand-muted)] shrink-0">Theme source</span>
                <span className="text-xs text-[var(--brand-muted)]">
                  Tenant default · user override may be active
                </span>
              </div>
            </div>
          </section>

          {/* Support */}
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--brand-text)]">Support</h2>
              <p className="text-xs text-[var(--brand-muted)] mt-0.5">
                Get help or report an issue with your workspace.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 flex items-center justify-between gap-6">
              <div>
                <p className="text-sm font-medium text-[var(--brand-text)]">Powered by Servify</p>
                <p className="text-xs text-[var(--brand-muted)] mt-0.5">
                  AI receptionist platform for modern med spas.
                </p>
              </div>
              <a
                href="mailto:support@servify.ai"
                className="shrink-0 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-1.5 text-xs font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-primary)]/50 transition-colors duration-150"
              >
                Contact support
              </a>
            </div>
          </section>

          {/* Advanced */}
          <AdvancedSection />
        </div>
      </div>
    </DashboardLayout>
  )
}
