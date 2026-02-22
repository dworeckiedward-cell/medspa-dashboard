/**
 * /api/support/[requestId] — tenant-scoped request detail.
 *
 * GET   → request detail with update timeline and SLA info
 * PATCH → add a comment or reopen a resolved request
 *
 * Auth: tenant-scoped via resolveTenantAccess().
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getRequestWithUpdates } from '@/lib/support/query'
import { addRequestUpdate, transitionRequestStatus } from '@/lib/support/mutations'

// ── GET: request detail ─────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const { requestId } = await params
  const result = await getRequestWithUpdates(tenant.id, requestId)

  if (!result.request) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  return NextResponse.json(result)
}

// ── PATCH: client actions (comment, reopen) ─────────────────────────────────

const PatchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add_comment'),
    body: z.string().min(1).max(5000),
  }),
  z.object({
    action: z.literal('reopen'),
    comment: z.string().max(2000).optional(),
  }),
])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
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

  if (data.action === 'add_comment') {
    const result = await addRequestUpdate({
      requestId,
      clientId: tenant.id,
      authorType: 'client',
      authorLabel: tenant.name,
      visibility: 'public',
      updateType: 'comment',
      body: data.body,
    })
    return NextResponse.json(result)
  }

  if (data.action === 'reopen') {
    const result = await transitionRequestStatus({
      requestId,
      clientId: tenant.id,
      newStatus: 'reopened',
      authorType: 'client',
      authorLabel: tenant.name,
      comment: data.comment ?? 'Reopened by client.',
    })
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
