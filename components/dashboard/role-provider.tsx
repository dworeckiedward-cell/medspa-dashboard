'use client'

/**
 * RoleProvider — provides workspace role context to all dashboard components.
 *
 * Wraps child components with RoleContext so `useRole()` works everywhere.
 * Role defaults to 'owner' in demo mode until auth is wired in.
 */

import { useMemo } from 'react'
import { RoleContext, type RoleContextValue } from '@/lib/auth/use-role'
import { hasPermission, hasAllPermissions, hasAnyPermission, type WorkspaceRole } from '@/lib/auth/rbac'

interface RoleProviderProps {
  role: WorkspaceRole
  children: React.ReactNode
}

export function RoleProvider({ role, children }: RoleProviderProps) {
  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      can: (p) => hasPermission(role, p),
      canAll: (ps) => hasAllPermissions(role, ps),
      canAny: (ps) => hasAnyPermission(role, ps),
    }),
    [role],
  )

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}
