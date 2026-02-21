/**
 * Workspace Activity Logger — tenant-scoped audit trail.
 *
 * Distinct from ops audit (lib/ops/audit.ts) which tracks operator actions.
 * This logs workspace member actions for the team activity feed.
 *
 * Dual-write: console (structured JSON) + optional DB table.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { WorkspaceActivityAction } from './types'

export interface LogActivityParams {
  clientId: string
  actorId: string
  actorEmail: string | null
  action: WorkspaceActivityAction
  description: string
  metadata?: Record<string, unknown>
}

/**
 * Log a workspace activity event.
 * Writes to DB if table exists, always logs to console.
 */
export async function logWorkspaceActivity(params: LogActivityParams): Promise<void> {
  const timestamp = new Date().toISOString()

  // Always log to console (structured JSON)
  console.info(
    JSON.stringify({
      level: 'workspace_activity',
      timestamp,
      client_id: params.clientId,
      actor_id: params.actorId,
      actor_email: params.actorEmail,
      action: params.action,
      description: params.description,
      metadata: params.metadata ?? {},
    }),
  )

  // Attempt DB write (graceful if table doesn't exist)
  try {
    const supabase = createSupabaseServerClient()
    await supabase.from('workspace_activity').insert({
      client_id: params.clientId,
      actor_id: params.actorId,
      actor_email: params.actorEmail,
      action: params.action,
      description: params.description,
      metadata: params.metadata ?? {},
      created_at: timestamp,
    })
  } catch {
    // Table likely doesn't exist yet — console log is the fallback
  }
}
