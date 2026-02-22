/**
 * Ops Financials — Mutations (Internal Only)
 *
 * Write operations for financial profiles and payment logs.
 * All mutations use service-role Supabase client (ops-only).
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type {
  ClientFinancialProfileRow,
  ClientPaymentLogRow,
  FinancialProfileUpdatePayload,
  CreatePaymentLogPayload,
} from './types'

// ── Financial Profile ─────────────────────────────────────────────────────

/**
 * Upsert a client's financial profile. Creates if not exists, updates if exists.
 */
export async function upsertFinancialProfile(
  clientId: string,
  payload: FinancialProfileUpdatePayload,
): Promise<ClientFinancialProfileRow | null> {
  const supabase = createSupabaseServerClient()
  const now = new Date().toISOString()

  // Build DB row from payload (only set fields that are provided)
  const dbRow: Record<string, unknown> = {
    client_id: clientId,
    updated_at: now,
  }

  if (payload.ltvManualAmount !== undefined) dbRow.ltv_manual_amount = payload.ltvManualAmount
  if (payload.ltvMode !== undefined) dbRow.ltv_mode = payload.ltvMode
  if (payload.mrrIncluded !== undefined) dbRow.mrr_included = payload.mrrIncluded
  if (payload.setupFeeAmount !== undefined) dbRow.setup_fee_amount = payload.setupFeeAmount
  if (payload.setupFeeStatus !== undefined) dbRow.setup_fee_status = payload.setupFeeStatus
  if (payload.setupFeePaidAmount !== undefined) dbRow.setup_fee_paid_amount = payload.setupFeePaidAmount
  if (payload.setupFeeInvoicedAt !== undefined) dbRow.setup_fee_invoiced_at = payload.setupFeeInvoicedAt
  if (payload.setupFeePaidAt !== undefined) dbRow.setup_fee_paid_at = payload.setupFeePaidAt
  if (payload.retainerAmount !== undefined) dbRow.retainer_amount = payload.retainerAmount
  if (payload.retainerStatus !== undefined) dbRow.retainer_status = payload.retainerStatus
  if (payload.billingCycleDay !== undefined) dbRow.billing_cycle_day = payload.billingCycleDay
  if (payload.lastPaidAt !== undefined) dbRow.last_paid_at = payload.lastPaidAt
  if (payload.nextDueAt !== undefined) dbRow.next_due_at = payload.nextDueAt
  if (payload.billingNotes !== undefined) dbRow.billing_notes = payload.billingNotes

  try {
    const { data, error } = await supabase
      .from('client_financial_profiles')
      .upsert(
        { ...dbRow, created_at: now },
        { onConflict: 'client_id' },
      )
      .select('*')
      .single()

    if (error || !data) return null
    return data as unknown as ClientFinancialProfileRow
  } catch {
    return null
  }
}

// ── Payment Logs ──────────────────────────────────────────────────────────

/**
 * Create a new payment log entry.
 */
export async function createPaymentLog(
  clientId: string,
  payload: CreatePaymentLogPayload,
): Promise<ClientPaymentLogRow | null> {
  const supabase = createSupabaseServerClient()

  const dbRow = {
    client_id: clientId,
    payment_type: payload.paymentType,
    amount: payload.amount,
    currency: payload.currency ?? 'USD',
    status: payload.status,
    paid_at: payload.paidAt ?? null,
    due_at: payload.dueAt ?? null,
    source: payload.source ?? 'manual',
    external_payment_id: payload.externalPaymentId ?? null,
    notes: payload.notes ?? null,
    created_by: payload.createdBy ?? null,
    created_at: new Date().toISOString(),
  }

  try {
    const { data, error } = await supabase
      .from('client_payment_logs')
      .insert(dbRow)
      .select('*')
      .single()

    if (error || !data) return null
    return data as unknown as ClientPaymentLogRow
  } catch {
    return null
  }
}

/**
 * Update a payment log entry's status, paid_at, or notes.
 */
export async function updatePaymentLog(
  paymentId: string,
  update: { status?: string; paidAt?: string | null; notes?: string | null },
): Promise<ClientPaymentLogRow | null> {
  const supabase = createSupabaseServerClient()

  const dbUpdate: Record<string, unknown> = {}
  if (update.status !== undefined) dbUpdate.status = update.status
  if (update.paidAt !== undefined) dbUpdate.paid_at = update.paidAt
  if (update.notes !== undefined) dbUpdate.notes = update.notes

  if (Object.keys(dbUpdate).length === 0) return null

  try {
    const { data, error } = await supabase
      .from('client_payment_logs')
      .update(dbUpdate)
      .eq('id', paymentId)
      .select('*')
      .single()

    if (error || !data) return null
    return data as unknown as ClientPaymentLogRow
  } catch {
    return null
  }
}

// ── Financial Events (audit trail) ────────────────────────────────────────

/**
 * Log a financial event for audit purposes.
 */
export async function logFinancialEvent(
  clientId: string,
  eventType: string,
  payload: Record<string, unknown>,
  actorLabel: string | null,
): Promise<void> {
  try {
    const supabase = createSupabaseServerClient()
    await supabase.from('client_financial_events').insert({
      client_id: clientId,
      event_type: eventType,
      payload,
      actor_label: actorLabel,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Graceful — table may not exist yet
  }
}
