'use client'

/**
 * useRole — client-side hook for role-based UI gating.
 *
 * Provides the current user's role and permission checks.
 * Uses a React context set at the layout level.
 *
 * For now, defaults to 'owner' in demo mode (no auth session).
 * When auth is wired in, the DashboardLayout will inject the real role.
 */

import { createContext, useContext } from 'react'
import { hasPermission, type WorkspaceRole, type Permission } from './rbac'

export interface RoleContextValue {
  role: WorkspaceRole
  can: (permission: Permission) => boolean
  canAll: (permissions: Permission[]) => boolean
  canAny: (permissions: Permission[]) => boolean
}

export const RoleContext = createContext<RoleContextValue>({
  role: 'owner',
  can: (p) => hasPermission('owner', p),
  canAll: (ps) => ps.every((p) => hasPermission('owner', p)),
  canAny: (ps) => ps.some((p) => hasPermission('owner', p)),
})

/**
 * Access the current user's role and permission helpers.
 *
 * Usage:
 *   const { role, can } = useRole()
 *   if (can('billing.manage')) { ... }
 */
export function useRole(): RoleContextValue {
  return useContext(RoleContext)
}
