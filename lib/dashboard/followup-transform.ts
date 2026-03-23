import type { FollowUpTask, FollowUpTaskType, FollowUpPriority } from '@/lib/types/domain'

/**
 * Pure-JS version of getFollowUpTasks — no Supabase dependency.
 * Accepts a full call_logs row array, filters human_followup_needed=true,
 * and returns FollowUpTask[]. Safe to call client-side.
 */
type Row = Record<string, unknown>

export function computeFollowUpTasks(rows: Row[], tenantId: string): FollowUpTask[] {
  const followUpRows = rows.filter(
    (r) =>
      r.human_followup_needed === true &&
      !r.is_booked &&
      ((r.follow_up_count as number) ?? 0) < 3,
  )

  return followUpRows.map((row) => {
    const taskType: FollowUpTaskType = 'human_review'

    const cad = (row.ai_summary_json as Record<string, unknown> | null) ?? {}
    const bookingInterest = (cad.booking_interest ?? cad.bookingInterest) as string | null
    const sendBookingLink = !!(cad.send_booking_link || cad.sendBookingLink)

    let priority: FollowUpPriority = 'medium'
    if (bookingInterest === 'warm' || bookingInterest === 'ready' || row.is_lead) priority = 'high'

    const createdMs = Date.parse(row.created_at as string)
    const dueAt = new Date(createdMs + 4 * 3600_000).toISOString()

    return {
      id: row.id as string,
      tenantId,
      contactId: row.id as string,
      taskType,
      status: 'open' as const,
      reason:
        (row.human_followup_reason as string | null) ??
        (row.ai_summary as string | null) ??
        (row.semantic_title as string | null) ??
        'Follow-up needed',
      dueAt,
      priority,
      suggestedAction: sendBookingLink
        ? 'Booking link was sent — follow up to confirm'
        : bookingInterest === 'warm' || bookingInterest === 'ready'
          ? 'Call back to confirm booking interest'
          : null,
      suggestedScript: null,
      assignedTo: null,
      bookingLinkSent: sendBookingLink,
      createdAt: row.created_at as string,
      updatedAt: (row.updated_at as string | null) ?? (row.created_at as string),
      contact: {
        id: row.id as string,
        tenantId,
        fullName:
          (row.caller_name as string | null) ??
          (row.caller_phone as string | null) ??
          'Unknown',
        phone: (row.caller_phone as string | null) ?? '',
        email: null,
        tags: [],
        source: 'phone',
        status: row.is_booked ? ('booked' as const) : ('contacted' as const),
        ownerType: 'ai' as const,
        priorityScore: priority === 'high' ? 80 : priority === 'medium' ? 50 : 30,
        lastCallAt: row.created_at as string,
        nextActionAt: dueAt,
        createdAt: row.created_at as string,
        updatedAt: (row.updated_at as string | null) ?? (row.created_at as string),
      },
    } satisfies FollowUpTask
  })
}
