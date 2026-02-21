import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'

// Always fresh — tenant list must not be cached
export const dynamic = 'force-dynamic'

/**
 * /dashboard/select-tenant
 *
 * Shown to authenticated users who belong to more than one workspace.
 * Renders a branded workspace picker; selecting a tile navigates to
 * /dashboard?tenant={slug} (demo path takes over from there).
 *
 * Future: persist selection to a cookie so returning users skip this screen.
 */
export default async function SelectTenantPage() {
  const { accessMode, needsTenantSelection, availableTenants } = await resolveTenantAccess()

  // Guard: only multi-tenant authenticated users should land here
  if (accessMode !== 'authenticated') redirect('/dashboard')
  if (!needsTenantSelection) redirect('/dashboard')
  if (!availableTenants || availableTenants.length === 0) redirect('/dashboard')

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--brand-bg)] p-4 transition-colors duration-200">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand-surface)] border border-[var(--brand-border)]">
            <Sparkles className="h-5 w-5 text-[var(--brand-muted)]" />
          </div>
          <h1 className="text-xl font-semibold text-[var(--brand-text)]">Select Workspace</h1>
          <p className="text-sm text-[var(--brand-muted)] mt-1.5">
            Your account has access to {availableTenants.length} workspaces.
          </p>
        </div>

        {/* Workspace list */}
        <ul className="space-y-2">
          {availableTenants.map((tenant) => (
            <li key={tenant.id}>
              <Link
                href={`/dashboard?tenant=${encodeURIComponent(tenant.slug)}`}
                className="group flex items-center gap-3 w-full rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 hover:border-[var(--brand-primary)]/50 hover:bg-[var(--brand-primary)]/5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
              >
                {/* Monogram / brand chip */}
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white text-sm font-bold"
                  style={{ background: tenant.brand_color ?? 'var(--brand-primary)' }}
                >
                  {tenant.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--brand-text)] truncate leading-snug">
                    {tenant.name}
                  </p>
                  <p className="text-xs text-[var(--brand-muted)] font-mono truncate mt-0.5">
                    {tenant.slug}
                  </p>
                </div>

                {/* Chevron */}
                <span className="shrink-0 text-[var(--brand-muted)] group-hover:text-[var(--brand-primary)] transition-colors duration-150 text-xs">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-[var(--brand-muted)] opacity-60">
          Powered by Servify · AI Receptionist
        </p>
      </div>
    </div>
  )
}
