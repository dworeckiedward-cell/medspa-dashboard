export default function OpsAlertsLoading() {
  return (
    <div className="min-h-screen bg-[var(--brand-bg)]">
      <header className="border-b border-[var(--brand-border)] bg-[var(--brand-surface)] px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="h-5 w-48 rounded bg-[var(--brand-border)] animate-pulse" />
          <div className="h-3 w-32 rounded bg-[var(--brand-border)]/60 animate-pulse mt-2" />
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* KPI strip skeleton */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 animate-pulse"
            >
              <div className="h-3 w-16 rounded bg-[var(--brand-border)]/60 mb-2" />
              <div className="h-6 w-10 rounded bg-[var(--brand-border)]" />
            </div>
          ))}
        </div>
        {/* Table skeleton */}
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="h-4 w-16 rounded bg-[var(--brand-border)]" />
              <div className="h-4 w-32 rounded bg-[var(--brand-border)]" />
              <div className="h-4 flex-1 rounded bg-[var(--brand-border)]/60" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
