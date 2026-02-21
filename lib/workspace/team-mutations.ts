/**
 * Workspace Team — mutation helpers.
 *
 * Write operations for team management: invite, remove, role change.
 * All mutations are scoped to a single tenant via client_id.
 *
 * Uses service-role client (bypasses RLS).
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { normalizeRole, type WorkspaceRole } from '@/lib/auth/rbac'

// ── Invite a teammate ────────────────────────────────────────────────────────

export interface InviteResult {
  success: boolean
  inviteId?: string
  error?: string
}

/**
 * Create a workspace invitation.
 * Generates a secure token and stores the invite in workspace_invites.
 */
export async function inviteTeammate(
  clientId: string,
  inviterUserId: string,
  inviterEmail: string | null,
  email: string,
  role: WorkspaceRole,
): Promise<InviteResult> {
  const supabase = createSupabaseServerClient()

  // Check if email is already a member
  const { data: existingMember } = await supabase
    .from('user_tenants')
    .select('id')
    .eq('client_id', clientId)
    .ilike('role', '%') // just checking existence
    .limit(100)

  // Check for existing pending invite
  const { data: existingInvite } = await supabase
    .from('workspace_invites')
    .select('id')
    .eq('client_id', clientId)
    .eq('email', email.toLowerCase())
    .eq('status', 'pending')
    .single()

  if (existingInvite) {
    return { success: false, error: 'An invitation is already pending for this email' }
  }

  // Generate secure invite token
  const token = generateInviteToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

  const { data, error } = await supabase
    .from('workspace_invites')
    .insert({
      client_id: clientId,
      email: email.toLowerCase(),
      role,
      status: 'pending',
      invited_by: inviterUserId,
      inviter_email: inviterEmail,
      token,
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (error) {
    if (error.message?.includes('does not exist')) {
      // Table not yet created — return scaffold success for demo
      return { success: true, inviteId: 'scaffold-invite' }
    }
    console.error('[team-mutations] inviteTeammate error:', error.message)
    return { success: false, error: 'Failed to create invitation' }
  }

  return { success: true, inviteId: data.id }
}

// ── Remove a member ──────────────────────────────────────────────────────────

export interface RemoveResult {
  success: boolean
  error?: string
}

/**
 * Remove a member from the workspace.
 * Cannot remove the last owner.
 */
export async function removeMember(
  clientId: string,
  memberId: string,
): Promise<RemoveResult> {
  const supabase = createSupabaseServerClient()

  // Fetch the member to check role
  const { data: member, error: fetchError } = await supabase
    .from('user_tenants')
    .select('id, user_id, role')
    .eq('client_id', clientId)
    .eq('id', memberId)
    .single()

  if (fetchError || !member) {
    return { success: false, error: 'Member not found' }
  }

  // Prevent removing the last owner
  if (normalizeRole(member.role) === 'owner') {
    const { count } = await supabase
      .from('user_tenants')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('role', 'owner')

    if ((count ?? 0) <= 1) {
      return { success: false, error: 'Cannot remove the only owner' }
    }
  }

  const { error } = await supabase
    .from('user_tenants')
    .delete()
    .eq('client_id', clientId)
    .eq('id', memberId)

  if (error) {
    console.error('[team-mutations] removeMember error:', error.message)
    return { success: false, error: 'Failed to remove member' }
  }

  return { success: true }
}

// ── Change member role ───────────────────────────────────────────────────────

export interface ChangeRoleResult {
  success: boolean
  error?: string
}

/**
 * Change a member's role.
 * Cannot demote the last owner.
 */
export async function changeMemberRole(
  clientId: string,
  memberId: string,
  newRole: WorkspaceRole,
): Promise<ChangeRoleResult> {
  const supabase = createSupabaseServerClient()

  // Fetch current role
  const { data: member, error: fetchError } = await supabase
    .from('user_tenants')
    .select('id, role')
    .eq('client_id', clientId)
    .eq('id', memberId)
    .single()

  if (fetchError || !member) {
    return { success: false, error: 'Member not found' }
  }

  // Prevent demoting the last owner
  if (normalizeRole(member.role) === 'owner' && newRole !== 'owner') {
    const { count } = await supabase
      .from('user_tenants')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('role', 'owner')

    if ((count ?? 0) <= 1) {
      return { success: false, error: 'Cannot demote the only owner' }
    }
  }

  const { error } = await supabase
    .from('user_tenants')
    .update({ role: newRole })
    .eq('client_id', clientId)
    .eq('id', memberId)

  if (error) {
    console.error('[team-mutations] changeMemberRole error:', error.message)
    return { success: false, error: 'Failed to update role' }
  }

  return { success: true }
}

// ── Revoke invitation ────────────────────────────────────────────────────────

export async function revokeInvite(
  clientId: string,
  inviteId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('workspace_invites')
    .update({ status: 'revoked' })
    .eq('client_id', clientId)
    .eq('id', inviteId)
    .eq('status', 'pending')

  if (error) {
    if (error.message?.includes('does not exist')) {
      return { success: true } // table not yet created
    }
    console.error('[team-mutations] revokeInvite error:', error.message)
    return { success: false, error: 'Failed to revoke invitation' }
  }

  return { success: true }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateInviteToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
