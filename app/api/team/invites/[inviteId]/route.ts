/**
 * /api/team/invites/[inviteId] — DELETE revoke invitation.
 *
 * Tenant-scoped via resolveTenantAccess().
 */

import { NextResponse } from 'next/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getUserRole } from '@/lib/workspace/team-query'
import { revokeInvite } from '@/lib/workspace/team-mutations'
import { logWorkspaceActivity } from '@/lib/workspace/activity'
import { hasPermission } from '@/lib/auth/rbac'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  const { inviteId } = await params
  const { tenant, userId } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  // Permission check — need team.invite (same permission for revoking)
  if (userId) {
    const actor = await getUserRole(tenant.id, userId)
    if (actor && !hasPermission(actor.role, 'team.invite')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
  }

  const result = await revokeInvite(tenant.id, inviteId)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  // Log activity
  await logWorkspaceActivity({
    clientId: tenant.id,
    actorId: userId ?? 'demo-user',
    actorEmail: null,
    action: 'invite_revoked',
    description: 'Revoked a pending invitation',
    metadata: { inviteId },
  })

  return NextResponse.json({ success: true })
}
