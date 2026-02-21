'use client'

/**
 * RolePermissionsCard — displays the role → permission matrix.
 *
 * Shows which permissions each role has, helping workspace owners
 * understand what access levels mean.
 */

import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ROLE_PERMISSIONS,
  ROLE_LABELS,
  PERMISSION_LABELS,
  hasPermission,
  type WorkspaceRole,
  type Permission,
} from '@/lib/auth/rbac'

// Group permissions by category for cleaner display
const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  {
    label: 'Team',
    permissions: ['team.view', 'team.invite', 'team.remove', 'team.change_role'],
  },
  {
    label: 'Operations',
    permissions: ['calls.view', 'calls.follow_up', 'services.view', 'services.edit'],
  },
  {
    label: 'Configuration',
    permissions: ['branding.view', 'branding.edit', 'integrations.view', 'integrations.manage'],
  },
  {
    label: 'Business',
    permissions: ['reports.view', 'billing.view', 'billing.manage'],
  },
  {
    label: 'System',
    permissions: ['activity.view', 'settings.advanced', 'workspace.danger_zone'],
  },
]

const ROLES: WorkspaceRole[] = ['owner', 'manager', 'staff', 'analyst']

export function RolePermissionsCard() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left py-2 pr-4 text-[var(--brand-muted)] font-medium">
              Permission
            </th>
            {ROLES.map((role) => (
              <th
                key={role}
                className="text-center py-2 px-2 text-[var(--brand-muted)] font-medium"
              >
                {ROLE_LABELS[role]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_GROUPS.map((group) => (
            <>
              {/* Group header */}
              <tr key={`group-${group.label}`}>
                <td
                  colSpan={5}
                  className="pt-3 pb-1 text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider"
                >
                  {group.label}
                </td>
              </tr>
              {/* Permission rows */}
              {group.permissions.map((perm) => (
                <tr
                  key={perm}
                  className="border-b border-[var(--brand-border)]/50 last:border-0"
                >
                  <td className="py-1.5 pr-4 text-[var(--brand-text)]">
                    {PERMISSION_LABELS[perm]}
                  </td>
                  {ROLES.map((role) => {
                    const has = hasPermission(role, perm)
                    return (
                      <td key={role} className="text-center py-1.5 px-2">
                        {has ? (
                          <CheckCircle2 className="inline-block h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <XCircle className="inline-block h-3.5 w-3.5 text-[var(--brand-border)]" />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}
