/**
 * Client Health Score — deterministic weighted scoring for operator console.
 *
 * Factors:
 *  - Recent activity (calls in last 7 days)
 *  - Booking activity (any booked calls in period)
 *  - Integration health (healthy vs total)
 *  - Onboarding completion
 *  - Error volume (integration failures)
 *
 * Output: score (0–100), level, top reasons.
 * All pure computation — no IO.
 */

import type { ClientOverview } from './query'

// ── Types ────────────────────────────────────────────────────────────────────

export type HealthLevel = 'healthy' | 'watch' | 'critical' | 'onboarding'

export interface ClientHealthScore {
  score: number
  level: HealthLevel
  reasons: string[]
}

// ── Scoring ──────────────────────────────────────────────────────────────────

export function computeClientHealth(
  overview: ClientOverview,
  opts?: {
    /** Number of failed deliveries for this client in last 24h */
    failedDeliveries24h?: number
  },
): ClientHealthScore {
  const reasons: string[] = []
  let score = 100

  // ── 1. Onboarding state (if not started or incomplete) ─────────────────
  if (!overview.hasOnboarding || !overview.onboardingComplete) {
    // Client is in onboarding — return early with special level
    if (overview.callStats.totalCalls === 0) {
      return {
        score: 0,
        level: 'onboarding',
        reasons: ['Onboarding not completed', 'No call activity yet'],
      }
    }
    // Onboarding incomplete but has activity — deduct points
    score -= 10
    reasons.push('Onboarding incomplete')
  }

  // ── 2. Recent activity ─────────────────────────────────────────────────
  if (overview.callStats.totalCalls === 0) {
    score -= 40
    reasons.push('No calls in last 30 days')
  } else if (overview.callStats.totalCalls < 5) {
    score -= 15
    reasons.push('Very low call volume (< 5 in 30d)')
  }

  // ── 3. Booking activity ────────────────────────────────────────────────
  if (overview.callStats.totalCalls > 0 && overview.callStats.bookedCalls === 0) {
    score -= 20
    reasons.push('No bookings in period')
  } else if (overview.callStats.bookingRate < 10 && overview.callStats.totalCalls >= 5) {
    score -= 10
    reasons.push('Low booking rate (< 10%)')
  }

  // ── 4. Integration health ──────────────────────────────────────────────
  if (overview.integrationsCount === 0) {
    score -= 10
    reasons.push('No integrations configured')
  } else if (overview.integrationsHealthy < overview.integrationsCount) {
    const unhealthy = overview.integrationsCount - overview.integrationsHealthy
    score -= Math.min(unhealthy * 10, 20)
    reasons.push(`${unhealthy} integration${unhealthy !== 1 ? 's' : ''} unhealthy`)
  }

  // ── 5. Delivery failures ───────────────────────────────────────────────
  const failures = opts?.failedDeliveries24h ?? 0
  if (failures > 5) {
    score -= 15
    reasons.push(`${failures} delivery failures in last 24h`)
  } else if (failures > 0) {
    score -= 5
    reasons.push(`${failures} delivery failure${failures !== 1 ? 's' : ''} in last 24h`)
  }

  // ── Clamp + derive level ───────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score))

  let level: HealthLevel
  if (score >= 75) {
    level = 'healthy'
  } else if (score >= 45) {
    level = 'watch'
  } else {
    level = 'critical'
  }

  return {
    score,
    level,
    reasons: reasons.slice(0, 3), // Top 3 reasons
  }
}

// ── Badge config ─────────────────────────────────────────────────────────────

export function getHealthBadgeStyle(level: HealthLevel): {
  label: string
  bgClass: string
  textClass: string
  dotClass: string
} {
  switch (level) {
    case 'healthy':
      return {
        label: 'Healthy',
        bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
        textClass: 'text-emerald-700 dark:text-emerald-400',
        dotClass: 'bg-emerald-500',
      }
    case 'watch':
      return {
        label: 'Watch',
        bgClass: 'bg-amber-50 dark:bg-amber-950/30',
        textClass: 'text-amber-700 dark:text-amber-400',
        dotClass: 'bg-amber-500',
      }
    case 'critical':
      return {
        label: 'Critical',
        bgClass: 'bg-rose-50 dark:bg-rose-950/30',
        textClass: 'text-rose-700 dark:text-rose-400',
        dotClass: 'bg-rose-500',
      }
    case 'onboarding':
      return {
        label: 'Onboarding',
        bgClass: 'bg-blue-50 dark:bg-blue-950/30',
        textClass: 'text-blue-700 dark:text-blue-400',
        dotClass: 'bg-blue-500',
      }
  }
}
