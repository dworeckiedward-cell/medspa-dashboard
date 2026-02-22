'use client'

import Link from 'next/link'

export default function SupportError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-3">
        <h2 className="text-sm font-semibold text-[var(--brand-text)]">
          Something went wrong
        </h2>
        <p className="text-xs text-[var(--brand-muted)] max-w-sm">
          We could not load the support page. Please try again.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-md bg-[var(--brand-primary)] px-3 py-1.5 text-xs text-white hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-md border border-[var(--brand-border)] px-3 py-1.5 text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)]"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
