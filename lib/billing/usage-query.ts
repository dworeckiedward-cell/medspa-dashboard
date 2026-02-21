/**
 * Usage Query — data source adapter for tenant usage metering.
 *
 * ── Current implementation ───────────────────────────────────────────────
 *
 * Metering is NOT connected yet. This adapter provides two modes:
 *
 * 1. **Derived** — estimates usage from call_logs (count + duration proxy)
 *    Confidence: "derived" — labeled honestly in the UI
 *
 * 2. **Scaffold** — returns demo data for tenants with no call activity
 *    Confidence: "estimated" — placeholder until metering is wired
 *
 * ── Future integration point ────────────────────────────────────────────
 *
 * To connect real metering (e.g. Stripe Usage Records, Retell usage API):
 *   1. Replace `fetchRealUsage()` below with actual provider call
 *   2. Set `isMeteringConnected: true`
 *   3. Set `confidence: 'exact'`
 *   4. The rest of the pipeline (types, computeAllowance, UI) just works
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { startOfMonth } from 'date-fns'
import {
  computeAllowance,
  buildUsageSummary,
  getMockUsageSummary,
} from './usage'
import type { UsageSummary } from './types'

// ── Plan defaults (scaffold) ────────────────────────────────────────────────
// These represent a typical "Growth" plan allowance.
// TODO: Replace with plan lookup from billing provider once Stripe is integrated.

const DEFAULT_PLAN_ALLOWANCES = {
  ai_call_minutes: { included: 500, overageRateCents: 50 },
  calls_handled: { included: 200, overageRateCents: null },
} as const

// ── Tenant usage query ─────────────────────────────────────────────────────

/**
 * Fetch usage summary for a tenant.
 *
 * Attempts to derive usage from call_logs first. If no call data is available,
 * returns the scaffold summary (estimated).
 */
export async function getTenantUsageSummary(tenantId: string): Promise<UsageSummary> {
  // ── Step 1: Try real metering source ────────────────────────────────────
  // TODO: Uncomment when metering provider is integrated
  // const realUsage = await fetchRealUsage(tenantId)
  // if (realUsage) return realUsage

  // ── Step 2: Derive from call_logs ──────────────────────────────────────
  const derived = await deriveUsageFromCallLogs(tenantId)
  if (derived) return derived

  // ── Step 3: Scaffold fallback ──────────────────────────────────────────
  return getMockUsageSummary(tenantId)
}

/**
 * Derive usage estimates from call_logs for the current billing month.
 * Returns null if no call data is available (falls through to scaffold).
 */
async function deriveUsageFromCallLogs(tenantId: string): Promise<UsageSummary | null> {
  const supabase = createSupabaseServerClient()
  const monthStart = startOfMonth(new Date()).toISOString()

  const { data: calls, error } = await supabase
    .from('call_logs')
    .select('id, duration_seconds, created_at')
    .eq('client_id', tenantId)
    .gte('created_at', monthStart)

  if (error || !calls || calls.length === 0) {
    return null
  }

  // Derive minutes from duration_seconds (with fallback for null durations)
  const totalMinutes = calls.reduce((sum, c) => {
    const dur = (c as { duration_seconds?: number | null }).duration_seconds
    return sum + (dur != null ? Math.ceil(dur / 60) : 1) // assume 1 min if no duration
  }, 0)

  const callsHandled = calls.length
  const plan = DEFAULT_PLAN_ALLOWANCES

  const allowances = [
    computeAllowance(
      'ai_call_minutes',
      'AI Call Minutes',
      plan.ai_call_minutes.included,
      totalMinutes,
      plan.ai_call_minutes.overageRateCents,
    ),
    computeAllowance(
      'calls_handled',
      'Calls Handled',
      plan.calls_handled.included,
      callsHandled,
      plan.calls_handled.overageRateCents,
    ),
  ]

  return buildUsageSummary(tenantId, allowances, false, 'derived')
}

// ── Cross-tenant usage query (for ops) ─────────────────────────────────────

export interface TenantUsageOverview {
  tenantId: string
  tenantName: string
  tenantSlug: string
  summary: UsageSummary
}

/**
 * Fetch usage summaries for ALL tenants (operator-only).
 * Uses call_logs count as the primary derived metric.
 */
export async function getAllTenantUsageOverviews(): Promise<TenantUsageOverview[]> {
  const supabase = createSupabaseServerClient()
  const monthStart = startOfMonth(new Date()).toISOString()

  // Fetch all active clients
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name')

  if (clientsError || !clients) return []

  // Fetch call counts per client for the current month
  const { data: callData, error: callError } = await supabase
    .from('call_logs')
    .select('client_id, duration_seconds')
    .gte('created_at', monthStart)

  if (callError) {
    // Return scaffold summaries if call data unavailable
    return clients.map((c) => ({
      tenantId: c.id,
      tenantName: c.name,
      tenantSlug: c.slug,
      summary: getMockUsageSummary(c.id),
    }))
  }

  // Aggregate per client
  const callsByClient = new Map<string, { count: number; minutes: number }>()
  for (const call of (callData ?? [])) {
    const existing = callsByClient.get(call.client_id) ?? { count: 0, minutes: 0 }
    const dur = (call as { duration_seconds?: number | null }).duration_seconds
    existing.count++
    existing.minutes += dur != null ? Math.ceil(dur / 60) : 1
    callsByClient.set(call.client_id, existing)
  }

  const plan = DEFAULT_PLAN_ALLOWANCES

  return clients.map((c) => {
    const usage = callsByClient.get(c.id)

    if (!usage || usage.count === 0) {
      return {
        tenantId: c.id,
        tenantName: c.name,
        tenantSlug: c.slug,
        summary: getMockUsageSummary(c.id),
      }
    }

    const allowances = [
      computeAllowance(
        'ai_call_minutes',
        'AI Call Minutes',
        plan.ai_call_minutes.included,
        usage.minutes,
        plan.ai_call_minutes.overageRateCents,
      ),
      computeAllowance(
        'calls_handled',
        'Calls Handled',
        plan.calls_handled.included,
        usage.count,
        plan.calls_handled.overageRateCents,
      ),
    ]

    return {
      tenantId: c.id,
      tenantName: c.name,
      tenantSlug: c.slug,
      summary: buildUsageSummary(c.id, allowances, false, 'derived'),
    }
  })
}

// ── Future: Real metering adapter ──────────────────────────────────────────
// Uncomment and implement when a metering provider is available.
//
// async function fetchRealUsage(tenantId: string): Promise<UsageSummary | null> {
//   // Example: Stripe metered subscription usage
//   // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
//   // const usageRecords = await stripe.subscriptionItems.listUsageRecordSummaries(...)
//   // ... map to computeAllowance() calls ...
//   // return buildUsageSummary(tenantId, allowances, true, 'exact')
//   return null
// }
