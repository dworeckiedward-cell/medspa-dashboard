/**
 * /api/team/[memberId] — PATCH change role, DELETE remove member.
 *
 * Tenant-scoped via resolveTenantAccess().
 * Permission-gated via RBAC.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getUserRole } from '@/lib/workspace/team-query'
import { changeMemberRole, removeMember } from '@/lib/workspace/team-mutations'
import { logWorkspaceActivity } from '@/lib/workspace/activity'
import { hasPermission, outranks, type WorkspaceRole } from '@/lib/auth/rbac'

// ── PATCH /api/team/[memberId] — change role ────────────────────────────────

const ChangeRoleSchema = z.object({
  role: z.enum(['owner', 'manager', 'staff', 'analyst']),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const { memberId } = await params
  const { tenant, userId } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  // Permission check
  if (userId) {
    const actor = await getUserRole(tenant.id, userId)
    if (actor && !hasPermission(actor.role, 'team.change_role')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
  }

  const body = await request.json()
  const parsed = ChangeRoleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const result = await changeMemberRole(tenant.id, memberId, parsed.data.role as WorkspaceRole)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  // Log activity
  await logWorkspaceActivity({
    clientId: tenant.id,
    actorId: userId ?? 'demo-user',
    actorEmail: null,
    action: 'role_changed',
    description: `Changed member role to ${parsed.data.role}`,
    metadata: { memberId, newRole: parsed.data.role },
  })

  return NextResponse.json({ success: true })
}

// ── DELETE /api/team/[memberId] — remove member ─────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const { memberId } = await params
  const { tenant, userId } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  // Permission check
  if (userId) {
    const actor = await getUserRole(tenant.id, userId)
    if (actor && !hasPermission(actor.role, 'team.remove')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
  }

  const result = await removeMember(tenant.id, memberId)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  // Log activity
  await logWorkspaceActivity({
    clientId: tenant.id,
    actorId: userId ?? 'demo-user',
    actorEmail: null,
    action: 'member_removed',
    description: 'Removed a team member',
    metadata: { memberId },
  })

  return NextResponse.json({ success: true })
}
