/**
 * Unified metrics dispatcher — routes to the correct computation based on mode.
 *
 * IMPORTANT: This file only dispatches. It does NOT rewrite or alter existing
 * metric calculations. Each mode's math lives in its own module:
 *   - inbound_clinic → getDashboardMetrics (lib/dashboard/metrics.ts)
 *   - outbound_db    → computeOutboundMetrics (lib/dashboard/outbound-metrics.ts)
 *   - fb_leads       → computeFbLeadsMetrics (lib/dashboard/fb-leads-metrics.ts)
 */

import type { DashboardMode } from '@/lib/ops/get-client-type'
import type { DashboardMetrics, CallLog } from '@/types/database'
import type { OutboundMetrics } from './outbound-metrics'
import type { FbLeadsMetrics } from './fb-leads-metrics'
import { getDashboardMetrics } from './metrics'
import { computeOutboundMetrics } from './outbound-metrics'
import { computeFbLeadsMetrics } from './fb-leads-metrics'

// ── Discriminated union result ──────────────────────────────────────────────

export type ModeMetrics =
  | { mode: 'inbound_clinic'; data: DashboardMetrics }
  | { mode: 'outbound_db'; data: OutboundMetrics }
  | { mode: 'fb_leads'; data: FbLeadsMetrics }

/**
 * Compute metrics for the given dashboard mode.
 *
 * - `inbound_clinic`: Uses getDashboardMetrics (DB query, async).
 * - `outbound_db`: Uses computeOutboundMetrics (pure, from call logs).
 * - `fb_leads`: Uses computeFbLeadsMetrics (pure, from call logs).
 */
export async function computeMetricsForMode(
  mode: DashboardMode,
  clientId: string,
  callLogs: CallLog[],
  rangeDays: number,
): Promise<ModeMetrics> {
  switch (mode) {
    case 'inbound_clinic':
      return { mode, data: await getDashboardMetrics(clientId, rangeDays) }
    case 'outbound_db':
      return { mode, data: computeOutboundMetrics(callLogs, rangeDays) }
    case 'fb_leads':
      return { mode, data: computeFbLeadsMetrics(callLogs, rangeDays) }
  }
}
