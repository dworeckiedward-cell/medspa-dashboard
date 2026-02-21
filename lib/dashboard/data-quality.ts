/**
 * Data Quality / Trust Center — pure computation helpers.
 *
 * Computes data completeness metrics from call logs and services.
 * All results are deterministic and transparent — no LLM dependency.
 *
 * Exposed as a single summary + per-dimension breakdown so the UI
 * can render a compact trust card with actionable improvement tips.
 */

import type { CallLog } from '@/types/database'
import type { ClientService } from '@/lib/types/domain'

// ── Types ────────────────────────────────────────────────────────────────────

export interface DataQualityDimension {
  /** Machine key */
  key: string
  /** Human-readable label */
  label: string
  /** Percentage 0–100 (integer) */
  percent: number
  /** Numerator / denominator for tooltip */
  filled: number
  total: number
  /** Severity band derived from percent */
  band: 'good' | 'fair' | 'poor'
}

export interface DataQualityImprovement {
  id: string
  label: string
  href?: string
}

export interface DataQualitySummary {
  /** Overall weighted score 0–100 */
  overallScore: number
  /** Band for overall score */
  overallBand: 'good' | 'fair' | 'poor'
  /** Per-dimension breakdown */
  dimensions: DataQualityDimension[]
  /** Top actionable improvements (max 3) */
  improvements: DataQualityImprovement[]
  /** Total calls analyzed */
  totalCalls: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function band(pct: number): 'good' | 'fair' | 'poor' {
  if (pct >= 80) return 'good'
  if (pct >= 50) return 'fair'
  return 'poor'
}

function pct(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 100) : 0
}

/** Simple keyword check to see if any service name appears in the call text */
function hasServiceMatch(log: CallLog, services: ClientService[]): boolean {
  const text = [
    log.semantic_title ?? '',
    log.summary ?? '',
    log.ai_summary ?? '',
    (log.tags ?? []).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (!text) return false
  return services.some(
    (s) => s.isActive && text.includes(s.name.toLowerCase().trim()),
  )
}

// ── Main computation ─────────────────────────────────────────────────────────

/**
 * Compute data quality / trust metrics.
 *
 * @param callLogs     Call logs for the analysis window
 * @param services     Configured services catalog
 * @param opts.hasIntegrations  Whether any integrations are configured
 */
export function computeDataQuality(
  callLogs: CallLog[],
  services: ClientService[],
  opts?: { hasIntegrations?: boolean },
): DataQualitySummary {
  const total = callLogs.length
  const bookedLogs = callLogs.filter((c) => c.is_booked)

  // ── Dimensions ──────────────────────────────────────────────────────────

  // 1. Disposition coverage
  const withDisposition = callLogs.filter((c) => c.disposition != null).length
  const dispositionPct = pct(withDisposition, total)

  // 2. Summary coverage (summary OR ai_summary)
  const withSummary = callLogs.filter(
    (c) => (c.summary && c.summary.length > 0) || (c.ai_summary && c.ai_summary.length > 0),
  ).length
  const summaryPct = pct(withSummary, total)

  // 3. Revenue attribution on booked calls
  const bookedWithRevenue = bookedLogs.filter((c) => c.potential_revenue > 0).length
  const revenuePct = pct(bookedWithRevenue, bookedLogs.length)

  // 4. Service attribution (keyword match)
  const withServiceMatch = callLogs.filter((c) => hasServiceMatch(c, services)).length
  const serviceAttrPct = pct(withServiceMatch, total)

  // 5. Lead source coverage
  const withLeadSource = callLogs.filter(
    (c) => c.lead_source != null && c.lead_source.length > 0,
  ).length
  const leadSourcePct = pct(withLeadSource, total)

  const dimensions: DataQualityDimension[] = [
    {
      key: 'disposition',
      label: 'Disposition',
      percent: dispositionPct,
      filled: withDisposition,
      total,
      band: band(dispositionPct),
    },
    {
      key: 'summary',
      label: 'Call summaries',
      percent: summaryPct,
      filled: withSummary,
      total,
      band: band(summaryPct),
    },
    {
      key: 'revenue',
      label: 'Revenue on bookings',
      percent: revenuePct,
      filled: bookedWithRevenue,
      total: bookedLogs.length,
      band: band(revenuePct),
    },
    {
      key: 'serviceAttribution',
      label: 'Service attribution',
      percent: serviceAttrPct,
      filled: withServiceMatch,
      total,
      band: band(serviceAttrPct),
    },
    {
      key: 'leadSource',
      label: 'Lead source',
      percent: leadSourcePct,
      filled: withLeadSource,
      total,
      band: band(leadSourcePct),
    },
  ]

  // ── Overall score (weighted average) ────────────────────────────────────
  // Weights reflect business importance
  const weights: Record<string, number> = {
    disposition: 25,
    summary: 20,
    revenue: 25,
    serviceAttribution: 20,
    leadSource: 10,
  }

  let weightedSum = 0
  let weightTotal = 0
  for (const dim of dimensions) {
    const w = weights[dim.key] ?? 10
    // Skip dimensions with no data (e.g. 0 booked calls → revenue not applicable)
    if (dim.total > 0) {
      weightedSum += dim.percent * w
      weightTotal += w
    }
  }

  const overallScore = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 0

  // ── Improvement suggestions (max 3, highest-impact first) ───────────────
  const improvements: DataQualityImprovement[] = []

  if (services.length === 0) {
    improvements.push({
      id: 'add-services',
      label: 'Add services & pricing to enable revenue attribution',
      href: '/dashboard/settings',
    })
  } else if (serviceAttrPct < 60) {
    improvements.push({
      id: 'add-aliases',
      label: 'Add service aliases to improve attribution accuracy',
      href: '/dashboard/settings',
    })
  }

  if (bookedLogs.length > 0 && revenuePct < 70) {
    improvements.push({
      id: 'update-pricing',
      label: 'Update service pricing for more accurate ROI reporting',
      href: '/dashboard/settings',
    })
  }

  if (!opts?.hasIntegrations) {
    improvements.push({
      id: 'connect-integration',
      label: 'Connect a CRM integration for automated lead delivery',
      href: '/dashboard/integrations',
    })
  }

  if (leadSourcePct < 30 && improvements.length < 3) {
    improvements.push({
      id: 'lead-source',
      label: 'Configure lead source tracking on your call agent',
    })
  }

  if (dispositionPct < 50 && improvements.length < 3) {
    improvements.push({
      id: 'disposition',
      label: 'Enable call disposition tagging in your AI agent config',
    })
  }

  return {
    overallScore,
    overallBand: band(overallScore),
    dimensions: dimensions.filter((d) => d.total > 0), // hide N/A dimensions
    improvements: improvements.slice(0, 3),
    totalCalls: total,
  }
}
