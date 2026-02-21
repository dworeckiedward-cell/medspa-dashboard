/**
 * Workspace Team — query helpers.
 *
 * Read operations for team members, invitations, and activity.
 * All queries are scoped to a single tenant via client_id.
 *
 * Uses service-role client (bypasses RLS) — safe because callers
 * verify identity via resolveTenantAccess() before reaching here.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/rbac'
import type { WorkspaceMember, WorkspaceInvite, WorkspaceActivity } from './types'

// ── Team members ─────────────────────────────────────────────────────────────

/**
 * List all members of a workspace (tenant).
 * Joins user_tenants → auth.users for display info.
 *
 * Falls back to scaffold data if user_tenants table doesn't exist.
 */
export async function listWorkspaceMembers(clientId: string): Promise<WorkspaceMember[]> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('user_tenants')
    .select('id, user_id, client_id, role, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })

  if (error) {
    if (error.message?.includes('does not exist')) {
      return getScaffoldMembers(clientId)
    }
    console.warn('[team-query] listWorkspaceMembers error:', error.message)
    return getScaffoldMembers(clientId)
  }

  if (!data || data.length === 0) {
    return getScaffoldMembers(clientId)
  }

  // Map DB rows to WorkspaceMember
  // Note: auth.users is not directly joinable from user_tenants in Supabase
  // without a view or function. We use available data + email lookup.
  return data.map((row) => ({
    id: row.id,
    userId: row.user_id,
    clientId: row.client_id,
    email: '', // populated by enrichment or scaffold
    displayName: null,
    avatarUrl: null,
    role: normalizeRole(row.role),
    joinedAt: row.created_at,
    lastActiveAt: null,
  }))
}

/**
 * Get a specific member by their user_tenants ID.
 */
export async function getWorkspaceMember(
  clientId: string,
  memberId: string,
): Promise<WorkspaceMember | null> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('user_tenants')
    .select('id, user_id, client_id, role, created_at')
    .eq('client_id', clientId)
    .eq('id', memberId)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    userId: data.user_id,
    clientId: data.client_id,
    email: '',
    displayName: null,
    avatarUrl: null,
    role: normalizeRole(data.role),
    joinedAt: data.created_at,
    lastActiveAt: null,
  }
}

/**
 * Get the current user's role in a workspace.
 * Returns null if user is not a member.
 */
export async function getUserRole(
  clientId: string,
  userId: string,
): Promise<WorkspaceMember | null> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('user_tenants')
    .select('id, user_id, client_id, role, created_at')
    .eq('client_id', clientId)
    .eq('user_id', userId)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    userId: data.user_id,
    clientId: data.client_id,
    email: '',
    displayName: null,
    avatarUrl: null,
    role: normalizeRole(data.role),
    joinedAt: data.created_at,
    lastActiveAt: null,
  }
}

// ── Invitations ──────────────────────────────────────────────────────────────

/**
 * List pending invitations for a workspace.
 */
export async function listWorkspaceInvites(clientId: string): Promise<WorkspaceInvite[]> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('workspace_invites')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    if (error.message?.includes('does not exist')) {
      return [] // table not yet created
    }
    console.warn('[team-query] listWorkspaceInvites error:', error.message)
    return []
  }

  return (data ?? []).map(mapInviteRow)
}

/**
 * Get a specific invite by ID.
 */
export async function getWorkspaceInvite(
  clientId: string,
  inviteId: string,
): Promise<WorkspaceInvite | null> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('workspace_invites')
    .select('*')
    .eq('client_id', clientId)
    .eq('id', inviteId)
    .single()

  if (error || !data) return null
  return mapInviteRow(data)
}

// ── Workspace activity ───────────────────────────────────────────────────────

/**
 * List recent workspace activity entries.
 */
export async function listWorkspaceActivity(
  clientId: string,
  limit = 20,
): Promise<WorkspaceActivity[]> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('workspace_activity')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (error.message?.includes('does not exist')) {
      return getScaffoldActivity(clientId)
    }
    console.warn('[team-query] listWorkspaceActivity error:', error.message)
    return getScaffoldActivity(clientId)
  }

  return (data ?? []).map(mapActivityRow)
}

// ── Row mappers ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapInviteRow(row: any): WorkspaceInvite {
  return {
    id: row.id,
    clientId: row.client_id,
    email: row.email,
    role: normalizeRole(row.role),
    status: row.status,
    invitedBy: row.invited_by,
    inviterEmail: row.inviter_email ?? null,
    token: row.token,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at ?? null,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapActivityRow(row: any): WorkspaceActivity {
  return {
    id: row.id,
    clientId: row.client_id,
    actorId: row.actor_id,
    actorEmail: row.actor_email ?? null,
    action: row.action,
    description: row.description,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }
}

// ── Scaffold data (demo/dev fallback) ────────────────────────────────────────

function getScaffoldMembers(clientId: string): WorkspaceMember[] {
  return [
    {
      id: 'scaffold-owner',
      userId: 'scaffold-user-1',
      clientId,
      email: 'owner@clinic.com',
      displayName: 'Clinic Owner',
      avatarUrl: null,
      role: 'owner',
      joinedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      lastActiveAt: new Date().toISOString(),
    },
    {
      id: 'scaffold-manager',
      userId: 'scaffold-user-2',
      clientId,
      email: 'manager@clinic.com',
      displayName: 'Office Manager',
      avatarUrl: null,
      role: 'manager',
      joinedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      lastActiveAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'scaffold-staff',
      userId: 'scaffold-user-3',
      clientId,
      email: 'staff@clinic.com',
      displayName: 'Front Desk',
      avatarUrl: null,
      role: 'staff',
      joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastActiveAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]
}

function getScaffoldActivity(clientId: string): WorkspaceActivity[] {
  const now = Date.now()
  return [
    {
      id: 'scaffold-activity-1',
      clientId,
      actorId: 'scaffold-user-1',
      actorEmail: 'owner@clinic.com',
      action: 'member_invited',
      description: 'Invited staff@clinic.com as Staff',
      metadata: { inviteeEmail: 'staff@clinic.com', role: 'staff' },
      createdAt: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'scaffold-activity-2',
      clientId,
      actorId: 'scaffold-user-3',
      actorEmail: 'staff@clinic.com',
      action: 'member_joined',
      description: 'staff@clinic.com joined the workspace',
      metadata: {},
      createdAt: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'scaffold-activity-3',
      clientId,
      actorId: 'scaffold-user-2',
      actorEmail: 'manager@clinic.com',
      action: 'branding_updated',
      description: 'Updated clinic logo',
      metadata: {},
      createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'scaffold-activity-4',
      clientId,
      actorId: 'scaffold-user-1',
      actorEmail: 'owner@clinic.com',
      action: 'service_created',
      description: 'Added service "Botox Treatment"',
      metadata: { serviceName: 'Botox Treatment' },
      createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]
}
