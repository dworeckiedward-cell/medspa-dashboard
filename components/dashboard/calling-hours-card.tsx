import { Clock } from 'lucide-react'

export function CallingHoursCard() {
  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-[var(--brand-muted)] shrink-0" />
        <span className="text-sm font-medium text-[var(--brand-text)]">Monday – Saturday</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-2 text-sm font-semibold text-[var(--brand-text)]">
          9:00 AM
        </span>
        <span className="text-xs text-[var(--brand-muted)]">&amp;</span>
        <span className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-2 text-sm font-semibold text-[var(--brand-text)]">
          3:00 PM
        </span>
      </div>
      <p className="text-[11px] text-[var(--brand-muted)]">
        Times are in Mountain Time (MT). Emma places two outbound call attempts per lead per day — one at each time above.
      </p>
    </div>
  )
}
