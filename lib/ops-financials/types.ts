/**
 * Ops Financials — Type Definitions (Internal Only)
 *
 * Covers billing profiles, payment logs, setup fees, retainer tracking,
 * and commercial snapshot types. CAC types remain in lib/ops/unit-economics/.
 */

// ── Setup Fee ──────────────────────────────────────────────────────────────

export type SetupFeeStatus = 'not_set' | 'unpaid' | 'partial' | 'paid' | 'waived'

export const SETUP_FEE_STATUS_LABELS: Record<SetupFeeStatus, string> = {
  not_set: 'Not Set',
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
  waived: 'Waived',
}

export const SETUP_FEE_STATUS_COLORS: Record<SetupFeeStatus, { bg: string; text: string; dot: string }> = {
  not_set: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' },
  unpaid: { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  partial: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  paid: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  waived: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
}

// ── Retainer ───────────────────────────────────────────────────────────────

export type RetainerStatus =
  | 'not_set'
  | 'active_paid'
  | 'due'
  | 'overdue'
  | 'partial'
  | 'paused'
  | 'canceled'

export const RETAINER_STATUS_LABELS: Record<RetainerStatus, string> = {
  not_set: 'Not Set',
  active_paid: 'Active',
  due: 'Due',
  overdue: 'Overdue',
  partial: 'Partial',
  paused: 'Paused',
  canceled: 'Canceled',
}

export const RETAINER_STATUS_COLORS: Record<RetainerStatus, { bg: string; text: string; dot: string }> = {
  not_set: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' },
  active_paid: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  due: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  overdue: { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  partial: { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  paused: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  canceled: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-500', dot: 'bg-gray-400' },
}

// ── Payment ────────────────────────────────────────────────────────────────

export type PaymentType = 'setup_fee' | 'retainer' | 'overage' | 'other'

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  setup_fee: 'Setup Fee',
  retainer: 'Retainer',
  overage: 'Overage',
  other: 'Other',
}

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partial'

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
  partial: 'Partial',
}

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, { bg: string; text: string; dot: string }> = {
  pending: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  paid: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  failed: { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  refunded: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  partial: { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
}

export type PaymentSource = 'manual' | 'stripe' | 'imported'

export const PAYMENT_SOURCE_LABELS: Record<PaymentSource, string> = {
  manual: 'Manual',
  stripe: 'Stripe',
  imported: 'Imported',
}

// ── LTV ────────────────────────────────────────────────────────────────────

export type LtvMode = 'auto' | 'manual'

export type FinancialLtvConfidence = 'exact' | 'derived' | 'manual' | 'estimated'

export const LTV_CONFIDENCE_LABELS: Record<FinancialLtvConfidence, string> = {
  exact: 'Exact (Stripe)',
  derived: 'Derived (billing)',
  manual: 'Manual',
  estimated: 'Estimated',
}

// ── DB Row Types ───────────────────────────────────────────────────────────

export interface ClientFinancialProfileRow {
  id: string
  client_id: string
  ltv_manual_amount: number | null
  ltv_currency: string
  ltv_mode: string
  mrr_included: boolean
  setup_fee_amount: number | null
  setup_fee_currency: string
  setup_fee_status: string
  setup_fee_paid_amount: number | null
  setup_fee_invoiced_at: string | null
  setup_fee_paid_at: string | null
  retainer_amount: number | null
  retainer_currency: string
  retainer_status: string
  billing_cycle_day: number | null
  last_paid_at: string | null
  next_due_at: string | null
  billing_notes: string | null
  created_at: string
  updated_at: string
}

export interface ClientPaymentLogRow {
  id: string
  client_id: string
  payment_type: string
  amount: number
  currency: string
  status: string
  paid_at: string | null
  due_at: string | null
  source: string
  external_payment_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

// ── Domain Types (computed / enriched) ─────────────────────────────────────

export interface ClientFinancialProfile {
  clientId: string
  ltvManualAmount: number | null
  ltvCurrency: string
  ltvMode: LtvMode
  mrrIncluded: boolean
  setupFeeAmount: number | null
  setupFeeCurrency: string
  setupFeeStatus: SetupFeeStatus
  setupFeePaidAmount: number | null
  setupFeeInvoicedAt: string | null
  setupFeePaidAt: string | null
  retainerAmount: number | null
  retainerCurrency: string
  retainerStatus: RetainerStatus
  billingCycleDay: number | null
  lastPaidAt: string | null
  nextDueAt: string | null
  billingNotes: string | null
}

export interface ClientPaymentLog {
  id: string
  clientId: string
  paymentType: PaymentType
  amount: number
  currency: string
  status: PaymentStatus
  paidAt: string | null
  dueAt: string | null
  source: PaymentSource
  externalPaymentId: string | null
  notes: string | null
  createdBy: string | null
  createdAt: string
}

/** Combined financial snapshot for a single client (ops view) */
export interface ClientCommercialSnapshot {
  clientId: string
  clientName: string
  clientSlug: string
  isActive: boolean

  // CAC (from unit economics)
  cacAmount: number | null
  cacSource: string | null

  // LTV (merged: manual override or derived)
  ltvAmount: number
  ltvConfidence: FinancialLtvConfidence
  ltvMode: LtvMode

  // Ratios
  ltvCacRatio: number | null

  // MRR
  mrrIncluded: boolean
  retainerAmount: number | null

  // Billing statuses
  setupFeeStatus: SetupFeeStatus
  setupFeeAmount: number | null
  retainerStatus: RetainerStatus

  // Dates
  lastPaidAt: string | null
  nextDueAt: string | null

  // Collected (from payment logs)
  totalCollected: number
  collectedThisMonth: number
  paymentsCount: number
}

/** Summary KPIs for the ops financial strip */
export interface OpsFinancialKpis {
  activeMrr: number
  mrrClientCount: number
  collectedThisMonth: number
  overdueRetainerCount: number
  unpaidSetupFeeCount: number
  avgLtvCacRatio: number | null
  clientsWithBothCount: number
}

// ── Update Payloads (for API validation) ───────────────────────────────────

export interface FinancialProfileUpdatePayload {
  ltvManualAmount?: number | null
  ltvMode?: LtvMode
  mrrIncluded?: boolean
  setupFeeAmount?: number | null
  setupFeeStatus?: SetupFeeStatus
  setupFeePaidAmount?: number | null
  setupFeeInvoicedAt?: string | null
  setupFeePaidAt?: string | null
  retainerAmount?: number | null
  retainerStatus?: RetainerStatus
  billingCycleDay?: number | null
  lastPaidAt?: string | null
  nextDueAt?: string | null
  billingNotes?: string | null
}

export interface CreatePaymentLogPayload {
  paymentType: PaymentType
  amount: number
  currency?: string
  status: PaymentStatus
  paidAt?: string | null
  dueAt?: string | null
  source?: PaymentSource
  externalPaymentId?: string | null
  notes?: string | null
  createdBy?: string | null
}

// ── Default values ─────────────────────────────────────────────────────────

export const DEFAULT_FINANCIAL_PROFILE: ClientFinancialProfile = {
  clientId: '',
  ltvManualAmount: null,
  ltvCurrency: 'USD',
  ltvMode: 'auto',
  mrrIncluded: true,
  setupFeeAmount: null,
  setupFeeCurrency: 'USD',
  setupFeeStatus: 'not_set',
  setupFeePaidAmount: null,
  setupFeeInvoicedAt: null,
  setupFeePaidAt: null,
  retainerAmount: null,
  retainerCurrency: 'USD',
  retainerStatus: 'not_set',
  billingCycleDay: null,
  lastPaidAt: null,
  nextDueAt: null,
  billingNotes: null,
}
