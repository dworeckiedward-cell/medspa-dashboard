/**
 * Service Performance — pure computation helpers.
 *
 * Computes per-service metrics from call logs using keyword matching.
 * All results are heuristic (service matching is text-based) and must
 * be labelled "estimated" in the UI via ConfidenceBadge.
 */

import type { CallLog } from '@/types/database'
import type { ClientService } from '@/lib/types/domain'

// ── Keyword matching (reused from revenue-attribution) ──────────────────────

function nameMatchesText(serviceName: string, haystack: string): boolean {
  return haystack.toLowerCase().includes(serviceName.toLowerCase().trim())
}

function callLogSearchText(log: CallLog): string {
  return [
    log.semantic_title ?? '',
    log.summary ?? '',
    log.ai_summary ?? '',
    (log.tags ?? []).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Match a single call log to the best-matching service.
 * Returns the matched service or null.
 */
function matchService(log: CallLog, services: ClientService[]): ClientService | null {
  const text = callLogSearchText(log)
  if (!text) return null

  const sorted = [...services]
    .filter((s) => s.isActive)
    .sort((a, b) => b.name.length - a.name.length)

  for (const service of sorted) {
    if (nameMatchesText(service.name, text)) {
      return service
    }
  }
  return null
}

// ── Public types ────────────────────────────────────────────────────────────

export interface ServicePerformanceEntry {
  service: ClientService
  /** Total calls mentioning this service */
  totalMentions: number
  /** Booked calls attributed to this service */
  bookedCount: number
  /** Estimated revenue in cents (bookedCount × priceCents) */
  revenueEstimateCents: number
  /** Percentage of total bookings */
  bookingSharePercent: number
  /** Percentage of total attributed revenue */
  revenueSharePercent: number
}

export interface ServicePerformanceSummary {
  entries: ServicePerformanceEntry[]
  /** Total bookings across all services */
  totalBookings: number
  /** Total attributed revenue in cents */
  totalRevenueCents: number
  /** Bookings with no service match */
  unmatchedBookings: number
}

// ── Computation ─────────────────────────────────────────────────────────────

/**
 * Compute per-service performance metrics from call logs.
 *
 * @param callLogs  Call logs for the analysis window (caller controls filtering)
 * @param services  Active services catalog
 */
export function computeServicePerformance(
  callLogs: CallLog[],
  services: ClientService[],
): ServicePerformanceSummary {
  const booked = callLogs.filter((c) => c.is_booked)

  // Tally per-service: mentions (all calls) and bookings
  const mentionMap = new Map<string, number>()
  const bookingMap = new Map<string, number>()
  let unmatchedBookings = 0

  // Count all mentions
  for (const log of callLogs) {
    const matched = matchService(log, services)
    if (matched) {
      mentionMap.set(matched.id, (mentionMap.get(matched.id) ?? 0) + 1)
    }
  }

  // Count bookings
  for (const log of booked) {
    const matched = matchService(log, services)
    if (matched) {
      bookingMap.set(matched.id, (bookingMap.get(matched.id) ?? 0) + 1)
    } else {
      unmatchedBookings++
    }
  }

  // Compute totals for share calculations
  let totalRevenueCents = 0
  const entries: ServicePerformanceEntry[] = []

  for (const service of services) {
    const bookedCount = bookingMap.get(service.id) ?? 0
    if (bookedCount === 0 && (mentionMap.get(service.id) ?? 0) === 0) continue

    const revCents = bookedCount * (service.priceCents ?? 0)
    totalRevenueCents += revCents

    entries.push({
      service,
      totalMentions: mentionMap.get(service.id) ?? 0,
      bookedCount,
      revenueEstimateCents: revCents,
      bookingSharePercent: 0, // filled below
      revenueSharePercent: 0, // filled below
    })
  }

  const totalBookings = booked.length

  // Fill share percentages
  for (const entry of entries) {
    entry.bookingSharePercent =
      totalBookings > 0 ? Math.round((entry.bookedCount / totalBookings) * 100) : 0
    entry.revenueSharePercent =
      totalRevenueCents > 0
        ? Math.round((entry.revenueEstimateCents / totalRevenueCents) * 100)
        : 0
  }

  // Sort by revenue desc, then bookings desc
  entries.sort(
    (a, b) =>
      b.revenueEstimateCents - a.revenueEstimateCents || b.bookedCount - a.bookedCount,
  )

  return { entries, totalBookings, totalRevenueCents, unmatchedBookings }
}
