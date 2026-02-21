'use client'

/**
 * TeamMembersTable — displays workspace members with role management.
 *
 * Shows team members, their roles, join date, and actions (change role, remove).
 * Actions are gated by the current user's permissions.
 */

import { useState } from 'react'
import { MoreHorizontal, UserMinus, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RoleBadge } from './role-badge'
import type { WorkspaceMember } from '@/lib/workspace/types'
import type { WorkspaceRole } from '@/lib/auth/rbac'
import { ROLE_LABELS, assignableRoles, outranks } from '@/lib/auth/rbac'

interface TeamMembersTableProps {
  members: WorkspaceMember[]
  currentUserRole: WorkspaceRole
  onChangeRole?: (memberId: string, newRole: WorkspaceRole) => void
  onRemoveMember?: (memberId: string) => void
}

export function TeamMembersTable({
  members,
  currentUserRole,
  onChangeRole,
  onRemoveMember,
}: TeamMembersTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const canManageTeam = currentUserRole === 'owner' || currentUserRole === 'manager'
  const canChangeRoles = currentUserRole === 'owner'
  const canRemove = currentUserRole === 'owner'

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  function getInitials(name: string | null, email: string): string {
    if (name) {
      return name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return email.slice(0, 2).toUpperCase()
  }

  return (
    <div className="space-y-1">
      {members.map((member) => {
        const isMenuOpen = openMenuId === member.id
        const rolesAvailable = assignableRoles(currentUserRole)

        return (
          <div
            key={member.id}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-[var(--brand-bg)] transition-colors duration-150"
          >
            {/* Avatar */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-border)] text-[10px] font-semibold text-[var(--brand-muted)]">
              {member.avatarUrl ? (
                <img
                  src={member.avatarUrl}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                getInitials(member.displayName, member.email)
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--brand-text)] truncate">
                  {member.displayName || member.email}
                </span>
                <RoleBadge role={member.role} />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {member.displayName && (
                  <span className="text-[10px] text-[var(--brand-muted)] truncate">
                    {member.email}
                  </span>
                )}
                <span className="text-[10px] text-[var(--brand-muted)]">
                  Joined {formatDate(member.joinedAt)}
                </span>
              </div>
            </div>

            {/* Actions */}
            {canManageTeam && member.role !== 'owner' && (
              <div className="relative shrink-0">
                <button
                  onClick={() => setOpenMenuId(isMenuOpen ? null : member.id)}
                  className="rounded-md p-1.5 text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)]/50 transition-colors"
                  aria-label="Member actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>

                {isMenuOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setOpenMenuId(null)}
                    />
                    {/* Menu */}
                    <div className="absolute right-0 top-8 z-20 w-44 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-lg py-1">
                      {canChangeRoles && rolesAvailable.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wider">
                            Change role
                          </div>
                          {rolesAvailable.map((r) => (
                            <button
                              key={r}
                              onClick={() => {
                                onChangeRole?.(member.id, r)
                                setOpenMenuId(null)
                              }}
                              disabled={r === member.role}
                              className={cn(
                                'w-full text-left px-3 py-1.5 text-xs',
                                r === member.role
                                  ? 'text-[var(--brand-muted)] cursor-default'
                                  : 'text-[var(--brand-text)] hover:bg-[var(--brand-bg)]',
                              )}
                            >
                              {ROLE_LABELS[r]}
                              {r === member.role && ' (current)'}
                            </button>
                          ))}
                          <div className="my-1 border-t border-[var(--brand-border)]" />
                        </>
                      )}

                      {canRemove && (
                        <button
                          onClick={() => {
                            onRemoveMember?.(member.id)
                            setOpenMenuId(null)
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                          Remove member
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}

      {members.length === 0 && (
        <div className="py-6 text-center text-xs text-[var(--brand-muted)]">
          No team members yet
        </div>
      )}
    </div>
  )
}
