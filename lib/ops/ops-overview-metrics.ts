/**
 * Ops Overview Metrics — chart series computation for the hero chart module.
 *
 * Produces scaffold time-series for 3 chart views:
 *   1. MRR & Clients
 *   2. ROI: CAC vs MRR
 *   3. Clients & Churn
 *
 * Since historical MRR/churn data isn't stored as time-series,
 * data is extrapolated from current snapshots. Clearly labeled
 * as "estimated" in the UI.
 */

import type { ClientCommercialSnapshot } from '@/lib/ops-financials/types'
import type { ClientUnitEconomics } from '@/lib/ops/unit-economics/types'
import type { ClientHealthScore, HealthLevel } from '@/lib/ops/health-score'

// ── Types ────────────────────────────────────────────────────────────────────

export interface OpsChartPoint {
  /** ISO date or label (e.g. 'Jan', 'Feb') */
  label: string
  /** MRR in USD */
  mrr: number
  /** Number of active clients */
  activeClients: number
  /** Average CAC (if available) */
  avgCac: number | null
  /** Estimated churn count */
  churnCount: number
}

export interface OpsOverviewKpis {
  activeClients: number
  activeMrr: number
  bookings: number
  callRevenue: number
  avgHealthPct: number
  criticalAlerts: number
}

export interface OpsChartData {
  kpis: OpsOverviewKpis
  series: OpsChartPoint[]
  /** True when chart data is scaffolded (no real historical time-series) */
  isEstimated: boolean
}

// ── Range options ────────────────────────────────────────────────────────────

export const OPS_RANGE_OPTIONS = [7, 30, 45, 60, 365] as const
export type OpsRange = (typeof OPS_RANGE_OPTIONS)[number]

// ── Chart views ──────────────────────────────────────────────────────────────

export const OPS_CHART_VIEWS = [
  { key: 'mrr-clients' as const, label: 'MRR & Clients' },
  { key: 'roi' as const, label: 'ROI' },
  { key: 'churn' as const, label: 'Churn' },
] as const

export type OpsChartView = (typeof OPS_CHART_VIEWS)[number]['key']

// ── Compute ──────────────────────────────────────────────────────────────────

export function computeOpsOverviewMetrics(opts: {
  totalClients: number
  healthyClients: number
  criticalClients: number
  totalCalls: number
  totalBookings: number
  totalRevenue: number
  activeMrr: number
  healthScores: Map<string, ClientHealthScore>
  unitEconomics: ClientUnitEconomics[]
  rangeDays: OpsRange
}): OpsChartData {
  const {
    totalClients,
    healthyClients,
    criticalClients,
    totalCalls,
    totalBookings,
    totalRevenue,
    activeMrr,
    healthScores,
    unitEconomics,
    rangeDays,
  } = opts

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const avgHealthPct = totalClients > 0 ? Math.round((healthyClients / totalClients) * 100) : 0

  const kpis: OpsOverviewKpis = {
    activeClients: totalClients,
    activeMrr,
    bookings: totalBookings,
    callRevenue: totalRevenue,
    avgHealthPct,
    criticalAlerts: criticalClients,
  }

  // ── Chart series (scaffold) ──────────────────────────────────────────────
  // Compute average CAC from unit economics
  const withCac = unitEconomics.filter((u) => u.cacAmount !== null && u.cacAmount > 0)
  const avgCac = withCac.length > 0
    ? Math.round(withCac.reduce((s, u) => s + (u.cacAmount ?? 0), 0) / withCac.length)
    : null

  // Estimate churn: clients with critical health level
  const churnCount = Array.from(healthScores.values()).filter(
    (h) => h.level === 'critical',
  ).length

  // Generate time points
  const now = new Date()
  const points: number = rangeDays <= 30 ? rangeDays : rangeDays <= 60 ? Math.ceil(rangeDays / 7) : 12
  const series: OpsChartPoint[] = []

  for (let i = points - 1; i >= 0; i--) {
    const d = new Date(now)
    if (rangeDays <= 30) {
      d.setDate(d.getDate() - i)
    } else if (rangeDays <= 60) {
      d.setDate(d.getDate() - i * 7)
    } else {
      d.setMonth(d.getMonth() - i)
    }

    const label =
      rangeDays <= 30
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : rangeDays <= 60
          ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : d.toLocaleDateString('en-US', { month: 'short' })

    // Growth factor: simulate gradual ramp-up to current values
    const progress = points > 1 ? (points - i) / points : 1
    // Slight random variation for visual realism (seeded by index for stability)
    const jitter = 0.92 + (((i * 7 + 3) % 10) / 50) // deterministic 0.92–1.10

    series.push({
      label,
      mrr: Math.round(activeMrr * progress * (i === 0 ? 1 : jitter)),
      activeClients: Math.round(totalClients * progress * (i === 0 ? 1 : jitter)),
      avgCac: avgCac !== null ? Math.round(avgCac * (i === 0 ? 1 : jitter)) : null,
      churnCount: i === 0 ? churnCount : Math.max(0, Math.round(churnCount * jitter * 0.8)),
    })
  }

  return { kpis, series, isEstimated: true }
}
