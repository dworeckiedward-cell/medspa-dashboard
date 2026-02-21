/**
 * /api/team — GET members list, POST invite teammate.
 *
 * Tenant-scoped via resolveTenantAccess().
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { listWorkspaceMembers, listWorkspaceInvites, getUserRole } from '@/lib/workspace/team-query'
import { inviteTeammate } from '@/lib/workspace/team-mutations'
import { logWorkspaceActivity } from '@/lib/workspace/activity'
import { hasPermission, normalizeRole } from '@/lib/auth/rbac'
import type { WorkspaceRole } from '@/lib/auth/rbac'

// ── GET /api/team — list members + pending invites ──────────────────────────

export async function GET() {
  const { tenant, userId } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const [members, invites] = await Promise.all([
    listWorkspaceMembers(tenant.id),
    listWorkspaceInvites(tenant.id),
  ])

  return NextResponse.json({ members, invites })
}

// ── POST /api/team — invite a teammate ──────────────────────────────────────

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'manager', 'staff', 'analyst']),
})

export async function POST(request: Request) {
  const { tenant, userId } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  // Permission check — need team.invite
  if (userId) {
    const actor = await getUserRole(tenant.id, userId)
    if (actor && !hasPermission(actor.role, 'team.invite')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
  }

  const body = await request.json()
  const parsed = InviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const { email, role } = parsed.data

  const result = await inviteTeammate(
    tenant.id,
    userId ?? 'demo-user',
    null, // inviter email — would come from auth
    email,
    role as WorkspaceRole,
  )

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  // Log activity
  await logWorkspaceActivity({
    clientId: tenant.id,
    actorId: userId ?? 'demo-user',
    actorEmail: null,
    action: 'member_invited',
    description: `Invited ${email} as ${role}`,
    metadata: { inviteeEmail: email, role },
  })

  return NextResponse.json({ success: true, inviteId: result.inviteId })
}
