import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { FollowUpTask, FollowUpTaskType, FollowUpPriority } from '@/lib/types/domain'

/**
 * Derives follow-up tasks from call_logs where human_followup_needed = true.
 * Groups by caller_phone, returns one task per unique lead needing follow-up.
 */
export async function getFollowUpTasks(clientId: string): Promise<FollowUpTask[]> {
  const supabase = createSupabaseServerClient()

  const { data: rows, error } = await supabase
    .from('call_logs')
    .select(
      'id, client_id, caller_name, caller_phone, disposition, intent, human_followup_needed, human_followup_reason, is_booked, is_lead, created_at, updated_at, semantic_title, ai_summary',
    )
    .eq('client_id', clientId)
    .eq('human_followup_needed', true)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error || !rows) {
    console.error('[followup-query] Failed to fetch follow-up calls:', error?.message)
    return []
  }

  return rows.map((row) => {
    // Derive task type from disposition / intent
    let taskType: FollowUpTaskType = 'callback'
    if (row.disposition === 'follow_up') taskType = 'callback'
    else if (row.intent === 'book_appointment') taskType = 'callback'
    else if (row.disposition === 'not_interested') taskType = 'reactivation'
    else taskType = 'human_review'

    // Priority: booked interest = high, lead = medium, other = low
    let priority: FollowUpPriority = 'low'
    if (row.intent === 'book_appointment' || row.is_lead) priority = 'high'
    else if (row.disposition === 'follow_up') priority = 'medium'

    // Due at = created_at + 4 hours for callback, 24h for reactivation
    const createdMs = Date.parse(row.created_at)
    const offsetMs = taskType === 'reactivation' ? 24 * 3600_000 : 4 * 3600_000
    const dueAt = new Date(createdMs + offsetMs).toISOString()

    return {
      id: row.id,
      tenantId: clientId,
      contactId: row.id,
      taskType,
      status: 'open' as const,
      reason: row.human_followup_reason ?? row.ai_summary ?? row.semantic_title ?? 'Follow-up needed',
      dueAt,
      priority,
      suggestedAction: row.intent === 'book_appointment'
        ? 'Call back to confirm booking interest'
        : row.disposition === 'follow_up'
          ? 'Follow up on inquiry'
          : null,
      suggestedScript: null,
      assignedTo: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
      contact: {
        id: row.id,
        tenantId: clientId,
        fullName: row.caller_name ?? row.caller_phone ?? 'Unknown',
        phone: row.caller_phone ?? '',
        email: null,
        tags: [],
        source: 'phone',
        status: row.is_booked ? 'booked' as const : 'contacted' as const,
        ownerType: 'ai' as const,
        priorityScore: priority === 'high' ? 80 : priority === 'medium' ? 50 : 30,
        lastCallAt: row.created_at,
        nextActionAt: dueAt,
        createdAt: row.created_at,
        updatedAt: row.updated_at ?? row.created_at,
      },
    } satisfies FollowUpTask
  })
}
