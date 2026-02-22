/**
 * /api/conversations/[conversationId] — tenant-scoped conversation detail.
 *
 * GET   → full conversation with message thread
 * PATCH → update conversation status or mark as read
 *
 * Auth: tenant-scoped via resolveTenantAccess().
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getConversationWithMessages } from '@/lib/chat/query'
import { updateConversationStatus, markConversationRead } from '@/lib/chat/mutations'

// ── GET: conversation detail with messages ──────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const { conversationId } = await params

  const result = await getConversationWithMessages(tenant.id, conversationId)

  if (!result.conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  return NextResponse.json(result)
}

// ── PATCH: update status or mark read ───────────────────────────────────────

const PatchSchema = z.object({
  action: z.enum(['update_status', 'mark_read']),
  status: z.enum(['new', 'active', 'qualified', 'booked', 'closed_won', 'closed_lost', 'spam']).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const { conversationId } = await params

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

  const { action, status } = parsed.data

  if (action === 'mark_read') {
    const result = await markConversationRead(tenant.id, conversationId)
    return NextResponse.json(result)
  }

  if (action === 'update_status' && status) {
    const result = await updateConversationStatus(tenant.id, conversationId, status)
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
