/**
 * CRM adapter types.
 *
 * Provider-agnostic shapes used by the adapter interface.
 * Each CRM provider maps these to their own API shapes internally.
 */

import type { Contact, CallLogEntry, CallSummary, FollowUpTask, Appointment } from '@/lib/types/domain'

// ── Contact / Lead ─────────────────────────────────────────────────────────────

export interface CrmContact {
  externalId: string          // ID in the external CRM
  firstName: string
  lastName: string
  phone: string
  email: string | null
  tags: string[]
  source: string | null
  customFields: Record<string, unknown>
}

// ── Call event ────────────────────────────────────────────────────────────────

export interface CrmCallEvent {
  externalContactId: string
  callId: string
  direction: 'inbound' | 'outbound'
  durationSec: number
  outcome: string | null
  occurredAt: string           // ISO 8601
  notes: string | null         // plain summary → CRM note
}

// ── Summary note ──────────────────────────────────────────────────────────────

export interface CrmSummaryNote {
  externalContactId: string
  callId: string
  body: string                 // formatted plain text for the CRM note field
  occurredAt: string
}

// ── Task ──────────────────────────────────────────────────────────────────────

export interface CrmTask {
  externalContactId: string
  title: string
  body: string | null
  dueAt: string
  priority: 'high' | 'medium' | 'low'
  assignedTo: string | null
}

// ── Appointment ───────────────────────────────────────────────────────────────

export interface CrmAppointmentEvent {
  externalContactId: string
  externalAppointmentId: string | null
  serviceName: string
  startAt: string
  status: string
  value: number | null
}

// ── Lead status update ────────────────────────────────────────────────────────

export interface CrmLeadStatusUpdate {
  externalContactId: string
  status: string
  reason: string | null
}

// ── Adapter result ────────────────────────────────────────────────────────────

export interface CrmResult<T = unknown> {
  success: boolean
  externalId?: string
  data?: T
  error?: string
  /** HTTP response status code — populated by HTTP-based adapters (e.g. custom_webhook). */
  httpStatus?: number
}

// ── Domain → CRM mappers (shared utilities) ──────────────────────────────────

export function contactToCrmContact(contact: Contact): CrmContact {
  const [firstName, ...rest] = contact.fullName.trim().split(' ')
  return {
    externalId: contact.id,
    firstName: firstName ?? contact.fullName,
    lastName: rest.join(' ') || '',
    phone: contact.phone,
    email: contact.email,
    tags: contact.tags,
    source: contact.source,
    customFields: {
      priorityScore: contact.priorityScore,
      ownerType: contact.ownerType,
      status: contact.status,
    },
  }
}

export function callLogToCrmEvent(call: CallLogEntry): CrmCallEvent {
  return {
    externalContactId: call.contactId ?? '',
    callId: call.id,
    direction: call.direction,
    durationSec: call.durationSec,
    outcome: call.outcome,
    occurredAt: call.startedAt,
    notes: call.summary?.plainSummary ?? null,
  }
}

export function summaryToCrmNote(
  contactId: string,
  summary: CallSummary,
): CrmSummaryNote {
  const structured = summary.structuredSummary
  let body = summary.plainSummary
  if (structured?.nextBestAction) {
    body += `\n\nNext best action: ${structured.nextBestAction}`
  }
  if (structured?.objections && structured.objections.length > 0) {
    body += `\n\nObjections: ${structured.objections.join(', ')}`
  }
  return {
    externalContactId: contactId,
    callId: summary.callLogId,
    body,
    occurredAt: summary.createdAt,
  }
}

export function taskToCrmTask(task: FollowUpTask): CrmTask {
  return {
    externalContactId: task.contactId,
    title: `[Follow-up] ${task.taskType.replace(/_/g, ' ')} — ${task.reason.slice(0, 80)}`,
    body: task.suggestedScript ?? task.suggestedAction,
    dueAt: task.dueAt,
    priority: task.priority,
    assignedTo: task.assignedTo,
  }
}

export function appointmentToCrmEvent(appt: Appointment): CrmAppointmentEvent {
  return {
    externalContactId: appt.contactId,
    externalAppointmentId: appt.externalId,
    serviceName: appt.serviceName,
    startAt: appt.startAt,
    status: appt.status,
    value: appt.valueEstimate > 0 ? appt.valueEstimate : null,
  }
}
