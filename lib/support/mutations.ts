/**
 * Support Mutations — write operations for support requests and updates.
 *
 * Server-only. Uses service-role client (bypasses RLS).
 * All operations are tenant-scoped via client_id.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { computeFirstResponseDueAt } from './sla'
import { ALLOWED_TRANSITIONS } from './types'
import type {
  RequestCategory,
  RequestPriority,
  RequestStatus,
  RequestSource,
  UpdateVisibility,
  UpdateAuthorType,
  UpdateType,
} from './types'

// ── Short code generation ───────────────────────────────────────────────────

function generateShortCode(): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-4)
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6)
  return `SR-${ts}${rand}`
}

// ── Create request ──────────────────────────────────────────────────────────

export interface CreateRequestInput {
  clientId: string
  createdByUserId?: string | null
  source?: RequestSource
  subject: string
  category: RequestCategory
  priority?: RequestPriority
  description: string
  pagePath?: string | null
  screenshotUrl?: string | null
  affectedReference?: string | null
}

export async function createRequest(
  input: CreateRequestInput,
): Promise<{ success: boolean; requestId?: string; shortCode?: string; error?: string }> {
  const supabase = createSupabaseServerClient()
  const now = new Date().toISOString()
  const priority = input.priority ?? 'normal'
  const shortCode = generateShortCode()
  const firstResponseDueAt = computeFirstResponseDueAt(now, priority)

  const { data, error } = await supabase
    .from('support_requests')
    .insert({
      short_code: shortCode,
      client_id: input.clientId,
      created_by_user_id: input.createdByUserId ?? null,
      source: input.source ?? 'dashboard',
      subject: input.subject,
      category: input.category,
      priority,
      status: 'open',
      description: input.description,
      page_path: input.pagePath ?? null,
      screenshot_url: input.screenshotUrl ?? null,
      affected_reference: input.affectedReference ?? null,
      first_response_due_at: firstResponseDueAt,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[support] createRequest error:', error.message)
    return { success: false, error: error.message }
  }

  // Add system note for creation
  await supabase.from('support_request_updates').insert({
    request_id: data.id,
    author_type: 'system',
    author_label: null,
    visibility: 'public',
    update_type: 'system_note',
    body: 'Request created.',
    metadata: { source: input.source ?? 'dashboard' },
    created_at: now,
  })

  return { success: true, requestId: data.id, shortCode }
}

// ── Transition request status ───────────────────────────────────────────────

export interface TransitionStatusInput {
  requestId: string
  clientId?: string
  newStatus: RequestStatus
  authorType: UpdateAuthorType
  authorLabel?: string | null
  comment?: string | null
}

export async function transitionRequestStatus(
  input: TransitionStatusInput,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServerClient()
  const now = new Date().toISOString()

  // Fetch current status
  let query = supabase
    .from('support_requests')
    .select('status, first_responded_at')
    .eq('id', input.requestId)

  if (input.clientId) {
    query = query.eq('client_id', input.clientId)
  }

  const { data: current, error: fetchError } = await query.maybeSingle()

  if (fetchError || !current) {
    return { success: false, error: 'Request not found' }
  }

  const currentStatus = current.status as RequestStatus
  const allowed = ALLOWED_TRANSITIONS[currentStatus]

  if (!allowed.includes(input.newStatus)) {
    return {
      success: false,
      error: `Cannot transition from '${currentStatus}' to '${input.newStatus}'`,
    }
  }

  // Build update payload
  const updatePayload: Record<string, unknown> = {
    status: input.newStatus,
    updated_at: now,
  }

  // Track first response (operator acknowledges / starts work)
  if (
    !current.first_responded_at &&
    input.authorType === 'operator' &&
    ['acknowledged', 'in_progress'].includes(input.newStatus)
  ) {
    updatePayload.first_responded_at = now
  }

  // Track resolution time
  if (input.newStatus === 'resolved') {
    updatePayload.resolved_at = now
  }

  // Track close time
  if (input.newStatus === 'closed') {
    updatePayload.closed_at = now
  }

  // Track reopen (clear resolved/closed timestamps)
  if (input.newStatus === 'reopened') {
    updatePayload.resolved_at = null
    updatePayload.closed_at = null
  }

  let updateQuery = supabase
    .from('support_requests')
    .update(updatePayload)
    .eq('id', input.requestId)

  if (input.clientId) {
    updateQuery = updateQuery.eq('client_id', input.clientId)
  }

  const { error: updateError } = await updateQuery

  if (updateError) {
    console.error('[support] transitionRequestStatus error:', updateError.message)
    return { success: false, error: updateError.message }
  }

  // Add status change update to timeline
  await supabase.from('support_request_updates').insert({
    request_id: input.requestId,
    author_type: input.authorType,
    author_label: input.authorLabel ?? null,
    visibility: 'public',
    update_type: 'status_change',
    body: input.comment ?? `Status changed to ${input.newStatus}.`,
    metadata: { from: currentStatus, to: input.newStatus },
    created_at: now,
  })

  return { success: true }
}

// ── Add update (comment / note) ─────────────────────────────────────────────

export interface AddUpdateInput {
  requestId: string
  clientId?: string
  authorType: UpdateAuthorType
  authorLabel?: string | null
  visibility?: UpdateVisibility
  updateType?: UpdateType
  body: string
  metadata?: Record<string, unknown>
}

export async function addRequestUpdate(
  input: AddUpdateInput,
): Promise<{ success: boolean; updateId?: string; error?: string }> {
  const supabase = createSupabaseServerClient()
  const now = new Date().toISOString()

  // Verify request exists (and tenant scope if provided)
  let verifyQuery = supabase
    .from('support_requests')
    .select('id, first_responded_at')
    .eq('id', input.requestId)

  if (input.clientId) {
    verifyQuery = verifyQuery.eq('client_id', input.clientId)
  }

  const { data: req, error: verifyError } = await verifyQuery.maybeSingle()

  if (verifyError || !req) {
    return { success: false, error: 'Request not found' }
  }

  const visibility = input.visibility ?? 'public'

  const { data, error } = await supabase
    .from('support_request_updates')
    .insert({
      request_id: input.requestId,
      author_type: input.authorType,
      author_label: input.authorLabel ?? null,
      visibility,
      update_type: input.updateType ?? 'comment',
      body: input.body,
      metadata: input.metadata ?? {},
      created_at: now,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[support] addRequestUpdate error:', error.message)
    return { success: false, error: error.message }
  }

  // Update request timestamps
  const tsUpdate: Record<string, unknown> = { updated_at: now }
  if (visibility === 'public') {
    tsUpdate.last_public_update_at = now
  } else {
    tsUpdate.last_internal_update_at = now
  }

  // Track first response if operator is commenting for the first time
  if (!req.first_responded_at && input.authorType === 'operator' && visibility === 'public') {
    tsUpdate.first_responded_at = now
  }

  await supabase
    .from('support_requests')
    .update(tsUpdate)
    .eq('id', input.requestId)

  return { success: true, updateId: data.id }
}

// ── Assign request ──────────────────────────────────────────────────────────

export async function assignRequest(
  requestId: string,
  assignedTo: string | null,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('support_requests')
    .update({ assigned_to: assignedTo, updated_at: new Date().toISOString() })
    .eq('id', requestId)

  if (error) {
    console.error('[support] assignRequest error:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}
