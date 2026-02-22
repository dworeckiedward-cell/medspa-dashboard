/**
 * Ops Financials — Query Layer (Internal Only)
 *
 * Reads financial profiles, payment logs, and builds commercial snapshots.
 * All queries use service-role Supabase client (ops-only).
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Client } from '@/types/database'
import type { ClientUnitEconomics } from '@/lib/ops/unit-economics/types'
import type {
  ClientFinancialProfileRow,
  ClientPaymentLogRow,
  ClientFinancialProfile,
  ClientPaymentLog,
  ClientCommercialSnapshot,
  SetupFeeStatus,
  RetainerStatus,
  PaymentType,
  PaymentStatus,
  PaymentSource,
  LtvMode,
} from './types'
import { DEFAULT_FINANCIAL_PROFILE } from './types'
import { buildClientCommercialSnapshot } from './compute'

// ── Row → Domain mappers ──────────────────────────────────────────────────

function mapProfileRow(row: ClientFinancialProfileRow): ClientFinancialProfile {
  return {
    clientId: row.client_id,
    ltvManualAmount: row.ltv_manual_amount,
    ltvCurrency: row.ltv_currency,
    ltvMode: row.ltv_mode as LtvMode,
    mrrIncluded: row.mrr_included,
    setupFeeAmount: row.setup_fee_amount,
    setupFeeCurrency: row.setup_fee_currency,
    setupFeeStatus: row.setup_fee_status as SetupFeeStatus,
    setupFeePaidAmount: row.setup_fee_paid_amount,
    setupFeeInvoicedAt: row.setup_fee_invoiced_at,
    setupFeePaidAt: row.setup_fee_paid_at,
    retainerAmount: row.retainer_amount,
    retainerCurrency: row.retainer_currency,
    retainerStatus: row.retainer_status as RetainerStatus,
    billingCycleDay: row.billing_cycle_day,
    lastPaidAt: row.last_paid_at,
    nextDueAt: row.next_due_at,
    billingNotes: row.billing_notes,
  }
}

function mapPaymentRow(row: ClientPaymentLogRow): ClientPaymentLog {
  return {
    id: row.id,
    clientId: row.client_id,
    paymentType: row.payment_type as PaymentType,
    amount: row.amount,
    currency: row.currency,
    status: row.status as PaymentStatus,
    paidAt: row.paid_at,
    dueAt: row.due_at,
    source: row.source as PaymentSource,
    externalPaymentId: row.external_payment_id,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

// ── Single-client queries ─────────────────────────────────────────────────

/**
 * Get financial profile for a single client. Returns null if not found.
 */
export async function getClientFinancialProfile(
  clientId: string,
): Promise<ClientFinancialProfile | null> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from('client_financial_profiles')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle()

    if (error || !data) return null
    return mapProfileRow(data as unknown as ClientFinancialProfileRow)
  } catch {
    return null
  }
}

/**
 * Get payment logs for a single client, newest first.
 */
export async function getClientPaymentLogs(
  clientId: string,
  limit = 50,
): Promise<ClientPaymentLog[]> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from('client_payment_logs')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return (data as unknown as ClientPaymentLogRow[]).map(mapPaymentRow)
  } catch {
    return []
  }
}

// ── Cross-tenant queries ──────────────────────────────────────────────────

/**
 * Get all financial profiles as a Map keyed by client_id.
 */
export async function getAllFinancialProfiles(): Promise<Map<string, ClientFinancialProfile>> {
  const map = new Map<string, ClientFinancialProfile>()
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from('client_financial_profiles')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error || !data) return map
    for (const row of data as unknown as ClientFinancialProfileRow[]) {
      map.set(row.client_id, mapProfileRow(row))
    }
  } catch {
    // Table may not exist yet — return empty
  }
  return map
}

/**
 * Get all payment logs grouped by client_id.
 */
export async function getAllPaymentLogs(): Promise<Map<string, ClientPaymentLog[]>> {
  const map = new Map<string, ClientPaymentLog[]>()
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from('client_payment_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000) // reasonable upper bound for MVP

    if (error || !data) return map
    for (const row of data as unknown as ClientPaymentLogRow[]) {
      const mapped = mapPaymentRow(row)
      const existing = map.get(mapped.clientId)
      if (existing) {
        existing.push(mapped)
      } else {
        map.set(mapped.clientId, [mapped])
      }
    }
  } catch {
    // Table may not exist yet
  }
  return map
}

// ── Snapshot builders (cross-tenant) ──────────────────────────────────────

/**
 * Build commercial snapshots for all clients, merging all data sources.
 * This is the main entry point for the ops financials overview.
 */
export async function getAllCommercialSnapshots(
  clients: Client[],
  unitEconomics: ClientUnitEconomics[],
): Promise<ClientCommercialSnapshot[]> {
  const [profiles, paymentLogs] = await Promise.all([
    getAllFinancialProfiles(),
    getAllPaymentLogs(),
  ])

  // Build unit economics map
  const econMap = new Map<string, ClientUnitEconomics>()
  for (const e of unitEconomics) {
    econMap.set(e.clientId, e)
  }

  return clients.map((client) =>
    buildClientCommercialSnapshot(
      client,
      profiles.get(client.id) ?? null,
      econMap.get(client.id) ?? null,
      paymentLogs.get(client.id) ?? [],
    ),
  )
}

/**
 * Build a single client's commercial snapshot with full detail.
 */
export async function getClientCommercialDetail(
  client: Client,
  unitEcon: ClientUnitEconomics | null,
): Promise<{
  snapshot: ClientCommercialSnapshot
  profile: ClientFinancialProfile
  payments: ClientPaymentLog[]
}> {
  const [profile, payments] = await Promise.all([
    getClientFinancialProfile(client.id),
    getClientPaymentLogs(client.id),
  ])

  const effectiveProfile = profile ?? { ...DEFAULT_FINANCIAL_PROFILE, clientId: client.id }
  const snapshot = buildClientCommercialSnapshot(client, effectiveProfile, unitEcon, payments)

  return { snapshot, profile: effectiveProfile, payments }
}
