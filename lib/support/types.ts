/**
 * Support / Requests domain types.
 *
 * Typed enums for request lifecycle: category, priority, status, visibility.
 * Used by both client-facing and ops-facing surfaces.
 */

// ── Request category ────────────────────────────────────────────────────────

export type RequestCategory =
  | 'bug'
  | 'improvement'
  | 'question'
  | 'data_issue'
  | 'integration_issue'
  | 'billing_question'
  | 'other'

// ── Request priority ────────────────────────────────────────────────────────

export type RequestPriority = 'low' | 'normal' | 'high' | 'urgent'

// ── Request status (lifecycle) ──────────────────────────────────────────────

export type RequestStatus =
  | 'open'
  | 'acknowledged'
  | 'in_progress'
  | 'waiting_for_client'
  | 'resolved'
  | 'closed'
  | 'reopened'

// ── Update visibility ───────────────────────────────────────────────────────

export type UpdateVisibility = 'public' | 'internal'

// ── Update author type ──────────────────────────────────────────────────────

export type UpdateAuthorType = 'client' | 'operator' | 'system'

// ── Update type ─────────────────────────────────────────────────────────────

export type UpdateType = 'comment' | 'status_change' | 'system_note'

// ── Request source ──────────────────────────────────────────────────────────

export type RequestSource = 'dashboard' | 'ops' | 'email_import' | 'api'

// ── Support request entity ─────────────────────────────────────────────────

export interface SupportRequest {
  id: string
  shortCode: string
  clientId: string
  createdByUserId: string | null
  source: RequestSource
  subject: string
  category: RequestCategory
  priority: RequestPriority
  status: RequestStatus
  description: string
  pagePath: string | null
  screenshotUrl: string | null
  affectedReference: string | null
  firstResponseDueAt: string | null
  firstRespondedAt: string | null
  resolvedAt: string | null
  closedAt: string | null
  assignedTo: string | null
  lastPublicUpdateAt: string | null
  lastInternalUpdateAt: string | null
  createdAt: string
  updatedAt: string
}

// ── Support request update ──────────────────────────────────────────────────

export interface SupportRequestUpdate {
  id: string
  requestId: string
  authorType: UpdateAuthorType
  authorLabel: string | null
  visibility: UpdateVisibility
  updateType: UpdateType
  body: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

// ── Request with tenant info (for ops views) ────────────────────────────────

export interface RequestWithClient extends SupportRequest {
  clientName: string
  clientSlug: string
}

// ── SLA status ──────────────────────────────────────────────────────────────

export type SlaStatus = 'on_track' | 'at_risk' | 'overdue' | 'responded' | 'not_applicable'

export interface SlaInfo {
  firstResponseDueAt: string | null
  firstRespondedAt: string | null
  slaStatus: SlaStatus
  hoursUntilDue: number | null
  hoursOverdue: number | null
  responseTimeHours: number | null
  resolutionTimeHours: number | null
}

// ── Status transitions (deterministic) ──────────────────────────────────────

export const ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  open: ['acknowledged', 'in_progress', 'waiting_for_client', 'resolved'],
  acknowledged: ['in_progress', 'waiting_for_client', 'resolved'],
  in_progress: ['waiting_for_client', 'resolved'],
  waiting_for_client: ['in_progress', 'resolved'],
  resolved: ['reopened', 'closed'],
  closed: ['reopened'],
  reopened: ['acknowledged', 'in_progress', 'waiting_for_client', 'resolved'],
}

// ── Ops KPI summary ────────────────────────────────────────────────────────

export interface SupportKpiSummary {
  totalOpen: number
  overdueFirstResponse: number
  highUrgentOpen: number
  resolvedToday: number
  avgFirstResponseHours: number | null
  avgResolutionHours: number | null
}

// ── Labels ──────────────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<RequestCategory, string> = {
  bug: 'Bug',
  improvement: 'Improvement',
  question: 'Question',
  data_issue: 'Data Issue',
  integration_issue: 'Integration Issue',
  billing_question: 'Billing',
  other: 'Other',
}

export const PRIORITY_LABELS: Record<RequestPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
}

export const STATUS_LABELS: Record<RequestStatus, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  waiting_for_client: 'Waiting for Client',
  resolved: 'Resolved',
  closed: 'Closed',
  reopened: 'Reopened',
}
