/**
 * /api/ops/requests/[requestId] — operator-scoped request detail + actions.
 *
 * GET   → request detail with full timeline and SLA info
 * PATCH → transition status, assign, or add operator comment
 *
 * Auth: operator-scoped via resolveOperatorAccess().
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { getOpsRequestWithUpdates } from '@/lib/support/query'
import { transitionRequestStatus, assignRequest } from '@/lib/support/mutations'

// ── GET: request detail ─────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { authorized } = await resolveOperatorAccess()
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { requestId } = await params
  const result = await getOpsRequestWithUpdates(requestId)

  if (!result.request) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  return NextResponse.json(result)
}

// ── PATCH: operator actions ─────────────────────────────────────────────────

const PatchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('transition_status'),
    newStatus: z.enum([
      'open', 'acknowledged', 'in_progress', 'waiting_for_client',
      'resolved', 'closed', 'reopened',
    ]),
    comment: z.string().max(2000).optional(),
  }),
  z.object({
    action: z.literal('assign'),
    assignedTo: z.string().max(200).nullable(),
  }),
])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { authorized, email } = await resolveOperatorAccess()
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { requestId } = await params

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

  const data = parsed.data

  if (data.action === 'transition_status') {
    const result = await transitionRequestStatus({
      requestId,
      newStatus: data.newStatus,
      authorType: 'operator',
      authorLabel: email ?? 'Operator',
      comment: data.comment,
    })
    return NextResponse.json(result)
  }

  if (data.action === 'assign') {
    const result = await assignRequest(requestId, data.assignedTo)
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
