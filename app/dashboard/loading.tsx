export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-5 w-48 rounded bg-[var(--brand-border)] mb-2" />
          <div className="h-3 w-32 rounded bg-[var(--brand-border)]" />
        </div>
        <div className="h-8 w-24 rounded-lg bg-[var(--brand-border)]" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--brand-border)] p-4">
            <div className="h-3 w-16 rounded bg-[var(--brand-border)] mb-3" />
            <div className="h-7 w-24 rounded bg-[var(--brand-border)] mb-1" />
            <div className="h-2 w-12 rounded bg-[var(--brand-border)]" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="rounded-xl border border-[var(--brand-border)] p-6">
        <div className="h-4 w-32 rounded bg-[var(--brand-border)] mb-4" />
        <div className="h-48 rounded bg-[var(--brand-border)]" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-[var(--brand-border)] p-4 space-y-3">
        <div className="h-4 w-24 rounded bg-[var(--brand-border)]" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-4 w-20 rounded bg-[var(--brand-border)]" />
            <div className="h-4 flex-1 rounded bg-[var(--brand-border)]" />
            <div className="h-4 w-16 rounded bg-[var(--brand-border)]" />
          </div>
        ))}
      </div>
    </div>
  )
}
