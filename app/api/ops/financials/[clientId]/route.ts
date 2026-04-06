/**
 * GET  /api/ops/financials/[clientId] — Full financial detail for one client.
 * PATCH /api/ops/financials/[clientId] — Update financial profile fields.
 *
 * Operator-only — guarded by resolveOperatorAccess().
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { logOperatorAction } from '@/lib/ops/audit'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getClientCommercialDetail } from '@/lib/ops-financials/query'
import { upsertFinancialProfile } from '@/lib/ops-financials/mutations'
import { logFinancialEvent } from '@/lib/ops-financials/mutations'
import { buildClientUnitEconomics } from '@/lib/ops/unit-economics/calc'
import { getClientCacRow } from '@/lib/ops/unit-economics/query'
import type { Client } from '@/types/database'

export const dynamic = 'force-dynamic'

// ── GET ───────────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const access = await resolveOperatorAccess()
  if (!access.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { clientId } = await params
  if (!clientId) {
    return NextResponse.json({ error: 'Client ID required' }, { status: 400 })
  }

  try {
    // Fetch client
    const supabase = createSupabaseServerClient()
    const { data: clientData, error: clientError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', clientId)
      .maybeSingle()

    if (clientError || !clientData) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const client = clientData as unknown as Client

    // Build unit economics
    const cacRow = await getClientCacRow(clientId)
    const { data: fpRow } = await supabase
      .from('client_financial_profiles')
      .select('retainer_amount')
      .eq('client_id', clientId)
      .maybeSingle()
    const unitEcon = buildClientUnitEconomics(client, cacRow, null, fpRow?.retainer_amount)

    // Build commercial detail
    const detail = await getClientCommercialDetail(client, unitEcon)

    // Audit log
    logOperatorAction({
      operatorId: access.userId ?? 'unknown',
      operatorEmail: access.email,
      action: 'client_financial_detail_viewed',
      targetClientId: clientId,
      targetClientSlug: client.slug,
    }).catch(() => {})

    return NextResponse.json({
      snapshot: detail.snapshot,
      profile: detail.profile,
      payments: detail.payments,
      unitEconomics: unitEcon,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────

const PatchSchema = z.object({
  ltvManualAmount: z.number().min(0).max(9_999_999).nullable().optional(),
  ltvMode: z.enum(['auto', 'manual']).optional(),
  mrrIncluded: z.boolean().optional(),
  setupFeeAmount: z.number().min(0).max(999_999).nullable().optional(),
  setupFeeStatus: z.enum(['not_set', 'unpaid', 'partial', 'paid', 'waived']).optional(),
  setupFeePaidAmount: z.number().min(0).max(999_999).nullable().optional(),
  setupFeeInvoicedAt: z.string().nullable().optional(),
  setupFeePaidAt: z.string().nullable().optional(),
  retainerAmount: z.number().min(0).max(999_999).nullable().optional(),
  retainerStatus: z.enum(['not_set', 'active_paid', 'due', 'overdue', 'partial', 'paused', 'canceled']).optional(),
  billingCycleDay: z.number().int().min(1).max(31).nullable().optional(),
  lastPaidAt: z.string().nullable().optional(),
  nextDueAt: z.string().nullable().optional(),
  billingNotes: z.string().max(2000).nullable().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const access = await resolveOperatorAccess()
  if (!access.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { clientId } = await params
  if (!clientId) {
    return NextResponse.json({ error: 'Client ID required' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const result = await upsertFinancialProfile(clientId, parsed.data)
  if (!result) {
    return NextResponse.json({ error: 'Failed to save financial profile' }, { status: 500 })
  }

  // Audit + financial event log
  const operatorLabel = access.email ?? access.userId ?? 'unknown'

  await Promise.all([
    logOperatorAction({
      operatorId: access.userId ?? 'unknown',
      operatorEmail: access.email,
      action: 'client_financial_profile_updated',
      targetClientId: clientId,
      metadata: { fields: Object.keys(parsed.data) },
    }),
    logFinancialEvent(
      clientId,
      'profile_updated',
      parsed.data as unknown as Record<string, unknown>,
      operatorLabel,
    ),
  ])

  return NextResponse.json({ success: true, data: result })
}
