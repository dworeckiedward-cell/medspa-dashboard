/**
 * Unit Economics — Cohort & Source Aggregation (Ops-Only)
 *
 * Pure computation functions that aggregate unit economics data
 * into cohort (by acquisition month) and CAC source breakdowns.
 *
 * IMPORTANT: Cohort month uses acquired_at when available, falling
 * back to client.created_at. The hasFallbackDates flag indicates
 * when fallback was used, so ops UI can show appropriate footnotes.
 */

import type {
  ClientUnitEconomics,
  CohortRow,
  CacSourceRow,
  CacSource,
  LtvConfidence,
} from './types'

// ── Cohort aggregation (by acquisition month) ───────────────────────────────

/**
 * Group clients by acquisition month and compute aggregate metrics.
 * Returns sorted by cohort month (most recent first).
 */
export function buildCohortRows(economics: ClientUnitEconomics[]): CohortRow[] {
  const cohortMap = new Map<string, {
    clients: ClientUnitEconomics[]
    hasFallbackDates: boolean
  }>()

  for (const e of economics) {
    // Use acquired_at if available, else fall back to firstPaymentAt (client.created_at)
    const dateStr = e.acquiredAt ?? e.firstPaymentAt
    if (!dateStr) continue

    const date = new Date(dateStr)
    const cohortMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const usedFallback = !e.acquiredAt

    const existing = cohortMap.get(cohortMonth)
    if (existing) {
      existing.clients.push(e)
      if (usedFallback) existing.hasFallbackDates = true
    } else {
      cohortMap.set(cohortMonth, {
        clients: [e],
        hasFallbackDates: usedFallback,
      })
    }
  }

  const rows: CohortRow[] = []
  const entries = Array.from(cohortMap.entries())

  for (const [cohortMonth, { clients, hasFallbackDates }] of entries) {
    const clientsCount = clients.length
    const totalCac = clients.reduce((s: number, c: ClientUnitEconomics) => s + (c.cacAmount ?? 0), 0)
    const totalLtv = clients.reduce((s: number, c: ClientUnitEconomics) => s + c.totalCollectedLtv, 0)
    const clientsWithCac = clients.filter((c: ClientUnitEconomics) => c.cacAmount !== null && c.cacAmount > 0)
    const avgCac = clientsWithCac.length > 0
      ? Math.round(totalCac / clientsWithCac.length)
      : 0
    const avgLtv = clientsCount > 0 ? Math.round(totalLtv / clientsCount) : 0
    const avgLtvCacRatio = avgCac > 0 ? Math.round((avgLtv / avgCac) * 100) / 100 : null
    const recoveredCount = clients.filter(
      (c: ClientUnitEconomics) => c.paybackStatus === 'recovered' || c.paybackStatus === 'highly_profitable',
    ).length

    // LTV confidence is the lowest confidence among clients in the cohort
    const confidences = clients.map((c: ClientUnitEconomics) => c.ltvConfidence)
    const cohortConfidence: LtvConfidence = confidences.includes('estimated')
      ? 'estimated'
      : confidences.includes('derived')
        ? 'derived'
        : 'exact'

    rows.push({
      cohortMonth,
      clientsCount,
      totalCac,
      totalLtv,
      avgCac,
      avgLtv,
      avgLtvCacRatio,
      recoveredCount,
      cohortConfidence,
      hasFallbackDates,
    })
  }

  // Sort by cohort month descending (most recent first)
  rows.sort((a, b) => b.cohortMonth.localeCompare(a.cohortMonth))

  return rows
}

// ── CAC by source aggregation ───────────────────────────────────────────────

/**
 * Group clients by CAC source and compute aggregate metrics.
 * Returns sorted by total LTV descending (best-performing sources first).
 */
export function buildCacSourceRows(economics: ClientUnitEconomics[]): CacSourceRow[] {
  const sourceMap = new Map<CacSource, ClientUnitEconomics[]>()

  // Collect clients with a known source
  for (const e of economics) {
    if (!e.cacSource) continue
    const existing = sourceMap.get(e.cacSource)
    if (existing) {
      existing.push(e)
    } else {
      sourceMap.set(e.cacSource, [e])
    }
  }

  // Count clients missing CAC source
  const missingSourceCount = economics.filter((e: ClientUnitEconomics) => !e.cacSource).length

  const rows: CacSourceRow[] = []
  const sourceEntries = Array.from(sourceMap.entries())

  for (const [source, clients] of sourceEntries) {
    const clientsCount = clients.length
    const clientsWithCac = clients.filter((c: ClientUnitEconomics) => c.cacAmount !== null && c.cacAmount > 0)
    const totalCac = clients.reduce((s: number, c: ClientUnitEconomics) => s + (c.cacAmount ?? 0), 0)
    const totalLtv = clients.reduce((s: number, c: ClientUnitEconomics) => s + c.totalCollectedLtv, 0)
    const avgCac = clientsWithCac.length > 0
      ? Math.round(totalCac / clientsWithCac.length)
      : 0
    const avgLtv = clientsCount > 0 ? Math.round(totalLtv / clientsCount) : 0
    const avgLtvCacRatio = avgCac > 0 ? Math.round((avgLtv / avgCac) * 100) / 100 : null
    const recoveredCount = clients.filter(
      (c: ClientUnitEconomics) => c.paybackStatus === 'recovered' || c.paybackStatus === 'highly_profitable',
    ).length
    const missingCacCount = clients.filter((c: ClientUnitEconomics) => c.cacAmount === null).length

    rows.push({
      source,
      clientsCount,
      totalCac,
      avgCac,
      totalLtv,
      avgLtv,
      avgLtvCacRatio,
      recoveredCount,
      missingCacCount,
    })
  }

  // Sort by total LTV descending
  rows.sort((a, b) => b.totalLtv - a.totalLtv)

  // If there are unclassified clients, add an "other" catch-all
  if (missingSourceCount > 0 && !sourceMap.has('other')) {
    const unclassified = economics.filter((e: ClientUnitEconomics) => !e.cacSource)
    rows.push({
      source: 'other',
      clientsCount: unclassified.length,
      totalCac: 0,
      avgCac: 0,
      totalLtv: unclassified.reduce((s: number, c: ClientUnitEconomics) => s + c.totalCollectedLtv, 0),
      avgLtv: unclassified.length > 0
        ? Math.round(unclassified.reduce((s: number, c: ClientUnitEconomics) => s + c.totalCollectedLtv, 0) / unclassified.length)
        : 0,
      avgLtvCacRatio: null,
      recoveredCount: unclassified.filter(
        (c: ClientUnitEconomics) => c.paybackStatus === 'recovered' || c.paybackStatus === 'highly_profitable',
      ).length,
      missingCacCount: unclassified.length,
    })
  }

  return rows
}
