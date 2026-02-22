/**
 * /api/ops/conversations — operator-scoped cross-tenant conversation overview.
 *
 * Returns per-tenant conversation stats: total, open, unread, booked-from-chat.
 * Auth: operator-only via resolveOperatorAccess().
 */

import { NextResponse } from 'next/server'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { getOpsConversationOverviews } from '@/lib/chat/query'

export async function GET() {
  const access = await resolveOperatorAccess()
  if (!access.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const overviews = await getOpsConversationOverviews()

  // Aggregate stats
  const totalConversations = overviews.reduce((sum, o) => sum + o.totalConversations, 0)
  const totalOpen = overviews.reduce((sum, o) => sum + o.openConversations, 0)
  const totalUnread = overviews.reduce((sum, o) => sum + o.unreadCount, 0)
  const totalBooked = overviews.reduce((sum, o) => sum + o.bookedFromChat, 0)
  const activeTenants = overviews.filter((o) => o.totalConversations > 0).length

  return NextResponse.json({
    overviews,
    stats: {
      totalConversations,
      totalOpen,
      totalUnread,
      totalBooked,
      activeTenants,
    },
  })
}
