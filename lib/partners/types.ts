/**
 * Partner / Affiliate domain types.
 *
 * These types model the internal partner program:
 *   partner → referral → client conversion → commission → payout
 *
 * All monetary amounts in currency minor units (cents) for precision.
 */

// ── Partner ──────────────────────────────────────────────────────────────────

export type PartnerType =
  | 'agency'
  | 'freelancer'
  | 'consultant'
  | 'connector'
  | 'influencer'
  | 'other'

export type PartnerStatus = 'active' | 'paused' | 'onboarding' | 'blocked'

export interface Partner {
  id: string
  name: string
  email: string | null
  type: PartnerType
  status: PartnerStatus
  referralCode: string
  notes: string | null
  payoutMethodType: string | null // 'bank_transfer' | 'paypal' | 'wise' | null
  payoutDetailsMasked: string | null // e.g. '****1234'
  createdAt: string
  updatedAt: string
}

// ── Referral ─────────────────────────────────────────────────────────────────

export type ReferralStatus =
  | 'lead'
  | 'qualified'
  | 'won'
  | 'lost'
  | 'duplicate'
  | 'invalid'

export interface PartnerReferral {
  id: string
  partnerId: string
  clientId: string | null // null until converted
  leadName: string | null
  leadEmail: string | null
  referredAt: string
  status: ReferralStatus
  estimatedValueCents: number | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  /** Joined fields (optional, populated by queries) */
  clientName?: string | null
  partnerName?: string | null
}

// ── Commission ───────────────────────────────────────────────────────────────

export type CommissionBasis = 'flat' | 'percent' | 'hybrid'

export type CommissionTrigger =
  | 'client_signed'
  | 'first_payment'
  | 'monthly_recurring'

export type CommissionStatus =
  | 'pending'
  | 'eligible'
  | 'approved'
  | 'paid'
  | 'held'
  | 'canceled'

export interface PartnerCommission {
  id: string
  partnerId: string
  clientId: string | null
  referralId: string | null
  basisType: CommissionBasis
  /** For flat: amount in cents. For percent: percentage (e.g. 10 = 10%). */
  basisValue: number
  revenueAmountCents: number | null // revenue used for percent calc
  commissionAmountCents: number
  currency: string
  status: CommissionStatus
  eligibleAt: string | null
  approvedAt: string | null
  paidAt: string | null
  payoutBatchId: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  /** Joined fields */
  partnerName?: string | null
  clientName?: string | null
}

// ── Aggregates ───────────────────────────────────────────────────────────────

export interface PartnerSummary {
  partner: Partner
  referralCount: number
  clientCount: number // referrals with status 'won'
  closeRate: number // 0–100
  estimatedCommissionCents: number
  payableCommissionCents: number // status = approved
  paidCommissionCents: number // status = paid
  lastReferralAt: string | null
}

export interface PayoutSummary {
  totalPayableCents: number
  totalPendingReviewCents: number
  totalApprovedUnpaidCents: number
  totalPaidCents: number
  totalHeldCents: number
  currency: string
}
