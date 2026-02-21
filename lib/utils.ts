import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merges Tailwind classes without conflicts — required by shadcn/ui */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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
