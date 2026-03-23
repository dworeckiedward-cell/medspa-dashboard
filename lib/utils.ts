import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merges Tailwind classes without conflicts — required by shadcn/ui */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Reusable polish class-string tokens for consistent dashboard styling.
 * Use in `cn()` calls: `cn(polish.focusRing, 'other-classes')`.
 */
export const polish = {
  /** Clickable card: stronger hover shadow + pointer */
  cardClickable:
    'cursor-pointer hover:shadow-md hover:border-[var(--brand-border)]/60 active:shadow-sm transition-shadow duration-200',
  /** Section heading: small-caps category label */
  sectionTitle:
    'text-[11px] font-medium text-[var(--brand-muted)] uppercase tracking-wider',
  /** Subtle horizontal separator */
  separator: 'border-[var(--brand-border)]/50',
  /** Standard focus ring for interactive elements */
  focusRing:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/30 focus-visible:ring-offset-1',
  /** Compact CTA link-button style (used in card headers) */
  ctaLink:
    'flex items-center gap-1 rounded-lg border border-[var(--brand-border)]/60 bg-[var(--brand-surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--brand-text)] hover:border-[var(--brand-border)] hover:bg-[var(--brand-bg)] transition-colors shrink-0',
  /** Empty state container classes */
  emptyState:
    'flex flex-col items-center justify-center gap-3 py-16 text-center',
  /** Empty state icon circle */
  emptyIcon:
    'flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-border)]/40',
} as const

/** Format a number as currency */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Format seconds into human-readable duration */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

/** Mask a string for display — shows first 4 and last 4 chars */
export function maskString(value: string | null | undefined, visibleChars = 4): string {
  if (!value) return '—'
  if (value.length <= visibleChars * 2) return '••••••••'
  return `${value.slice(0, visibleChars)}••••${value.slice(-visibleChars)}`
}

/** Returns days remaining until a date (negative if expired) */
export function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null
  const diff = new Date(isoDate).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/** Truncate text to max length with ellipsis */
export function truncate(text: string | null, max = 120): string {
  if (!text) return ''
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

/**
 * Highlight matched substrings within text for a given query.
 * Returns an array of React-compatible segments: plain strings and
 * objects with `{ hl: true, text }` for highlighted parts.
 * Case-insensitive, multiple occurrences.
 */
export function highlightSegments(
  text: string,
  query: string,
): Array<string | { hl: true; text: string }> {
  if (!query || !text) return [text]
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part) =>
    regex.test(part) ? { hl: true as const, text: part } : part,
  )
}
