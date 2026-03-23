import { redirect } from 'next/navigation'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { PrepareLoader } from '@/components/dashboard/prepare-loader'

export const dynamic = 'force-dynamic'

/**
 * /dashboard/prepare?tenant=<slug>
 *
 * Premium "Preparing your workspace" transition page.
 * Shows branded loading UI for a minimum of 3 seconds, then navigates to the dashboard.
 * Workspace-selector routes here after the user clicks a workspace.
 */
export default async function PreparePage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>
}) {
  const sp = await searchParams
  if (!sp.tenant) redirect('/dashboard/select-tenant')

  const { tenant } = await resolveTenantAccess()
  if (!tenant) redirect('/dashboard/select-tenant')

  return (
    <PrepareLoader
      tenantName={tenant.name}
      tenantSlug={tenant.slug}
      logoUrl={tenant.logo_url}
      brandColor={tenant.brand_color ?? '#2563EB'}
      updatedAt={tenant.updated_at}
    />
  )
}
