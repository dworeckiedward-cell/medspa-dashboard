/**
 * Ops Financials — Formatting Helpers (Internal Only)
 *
 * Money formatting, status label/color access, and date helpers.
 */

// ── Money formatting ──────────────────────────────────────────────────────

/**
 * Format a dollar amount for display. Always shows cents for amounts < $1000.
 * Uses compact format for larger amounts.
 */
export function formatMoney(amount: number | null, currency = 'USD'): string {
  if (amount === null) return '—'
  if (amount === 0) return '$0'

  // Compact display for large amounts
  if (Math.abs(amount) >= 10_000) {
    return `$${Math.round(amount / 1000)}k`
  }

  // Standard formatting
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format compact money for table cells (no decimals, k/M suffixes).
 */
export function formatMoneyCompact(amount: number | null): string {
  if (amount === null) return '—'
  if (amount === 0) return '$0'
  if (Math.abs(amount) >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (Math.abs(amount) >= 1_000) return `$${Math.round(amount / 1000)}k`
  return `$${Math.round(amount)}`
}

// ── Date formatting ───────────────────────────────────────────────────────

/**
 * Format an ISO date string to a short display format.
 */
export function formatShortDate(isoDate: string | null): string {
  if (!isoDate) return '—'
  const date = new Date(isoDate)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

/**
 * Format a relative time string like "3 days ago" or "in 5 days".
 */
export function formatRelativeDate(isoDate: string | null): string {
  if (!isoDate) return '—'
  const diff = new Date(isoDate).getTime() - Date.now()
  const days = Math.round(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days > 0) return `In ${days}d`
  return `${Math.abs(days)}d ago`
}

/**
 * Format "Last paid X days ago" style text.
 */
export function formatLastPaidLabel(lastPaidAt: string | null): string {
  if (!lastPaidAt) return 'Never paid'
  const diff = Date.now() - new Date(lastPaidAt).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Paid today'
  if (days === 1) return 'Paid yesterday'
  return `${days}d ago`
}

// ── Ratio formatting ──────────────────────────────────────────────────────

/**
 * Format LTV:CAC ratio with "x" suffix.
 */
export function formatRatio(ratio: number | null): string {
  if (ratio === null) return '—'
  return `${ratio}x`
}
