/**
 * SLA Helpers — deterministic first-response / resolution timing.
 *
 * MVP: elapsed clock hours (no business-hours calendar).
 * Documents assumptions clearly for future upgrade.
 */

import type { SupportRequest, RequestPriority, SlaInfo, SlaStatus } from './types'

// ── SLA targets (hours) ─────────────────────────────────────────────────────

const FIRST_RESPONSE_SLA_HOURS: Record<RequestPriority, number> = {
  urgent: 4,
  high: 8,
  normal: 24,
  low: 48,
}

// ── Compute first-response due time ─────────────────────────────────────────

export function computeFirstResponseDueAt(
  createdAt: string,
  priority: RequestPriority,
): string {
  const created = new Date(createdAt)
  const slaHours = FIRST_RESPONSE_SLA_HOURS[priority]
  const dueAt = new Date(created.getTime() + slaHours * 60 * 60 * 1000)
  return dueAt.toISOString()
}

// ── Compute SLA info for a request ──────────────────────────────────────────

export function computeSlaInfo(request: SupportRequest): SlaInfo {
  const now = Date.now()

  // Response time
  let responseTimeHours: number | null = null
  if (request.firstRespondedAt) {
    const responded = Date.parse(request.firstRespondedAt)
    const created = Date.parse(request.createdAt)
    responseTimeHours = Math.round(((responded - created) / (60 * 60 * 1000)) * 10) / 10
  }

  // Resolution time
  let resolutionTimeHours: number | null = null
  if (request.resolvedAt) {
    const resolved = Date.parse(request.resolvedAt)
    const created = Date.parse(request.createdAt)
    resolutionTimeHours = Math.round(((resolved - created) / (60 * 60 * 1000)) * 10) / 10
  }

  // SLA status
  let slaStatus: SlaStatus = 'not_applicable'
  let hoursUntilDue: number | null = null
  let hoursOverdue: number | null = null

  if (request.firstRespondedAt) {
    slaStatus = 'responded'
  } else if (request.firstResponseDueAt) {
    const dueAt = Date.parse(request.firstResponseDueAt)
    const diff = dueAt - now
    const diffHours = Math.round((diff / (60 * 60 * 1000)) * 10) / 10

    if (diff < 0) {
      slaStatus = 'overdue'
      hoursOverdue = Math.abs(diffHours)
    } else if (diffHours <= 4) {
      slaStatus = 'at_risk'
      hoursUntilDue = diffHours
    } else {
      slaStatus = 'on_track'
      hoursUntilDue = diffHours
    }
  }

  return {
    firstResponseDueAt: request.firstResponseDueAt,
    firstRespondedAt: request.firstRespondedAt,
    slaStatus,
    hoursUntilDue,
    hoursOverdue,
    responseTimeHours,
    resolutionTimeHours,
  }
}

// ── Format SLA for display ──────────────────────────────────────────────────

export function formatSlaStatus(info: SlaInfo): string {
  switch (info.slaStatus) {
    case 'responded':
      return info.responseTimeHours != null
        ? `Responded in ${info.responseTimeHours}h`
        : 'Responded'
    case 'overdue':
      return info.hoursOverdue != null
        ? `Overdue by ${info.hoursOverdue}h`
        : 'Overdue'
    case 'at_risk':
      return info.hoursUntilDue != null
        ? `Due in ${info.hoursUntilDue}h`
        : 'At risk'
    case 'on_track':
      return info.hoursUntilDue != null
        ? `Due in ${Math.round(info.hoursUntilDue)}h`
        : 'On track'
    case 'not_applicable':
      return '—'
  }
}

export { FIRST_RESPONSE_SLA_HOURS }
