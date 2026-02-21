/**
 * Partner program — server-side query helpers.
 *
 * All queries use service-role client (internal/admin only).
 * Never call from client-facing routes.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type {
  Partner,
  PartnerReferral,
  PartnerCommission,
  PartnerSummary,
  PayoutSummary,
} from './types'

// ── Row mappers ──────────────────────────────────────────────────────────────

function mapPartnerRow(row: Record<string, unknown>): Partner {
  return {
    id: row.id as string,
    name: row.name as string,
    email: (row.email as string) ?? null,
    type: (row.type as Partner['type']) ?? 'other',
    status: (row.status as Partner['status']) ?? 'onboarding',
    referralCode: row.referral_code as string,
    notes: (row.notes as string) ?? null,
    payoutMethodType: (row.payout_method_type as string) ?? null,
    payoutDetailsMasked: (row.payout_details_masked as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function mapReferralRow(row: Record<string, unknown>): PartnerReferral {
  return {
    id: row.id as string,
    partnerId: row.partner_id as string,
    clientId: (row.client_id as string) ?? null,
    leadName: (row.lead_name as string) ?? null,
    leadEmail: (row.lead_email as string) ?? null,
    referredAt: row.referred_at as string,
    status: (row.status as PartnerReferral['status']) ?? 'lead',
    estimatedValueCents: (row.estimated_value_cents as number) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function mapCommissionRow(row: Record<string, unknown>): PartnerCommission {
  return {
    id: row.id as string,
    partnerId: row.partner_id as string,
    clientId: (row.client_id as string) ?? null,
    referralId: (row.referral_id as string) ?? null,
    basisType: (row.basis_type as PartnerCommission['basisType']) ?? 'flat',
    basisValue: Number(row.basis_value) ?? 0,
    revenueAmountCents: (row.revenue_amount_cents as number) ?? null,
    commissionAmountCents: (row.commission_amount_cents as number) ?? 0,
    currency: (row.currency as string) ?? 'usd',
    status: (row.status as PartnerCommission['status']) ?? 'pending',
    eligibleAt: (row.eligible_at as string) ?? null,
    approvedAt: (row.approved_at as string) ?? null,
    paidAt: (row.paid_at as string) ?? null,
    payoutBatchId: (row.payout_batch_id as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

// ── Partners ─────────────────────────────────────────────────────────────────

export async function listPartners(): Promise<Partner[]> {
  const supabase = createSupabaseServerClient()
  try {
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      if (error.message?.includes('does not exist')) return []
      console.error('[partners] listPartners error:', error.message)
      return []
    }
    return (data ?? []).map((r) => mapPartnerRow(r as Record<string, unknown>))
  } catch {
    return []
  }
}

export async function getPartner(partnerId: string): Promise<Partner | null> {
  const supabase = createSupabaseServerClient()
  try {
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .eq('id', partnerId)
      .maybeSingle()

    if (error || !data) return null
    return mapPartnerRow(data as Record<string, unknown>)
  } catch {
    return null
  }
}

// ── Referrals ────────────────────────────────────────────────────────────────

export async function listReferrals(partnerId?: string): Promise<PartnerReferral[]> {
  const supabase = createSupabaseServerClient()
  try {
    let query = supabase
      .from('partner_referrals')
      .select('*')
      .order('referred_at', { ascending: false })

    if (partnerId) {
      query = query.eq('partner_id', partnerId)
    }

    const { data, error } = await query
    if (error) {
      if (error.message?.includes('does not exist')) return []
      console.error('[partners] listReferrals error:', error.message)
      return []
    }
    return (data ?? []).map((r) => mapReferralRow(r as Record<string, unknown>))
  } catch {
    return []
  }
}

// ── Commissions ──────────────────────────────────────────────────────────────

export async function listCommissions(partnerId?: string): Promise<PartnerCommission[]> {
  const supabase = createSupabaseServerClient()
  try {
    let query = supabase
      .from('partner_commissions')
      .select('*')
      .order('created_at', { ascending: false })

    if (partnerId) {
      query = query.eq('partner_id', partnerId)
    }

    const { data, error } = await query
    if (error) {
      if (error.message?.includes('does not exist')) return []
      console.error('[partners] listCommissions error:', error.message)
      return []
    }
    return (data ?? []).map((r) => mapCommissionRow(r as Record<string, unknown>))
  } catch {
    return []
  }
}

// ── Aggregates ───────────────────────────────────────────────────────────────

/**
 * Build PartnerSummary for each partner (pure computation from pre-fetched data).
 */
export function buildPartnerSummaries(
  partners: Partner[],
  referrals: PartnerReferral[],
  commissions: PartnerCommission[],
): PartnerSummary[] {
  return partners.map((partner) => {
    const partnerRefs = referrals.filter((r) => r.partnerId === partner.id)
    const partnerComms = commissions.filter((c) => c.partnerId === partner.id)

    const referralCount = partnerRefs.length
    const clientCount = partnerRefs.filter((r) => r.status === 'won').length
    const closeRate = referralCount > 0 ? Math.round((clientCount / referralCount) * 100) : 0

    const estimatedCommissionCents = partnerComms.reduce(
      (s, c) => s + c.commissionAmountCents,
      0,
    )
    const payableCommissionCents = partnerComms
      .filter((c) => c.status === 'approved')
      .reduce((s, c) => s + c.commissionAmountCents, 0)
    const paidCommissionCents = partnerComms
      .filter((c) => c.status === 'paid')
      .reduce((s, c) => s + c.commissionAmountCents, 0)

    const lastReferralAt = partnerRefs.length > 0 ? partnerRefs[0].referredAt : null

    return {
      partner,
      referralCount,
      clientCount,
      closeRate,
      estimatedCommissionCents,
      payableCommissionCents,
      paidCommissionCents,
      lastReferralAt,
    }
  })
}

/**
 * Compute payout summary across all commissions.
 */
export function computePayoutSummary(
  commissions: PartnerCommission[],
  currency = 'usd',
): PayoutSummary {
  let totalPayableCents = 0
  let totalPendingReviewCents = 0
  let totalApprovedUnpaidCents = 0
  let totalPaidCents = 0
  let totalHeldCents = 0

  for (const c of commissions) {
    switch (c.status) {
      case 'pending':
      case 'eligible':
        totalPendingReviewCents += c.commissionAmountCents
        totalPayableCents += c.commissionAmountCents
        break
      case 'approved':
        totalApprovedUnpaidCents += c.commissionAmountCents
        totalPayableCents += c.commissionAmountCents
        break
      case 'paid':
        totalPaidCents += c.commissionAmountCents
        break
      case 'held':
        totalHeldCents += c.commissionAmountCents
        break
    }
  }

  return {
    totalPayableCents,
    totalPendingReviewCents,
    totalApprovedUnpaidCents,
    totalPaidCents,
    totalHeldCents,
    currency,
  }
}
