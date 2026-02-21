export default function PartnersLoading() {
  return (
    <div className="min-h-screen bg-[var(--brand-bg)]">
      {/* Header skeleton */}
      <div className="border-b border-[var(--brand-border)] bg-[var(--brand-surface)] px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="h-5 w-44 rounded bg-[var(--brand-border)] mb-1.5 animate-pulse" />
          <div className="h-3 w-32 rounded bg-[var(--brand-border)] animate-pulse" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6 animate-pulse">
        {/* KPI strip skeleton */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[var(--brand-border)] p-4">
              <div className="h-2.5 w-12 rounded bg-[var(--brand-border)] mb-2.5" />
              <div className="h-6 w-16 rounded bg-[var(--brand-border)] mb-1" />
              <div className="h-2 w-10 rounded bg-[var(--brand-border)]" />
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3 rounded-xl border border-[var(--brand-border)] p-4 space-y-3">
            <div className="h-4 w-24 rounded bg-[var(--brand-border)]" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4 py-2">
                <div className="h-4 w-28 rounded bg-[var(--brand-border)]" />
                <div className="h-4 w-16 rounded bg-[var(--brand-border)]" />
                <div className="h-4 w-12 rounded bg-[var(--brand-border)]" />
                <div className="h-4 w-12 rounded bg-[var(--brand-border)]" />
                <div className="h-4 flex-1 rounded bg-[var(--brand-border)]" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-[var(--brand-border)] p-4 space-y-3">
            <div className="h-4 w-28 rounded bg-[var(--brand-border)]" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between py-1">
                <div className="h-3 w-20 rounded bg-[var(--brand-border)]" />
                <div className="h-3 w-14 rounded bg-[var(--brand-border)]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
