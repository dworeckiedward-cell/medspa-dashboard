export default function ReportsLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-6 w-40 rounded bg-[var(--brand-border)] mb-2" />
          <div className="h-3 w-64 rounded bg-[var(--brand-border)]" />
        </div>
        <div className="h-8 w-28 rounded-lg bg-[var(--brand-border)]" />
      </div>

      {/* ROI summary skeleton */}
      <div className="rounded-xl border border-[var(--brand-border)] p-6">
        <div className="h-4 w-28 rounded bg-[var(--brand-border)] mb-4" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 rounded bg-[var(--brand-border)]" />
              <div className="h-8 w-24 rounded bg-[var(--brand-border)]" />
            </div>
          ))}
        </div>
      </div>

      {/* Two-column skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[var(--brand-border)] p-6 h-64" />
        <div className="rounded-xl border border-[var(--brand-border)] p-6 h-64" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-[var(--brand-border)] p-4 space-y-3">
        <div className="h-4 w-32 rounded bg-[var(--brand-border)]" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 rounded bg-[var(--brand-border)]" />
        ))}
      </div>
    </div>
  )
}
