'use client'

export default function OpsAlertsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-[var(--brand-bg)] flex items-center justify-center">
      <div className="text-center max-w-md">
        <h2 className="text-lg font-semibold text-[var(--brand-text)]">
          Alerts Console Error
        </h2>
        <p className="text-sm text-[var(--brand-muted)] mt-2">
          {error.message || 'Something went wrong loading the alerts console.'}
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 py-2 text-sm font-medium text-[var(--brand-text)] hover:border-violet-400/50 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
