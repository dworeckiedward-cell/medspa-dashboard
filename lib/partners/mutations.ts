/**
 * Partner program — server-side mutations.
 *
 * Internal-only. All mutations use service-role client.
 * Status changes should be audited (console log + optional DB).
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { CommissionStatus } from './types'

// ── Commission status transitions ────────────────────────────────────────────

const VALID_TRANSITIONS: Record<CommissionStatus, CommissionStatus[]> = {
  pending: ['eligible', 'held', 'canceled'],
  eligible: ['approved', 'held', 'canceled'],
  approved: ['paid', 'held', 'canceled'],
  paid: [], // terminal
  held: ['eligible', 'approved', 'canceled'],
  canceled: [], // terminal
}

export async function updateCommissionStatus(
  commissionId: string,
  newStatus: CommissionStatus,
  opts?: { notes?: string; operatorId?: string },
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServerClient()

  try {
    // Fetch current status
    const { data: current, error: fetchError } = await supabase
      .from('partner_commissions')
      .select('id, status')
      .eq('id', commissionId)
      .maybeSingle()

    if (fetchError || !current) {
      return { success: false, error: 'Commission not found' }
    }

    const currentStatus = current.status as CommissionStatus
    const allowed = VALID_TRANSITIONS[currentStatus] ?? []

    if (!allowed.includes(newStatus)) {
      return {
        success: false,
        error: `Cannot transition from '${currentStatus}' to '${newStatus}'`,
      }
    }

    // Build update payload
    const update: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    }

    if (newStatus === 'eligible') update.eligible_at = new Date().toISOString()
    if (newStatus === 'approved') update.approved_at = new Date().toISOString()
    if (newStatus === 'paid') update.paid_at = new Date().toISOString()
    if (opts?.notes) update.notes = opts.notes

    const { error: updateError } = await supabase
      .from('partner_commissions')
      .update(update)
      .eq('id', commissionId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Audit log (console)
    console.info(
      JSON.stringify({
        level: 'audit',
        timestamp: new Date().toISOString(),
        action: 'commission_status_changed',
        commission_id: commissionId,
        from_status: currentStatus,
        to_status: newStatus,
        operator_id: opts?.operatorId ?? 'unknown',
        notes: opts?.notes ?? null,
      }),
    )

    return { success: true }
  } catch {
    return { success: false, error: 'Unexpected error' }
  }
}

/** Update partner status */
export async function updatePartnerStatus(
  partnerId: string,
  newStatus: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServerClient()

  try {
    const { error } = await supabase
      .from('partners')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', partnerId)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch {
    return { success: false, error: 'Unexpected error' }
  }
}
