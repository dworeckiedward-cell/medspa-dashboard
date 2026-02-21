'use client'

/**
 * TeamAccessSection — full team & access management section for Settings.
 *
 * Combines: team members table, invite form, pending invites, role permissions,
 * and workspace activity feed into a single composable section.
 *
 * Fetches team data client-side from /api/team.
 */

import { useState, useEffect, useCallback } from 'react'
import { Users, ChevronDown, ChevronUp, Clock, X, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TeamMembersTable } from './team-members-table'
import { InviteTeammateForm } from './invite-teammate-form'
import { RoleBadge } from './role-badge'
import { RolePermissionsCard } from './role-permissions-card'
import { WorkspaceActivityFeed } from './workspace-activity-feed'
import type { WorkspaceMember, WorkspaceInvite } from '@/lib/workspace/types'
import type { WorkspaceRole } from '@/lib/auth/rbac'

interface TeamAccessSectionProps {
  /** Current user's role — determines what actions are available */
  currentUserRole: WorkspaceRole
}

export function TeamAccessSection({ currentUserRole }: TeamAccessSectionProps) {
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [showPermissions, setShowPermissions] = useState(false)
  const [showActivity, setShowActivity] = useState(false)

  const canInvite = currentUserRole === 'owner' || currentUserRole === 'manager'

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch('/api/team')
      if (!res.ok) return
      const data = await res.json()
      setMembers(data.members ?? [])
      setInvites(data.invites ?? [])
    } catch {
      // silent — uses scaffold data from server
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

  async function handleChangeRole(memberId: string, newRole: WorkspaceRole) {
    try {
      const res = await fetch(`/api/team/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        fetchTeam() // refresh
      }
    } catch {
      // silent
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('Remove this team member? They will lose access to this workspace.')) return

    try {
      const res = await fetch(`/api/team/${memberId}`, { method: 'DELETE' })
      if (res.ok) {
        fetchTeam()
      }
    } catch {
      // silent
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    try {
      const res = await fetch(`/api/team/invites/${inviteId}`, { method: 'DELETE' })
      if (res.ok) {
        fetchTeam()
      }
    } catch {
      // silent
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-[var(--brand-border)]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-36 rounded bg-[var(--brand-border)]" />
              <div className="h-2.5 w-24 rounded bg-[var(--brand-border)]/60" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Team count header */}
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-[var(--brand-muted)]" />
        <span className="text-xs text-[var(--brand-muted)]">
          {members.length} member{members.length !== 1 ? 's' : ''}
          {invites.length > 0 && ` · ${invites.length} pending`}
        </span>
      </div>

      {/* Members list */}
      <TeamMembersTable
        members={members}
        currentUserRole={currentUserRole}
        onChangeRole={handleChangeRole}
        onRemoveMember={handleRemoveMember}
      />

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider">
            Pending Invitations
          </h4>
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2 bg-[var(--brand-bg)] border border-dashed border-[var(--brand-border)]"
            >
              <Mail className="h-4 w-4 shrink-0 text-[var(--brand-muted)]" />
              <div className="min-w-0 flex-1">
                <span className="text-xs text-[var(--brand-text)]">{invite.email}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <RoleBadge role={invite.role} />
                  <span className="text-[10px] text-[var(--brand-muted)] flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    Expires {new Date(invite.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              {canInvite && (
                <button
                  onClick={() => handleRevokeInvite(invite.id)}
                  className="shrink-0 rounded-md p-1 text-[var(--brand-muted)] hover:text-rose-500 transition-colors"
                  title="Revoke invitation"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Invite form */}
      {canInvite && (
        <div className="space-y-2 pt-2 border-t border-[var(--brand-border)]">
          <h4 className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider">
            Invite Teammate
          </h4>
          <InviteTeammateForm
            currentUserRole={currentUserRole}
            onInviteSent={fetchTeam}
          />
        </div>
      )}

      {/* Role permissions toggle */}
      <button
        onClick={() => setShowPermissions(!showPermissions)}
        className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
      >
        {showPermissions ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        {showPermissions ? 'Hide' : 'View'} role permissions
      </button>

      {showPermissions && (
        <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-4">
          <RolePermissionsCard />
        </div>
      )}

      {/* Activity feed toggle */}
      <button
        onClick={() => setShowActivity(!showActivity)}
        className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
      >
        {showActivity ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        {showActivity ? 'Hide' : 'View'} workspace activity
      </button>

      {showActivity && (
        <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-4">
          <WorkspaceActivityFeed />
        </div>
      )}
    </div>
  )
}
