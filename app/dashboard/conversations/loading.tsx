export default function ConversationsLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Heading skeleton */}
      <div>
        <div className="h-5 w-40 bg-[var(--brand-border)] rounded" />
        <div className="h-3 w-64 bg-[var(--brand-border)] rounded mt-2" />
      </div>

      {/* KPI strip skeleton */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-[var(--brand-border)]/30" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-[var(--brand-border)]/20" />
        ))}
      </div>
    </div>
  )
}
