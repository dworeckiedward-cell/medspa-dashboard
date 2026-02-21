/**
 * Revenue attribution helpers — pure functions, no DB access.
 *
 * Strategy: keyword-match service names against call log text fields
 * (semantic_title, tags, ai_summary). Results are clearly labelled
 * "estimated" in the UI — this is a heuristic, not an accounting source.
 */

import type { CallLog } from '@/types/database'
import type { ClientService } from '@/lib/types/domain'

// ── Keyword matching ──────────────────────────────────────────────────────────

/**
 * Returns true if the service name (or any alias-style word) appears in the
 * haystack string (case-insensitive, whole-word-ish match).
 */
function nameMatchesText(serviceName: string, haystack: string): boolean {
  // Normalise: lowercase, collapse whitespace
  const needle = serviceName.toLowerCase().trim()
  const hay = haystack.toLowerCase()
  return hay.includes(needle)
}

/**
 * Build a searchable text blob from a call log's free-text fields.
 */
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

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Try to match a call log to a service by keyword matching.
 * Returns the first matching active service's priceCents, or null if no match.
 *
 * Matching order: longer (more specific) names win over shorter names.
 */
export function resolveServicePrice(
  log: CallLog,
  services: ClientService[],
): number | null {
  const text = callLogSearchText(log)
  if (!text) return null

  // Sort longest-name-first so "Botox Forehead" beats "Botox"
  const sorted = [...services]
    .filter((s) => s.isActive && s.priceCents !== null)
    .sort((a, b) => b.name.length - a.name.length)

  for (const service of sorted) {
    if (nameMatchesText(service.name, text)) {
      return service.priceCents!
    }
  }

  return null
}

/**
 * For each booked call, attempt to attribute it to a service.
 * Returns the sum of attributed prices (in cents). Falls back to
 * potential_revenue (dollars → cents conversion) for unattributed calls.
 */
export function computeBookedRevenueFromCalls(
  callLogs: CallLog[],
  services: ClientService[],
): number {
  const booked = callLogs.filter((c) => c.is_booked)
  let totalCents = 0

  for (const log of booked) {
    const servicePriceCents = resolveServicePrice(log, services)
    if (servicePriceCents !== null) {
      totalCents += servicePriceCents
    } else {
      // Fall back to the call's own potential_revenue field (stored in dollars)
      totalCents += Math.round((log.potential_revenue ?? 0) * 100)
    }
  }

  return totalCents
}

// ── Top services ──────────────────────────────────────────────────────────────

export interface TopServiceEntry {
  service: ClientService
  /** Number of booked calls attributed to this service */
  bookedCount: number
  /** Estimated revenue in cents */
  revenueEstimateCents: number
}

/**
 * Compute the top-N services by attributed booked call count.
 *
 * @param callLogs  All call logs (any window — caller controls filtering)
 * @param services  Active services catalog for the tenant
 * @param topN      Max results (default 5)
 */
export function computeTopBookedServices(
  callLogs: CallLog[],
  services: ClientService[],
  topN = 5,
): TopServiceEntry[] {
  const booked = callLogs.filter((c) => c.is_booked)

  // Map<serviceId, { count, revenueCents }>
  const tally = new Map<string, { count: number; revenueCents: number }>()

  for (const log of booked) {
    const text = callLogSearchText(log)
    const matched = services
      .filter((s) => s.isActive && nameMatchesText(s.name, text))
      .sort((a, b) => b.name.length - a.name.length)[0]

    if (matched) {
      const prev = tally.get(matched.id) ?? { count: 0, revenueCents: 0 }
      tally.set(matched.id, {
        count: prev.count + 1,
        revenueCents: prev.revenueCents + (matched.priceCents ?? 0),
      })
    }
  }

  return services
    .filter((s) => tally.has(s.id))
    .map((s) => {
      const { count, revenueCents } = tally.get(s.id)!
      return { service: s, bookedCount: count, revenueEstimateCents: revenueCents }
    })
    .sort((a, b) => b.bookedCount - a.bookedCount || b.revenueEstimateCents - a.revenueEstimateCents)
    .slice(0, topN)
}
