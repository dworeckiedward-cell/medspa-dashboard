export default function IntegrationsLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div>
        <div className="h-6 w-36 rounded bg-[var(--brand-border)] mb-2" />
        <div className="h-3 w-72 rounded bg-[var(--brand-border)]" />
      </div>

      {/* Health card skeleton */}
      <div className="rounded-xl border border-[var(--brand-border)] p-6 h-32" />

      {/* Integration cards skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--brand-border)] p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-[var(--brand-border)]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-[var(--brand-border)]" />
              <div className="h-3 w-48 rounded bg-[var(--brand-border)]" />
            </div>
            <div className="h-8 w-20 rounded-lg bg-[var(--brand-border)]" />
          </div>
        ))}
      </div>
    </div>
  )
}
