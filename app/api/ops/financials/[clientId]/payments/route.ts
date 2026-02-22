/**
 * POST /api/ops/financials/[clientId]/payments
 *
 * Create a manual payment log entry for a client.
 * Operator-only — guarded by resolveOperatorAccess().
 *
 * Stripe-ready: the source field defaults to 'manual' but supports
 * 'stripe' and 'imported' for future webhook integration.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { logOperatorAction } from '@/lib/ops/audit'
import { createPaymentLog } from '@/lib/ops-financials/mutations'
import { logFinancialEvent } from '@/lib/ops-financials/mutations'

export const dynamic = 'force-dynamic'

const CreatePaymentSchema = z.object({
  paymentType: z.enum(['setup_fee', 'retainer', 'overage', 'other']),
  amount: z.number().positive().max(9_999_999),
  currency: z.string().min(3).max(3).optional().default('USD'),
  status: z.enum(['pending', 'paid', 'failed', 'refunded', 'partial']),
  paidAt: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
  source: z.enum(['manual', 'stripe', 'imported']).optional().default('manual'),
  externalPaymentId: z.string().max(255).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export async function POST(
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

  const parsed = CreatePaymentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const operatorLabel = access.email ?? access.userId ?? 'unknown'

  const result = await createPaymentLog(clientId, {
    ...parsed.data,
    createdBy: operatorLabel,
  })

  if (!result) {
    return NextResponse.json({ error: 'Failed to create payment log' }, { status: 500 })
  }

  // Audit + financial event log
  await Promise.all([
    logOperatorAction({
      operatorId: access.userId ?? 'unknown',
      operatorEmail: access.email,
      action: 'client_payment_logged',
      targetClientId: clientId,
      metadata: {
        paymentType: parsed.data.paymentType,
        amount: parsed.data.amount,
        status: parsed.data.status,
        source: parsed.data.source,
      },
    }),
    logFinancialEvent(
      clientId,
      'payment_logged',
      {
        paymentId: result.id,
        paymentType: parsed.data.paymentType,
        amount: parsed.data.amount,
        status: parsed.data.status,
      },
      operatorLabel,
    ),
  ])

  return NextResponse.json({ success: true, data: result })
}
