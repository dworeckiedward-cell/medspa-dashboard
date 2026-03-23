'use client'

import { useRouter } from 'next/navigation'
import { ShieldOff, ArrowLeft } from 'lucide-react'

/**
 * Clean unauthorized screen for ops/admin pages.
 * Shown when authenticated user doesn't have operator access.
 */

interface OpsUnauthorizedProps {
  email?: string | null
  reason?: string
}

export function OpsUnauthorized({ email, reason }: OpsUnauthorizedProps) {
  const router = useRouter()

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--brand-bg)] p-4 transition-colors duration-200">
      <div className="max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-surface)] border border-[var(--brand-border)]">
          <ShieldOff className="h-7 w-7 text-[var(--brand-muted)]" />
        </div>

        <h1 className="text-2xl font-bold text-[var(--brand-text)] mb-3">
          Operator Access Required
        </h1>

        <p className="text-[var(--brand-muted)] text-sm leading-relaxed mb-6">
          The operator console is restricted to authorized Servify operators.
          {email && (
            <>
              {' '}You&apos;re signed in as{' '}
              <span className="font-medium text-[var(--brand-text)]">{email}</span>,
              but this account doesn&apos;t have operator privileges.
            </>
          )}
        </p>

        {process.env.NODE_ENV !== 'production' && reason && (
          <div className="mb-6 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-muted)] mb-1">
              Debug info
            </p>
            <p className="text-xs text-[var(--brand-muted)] font-mono">{reason}</p>
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 py-2 text-sm font-medium text-[var(--brand-text)] hover:border-[var(--brand-primary)]/50 transition-colors duration-150"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Go to Dashboard
          </button>
          <a
            href="mailto:team@servifylabs.com"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity duration-150"
          >
            Request Access
          </a>
        </div>
      </div>
    </div>
  )
}
