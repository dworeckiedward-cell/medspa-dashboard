/**
 * Workspace Team & Access — domain types.
 *
 * Types for team members, invitations, and workspace activity.
 * Mirrors the schema defined in migration 013.
 */

import type { WorkspaceRole } from '@/lib/auth/rbac'

// ── Team members ─────────────────────────────────────────────────────────────

export interface WorkspaceMember {
  id: string                    // user_tenants.id
  userId: string
  clientId: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  role: WorkspaceRole
  joinedAt: string              // ISO 8601
  lastActiveAt: string | null   // ISO 8601
}

// ── Invitations ──────────────────────────────────────────────────────────────

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export interface WorkspaceInvite {
  id: string
  clientId: string
  email: string
  role: WorkspaceRole
  status: InviteStatus
  invitedBy: string             // user ID of inviter
  inviterEmail: string | null
  token: string                 // secure invite token
  expiresAt: string             // ISO 8601
  createdAt: string             // ISO 8601
  acceptedAt: string | null     // ISO 8601
}

// ── Workspace activity ───────────────────────────────────────────────────────

export type WorkspaceActivityAction =
  | 'member_invited'
  | 'member_joined'
  | 'member_removed'
  | 'role_changed'
  | 'invite_revoked'
  | 'branding_updated'
  | 'service_created'
  | 'service_updated'
  | 'service_deleted'
  | 'integration_connected'
  | 'integration_disconnected'
  | 'settings_updated'
  | 'logo_updated'

export interface WorkspaceActivity {
  id: string
  clientId: string
  actorId: string               // user who performed the action
  actorEmail: string | null
  action: WorkspaceActivityAction
  description: string           // human-readable description
  metadata: Record<string, unknown>
  createdAt: string             // ISO 8601
}

// ── API payloads ─────────────────────────────────────────────────────────────

export interface InviteTeammatePayload {
  email: string
  role: WorkspaceRole
}

export interface ChangeRolePayload {
  role: WorkspaceRole
}
