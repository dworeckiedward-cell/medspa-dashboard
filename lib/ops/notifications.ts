/**
 * Ops — Notifications CRUD.
 *
 * Queries and mutations for the ops_notifications table.
 * These notifications surface in the operator console.
 * Uses service-role client (bypasses RLS).
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'

// ── Types ────────────────────────────────────────────────────────────────────

export type OpsNotificationType =
  | 'prompts_ready'
  | 'invite_created'
  | 'missing_agent_ids'
  | 'clinic_created'
  | 'general'

export interface OpsNotification {
  id: string
  tenantId: string | null
  type: OpsNotificationType
  title: string
  description: string | null
  actionHref: string | null
  isRead: boolean
  createdAt: string
}

interface OpsNotificationRow {
  id: string
  tenant_id: string | null
  type: string
  title: string
  description: string | null
  action_href: string | null
  is_read: boolean
  created_at: string
}

function mapRow(row: OpsNotificationRow): OpsNotification {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    type: row.type as OpsNotificationType,
    title: row.title,
    description: row.description,
    actionHref: row.action_href,
    isRead: row.is_read,
    createdAt: row.created_at,
  }
}

// ── Queries ──────────────────────────────────────────────────────────────────

/** Get recent notifications (newest first) */
export async function getOpsNotifications(
  limit = 20,
  includeRead = false,
): Promise<OpsNotification[]> {
  try {
    const supabase = createSupabaseServerClient()
    let query = supabase
      .from('ops_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (!includeRead) {
      query = query.eq('is_read', false)
    }

    const { data, error } = await query
    if (error || !data) return []
    return (data as unknown as OpsNotificationRow[]).map(mapRow)
  } catch {
    return []
  }
}

/** Count unread notifications */
export async function countUnreadNotifications(): Promise<number> {
  try {
    const supabase = createSupabaseServerClient()
    const { count, error } = await supabase
      .from('ops_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)

    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

// ── Mutations ────────────────────────────────────────────────────────────────

/** Mark a notification as read */
export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    const supabase = createSupabaseServerClient()
    await supabase
      .from('ops_notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
  } catch {
    // Graceful
  }
}

/** Mark all notifications as read */
export async function markAllNotificationsRead(): Promise<void> {
  try {
    const supabase = createSupabaseServerClient()
    await supabase
      .from('ops_notifications')
      .update({ is_read: true })
      .eq('is_read', false)
  } catch {
    // Graceful
  }
}

/** Create a notification */
export async function createOpsNotification(input: {
  tenantId?: string | null
  type: OpsNotificationType
  title: string
  description?: string | null
  actionHref?: string | null
}): Promise<void> {
  try {
    const supabase = createSupabaseServerClient()
    await supabase.from('ops_notifications').insert({
      tenant_id: input.tenantId ?? null,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      action_href: input.actionHref ?? null,
      is_read: false,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Graceful
  }
}
