import { redirect } from 'next/navigation'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { TenantContextProvider } from '@/components/dashboard/tenant-context'

/**
 * Persistent Next.js layout for all /dashboard/* routes.
 *
 * Resolves the tenant ONCE per navigation group — stays mounted across tab
 * switches so the TenantContext (including the full Client object) is stable.
 *
 * Client component pages (call-logs, leads, appointments, follow-up) read
 * the full tenant from useTenantContext() and data from useDashboardData().
 *
 * Server component pages (overview, settings, conversations…) still call
 * resolveTenantAccess() themselves and render their own DashboardLayout —
 * the TenantContextProvider wrapper is transparent to them.
 */
export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { tenant, needsTenantSelection } = await resolveTenantAccess()

  if (!tenant) {
    // If needsTenantSelection, render children directly — the select-tenant page
    // lives at /dashboard/select-tenant (inside this layout). Redirecting here
    // would cause an infinite loop since this layout would run again on that route.
    // The select-tenant page guards itself and redirects away once a tenant is chosen.
    if (needsTenantSelection) return <>{children}</>
    redirect('/login')
  }

  return (
    <TenantContextProvider tenant={tenant}>
      {children}
    </TenantContextProvider>
  )
}
