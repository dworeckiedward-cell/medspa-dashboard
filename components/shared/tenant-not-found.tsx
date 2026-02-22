import { Sparkles, ShieldOff } from 'lucide-react'

type TenantNotFoundReason = 'not_found' | 'no_workspace'

interface TenantNotFoundProps {
  slug?: string
  /**
   * 'not_found'    — default; tenant slug unknown or slug not in DB
   * 'no_workspace' — user is authenticated but has no user_tenants row
   */
  reason?: TenantNotFoundReason
}

export function TenantNotFound({ slug, reason = 'not_found' }: TenantNotFoundProps) {
  const isNoWorkspace = reason === 'no_workspace'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--brand-bg)] p-4 transition-colors duration-200">
      <div className="max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-surface)] border border-[var(--brand-border)]">
          {isNoWorkspace ? (
            <ShieldOff className="h-7 w-7 text-[var(--brand-muted)]" />
          ) : (
            <Sparkles className="h-7 w-7 text-[var(--brand-muted)]" />
          )}
        </div>

        <h1 className="text-2xl font-bold text-[var(--brand-text)] mb-3">
          {isNoWorkspace
            ? 'No Workspace Assigned'
            : slug
            ? 'Clinic Not Found'
            : 'No Clinic Selected'}
        </h1>

        <p className="text-[var(--brand-muted)] text-sm leading-relaxed mb-6">
          {isNoWorkspace ? (
            <>
              You&apos;re logged in, but your account hasn&apos;t been linked to a workspace yet.
              Contact support to get access.
            </>
          ) : slug ? (
            <>
              We couldn&apos;t find a clinic matching{' '}
              <code className="font-mono text-[var(--brand-text)] bg-[var(--brand-surface)] border border-[var(--brand-border)] px-1.5 py-0.5 rounded">
                {slug}
              </code>
              . The subdomain may be incorrect, or the clinic may be inactive.
            </>
          ) : (
            'Access your dashboard via your clinic subdomain, or use the developer query param.'
          )}
        </p>

        {isNoWorkspace ? (
          <a
            href="mailto:support@servify.ai"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 py-2 text-sm font-medium text-[var(--brand-text)] hover:border-[var(--brand-primary)]/50 transition-colors duration-150"
          >
            Contact support →
          </a>
        ) : (
          <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 text-left text-xs text-[var(--brand-muted)] space-y-1.5">
            <p className="font-semibold text-[var(--brand-text)] mb-2">Developer access:</p>
            <p>
              <code className="text-[var(--brand-primary)]">luxe.lvh.me:3000/dashboard</code>{' '}
              — subdomain
            </p>
            <p>
              <code className="text-[var(--brand-primary)]">
                localhost:3000/dashboard?tenant=luxe
              </code>{' '}
              — query param
            </p>
            <p>
              <code className="text-[var(--brand-primary)]">x-tenant-slug: luxe</code> — request
              header
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
