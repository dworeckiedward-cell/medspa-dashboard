import { redirect } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { WorkspaceSelector } from '@/components/auth/workspace-selector'

// Always fresh — tenant list must not be cached
export const dynamic = 'force-dynamic'

/**
 * /dashboard/select-tenant
 *
 * Shown to authenticated users who belong to more than one workspace.
 * Renders a branded workspace picker with search and optional ops button.
 */
export default async function SelectTenantPage() {
  const { accessMode, needsTenantSelection, availableTenants } = await resolveTenantAccess()

  // Guard: only multi-tenant authenticated users should land here
  if (accessMode !== 'authenticated') redirect('/dashboard')
  if (!needsTenantSelection) redirect('/dashboard')
  if (!availableTenants || availableTenants.length === 0) redirect('/dashboard')

  // Check ops access for the optional "Operator Console" button
  let hasOpsAccess = false
  try {
    const opsResult = await resolveOperatorAccess()
    hasOpsAccess = opsResult.authorized
  } catch {
    // Graceful — hide ops button on error
  }

  // Serialize tenant data for the client component
  const tenants = availableTenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    brandColor: t.brand_color,
    logoUrl: t.logo_url,
    isActive: t.is_active,
  }))

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--brand-bg)] p-4 transition-colors duration-200">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand-surface)] border border-[var(--brand-border)]">
            <Sparkles className="h-5 w-5 text-[var(--brand-muted)]" />
          </div>
          <h1 className="text-xl font-semibold text-[var(--brand-text)]">Select Workspace</h1>
          <p className="text-sm text-[var(--brand-muted)] mt-1.5">
            Your account has access to {tenants.length} workspace{tenants.length !== 1 ? 's' : ''}.
          </p>
        </div>

        {/* Interactive workspace selector (client component) */}
        <WorkspaceSelector
          tenants={tenants}
          hasOpsAccess={hasOpsAccess}
        />

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-[var(--brand-muted)] opacity-60">
          Powered by Servify · AI Receptionist
        </p>
      </div>
    </div>
  )
}
