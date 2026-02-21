export default function OnboardingLoading() {
  return (
    <div className="p-6 max-w-2xl mx-auto animate-pulse">
      <div className="mb-6">
        <div className="h-5 w-32 rounded bg-[var(--brand-border)] mb-2" />
        <div className="h-3 w-64 rounded bg-[var(--brand-border)]" />
      </div>

      <div className="rounded-xl border border-[var(--brand-border)] p-5 space-y-4">
        {/* Progress bar */}
        <div className="h-1 rounded bg-[var(--brand-border)]" />

        {/* Step indicators */}
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 py-2">
              <div className="h-7 w-7 rounded-full bg-[var(--brand-border)]" />
              <div className="h-2 w-10 rounded bg-[var(--brand-border)]" />
            </div>
          ))}
        </div>

        {/* Content area */}
        <div className="rounded-lg border border-[var(--brand-border)] p-4 h-40" />

        {/* Navigation */}
        <div className="flex justify-between">
          <div className="h-8 w-16 rounded-lg bg-[var(--brand-border)]" />
          <div className="h-8 w-28 rounded-lg bg-[var(--brand-border)]" />
        </div>
      </div>
    </div>
  )
}
