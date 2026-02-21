/**
 * /api/team/activity — GET workspace activity feed.
 *
 * Tenant-scoped via resolveTenantAccess().
 */

import { NextResponse } from 'next/server'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getUserRole } from '@/lib/workspace/team-query'
import { listWorkspaceActivity } from '@/lib/workspace/team-query'
import { hasPermission } from '@/lib/auth/rbac'

export async function GET() {
  const { tenant, userId } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  // Permission check — need activity.view
  if (userId) {
    const actor = await getUserRole(tenant.id, userId)
    if (actor && !hasPermission(actor.role, 'activity.view')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
  }

  const activity = await listWorkspaceActivity(tenant.id, 30)

  return NextResponse.json({ activity })
}
