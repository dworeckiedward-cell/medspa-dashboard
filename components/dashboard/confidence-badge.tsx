/**
 * ConfidenceBadge — shared exact vs estimated label component.
 *
 * Standardizes attribution confidence labels across the dashboard:
 *  - "exact"     → emerald  — value comes from call log data directly
 *  - "estimated" → amber    — value derived from heuristic / service matching
 *  - "reported"  → emerald  — value reported by the AI / caller
 *
 * Usage:
 *   <ConfidenceBadge type="estimated" />
 *   <ConfidenceBadge type="exact" label="Verified" />
 */

import { cn } from '@/lib/utils'

export type ConfidenceType = 'exact' | 'estimated' | 'reported'

interface ConfidenceBadgeProps {
  type: ConfidenceType
  /** Override the default label text */
  label?: string
  className?: string
}

const CONFIG: Record<ConfidenceType, { defaultLabel: string; classes: string }> = {
  exact: {
    defaultLabel: 'Exact',
    classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  },
  reported: {
    defaultLabel: 'Reported',
    classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  },
  estimated: {
    defaultLabel: 'Estimated',
    classes: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  },
}

export function ConfidenceBadge({ type, label, className }: ConfidenceBadgeProps) {
  const config = CONFIG[type]
  return (
    <span
      className={cn(
        'text-[8px] font-medium uppercase tracking-wider rounded px-1 py-0.5',
        config.classes,
        className,
      )}
    >
      {label ?? config.defaultLabel}
    </span>
  )
}
