/**
 * Custom-webhook CRM adapter.
 *
 * Sends each CRM event as an HTTP POST to a tenant-configured endpoint.
 * The request body is a JSON object shaped by the generic CRM types so
 * any downstream system can parse it without provider-specific logic.
 *
 * Config keys (from integration.configJson):
 *   webhookUrl  — required, the endpoint to POST to
 *   secret      — optional, sent as x-webhook-secret header
 *   timeoutMs   — optional, default 8000
 */

import type { CrmAdapter } from '../adapter'
import type {
  CrmContact,
  CrmCallEvent,
  CrmSummaryNote,
  CrmTask,
  CrmAppointmentEvent,
  CrmLeadStatusUpdate,
  CrmResult,
} from '../types'

// ── Helper ────────────────────────────────────────────────────────────────────

interface WebhookPayload {
  event: string
  occurredAt: string
  data: unknown
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class CustomWebhookAdapter implements CrmAdapter {
  readonly providerName = 'Custom Webhook'

  private readonly webhookUrl: string
  private readonly secret: string | null
  private readonly timeoutMs: number

  constructor(config: Record<string, unknown>) {
    const url = config.webhookUrl
    if (typeof url !== 'string' || !url.startsWith('http')) {
      throw new Error('CustomWebhookAdapter: webhookUrl is required and must be an HTTP URL')
    }
    this.webhookUrl = url
    this.secret = typeof config.secret === 'string' ? config.secret : null
    this.timeoutMs = typeof config.timeoutMs === 'number' ? config.timeoutMs : 8_000
  }

  // ── Private send ────────────────────────────────────────────────────────────

  private async send(event: string, data: unknown): Promise<CrmResult> {
    const payload: WebhookPayload = {
      event,
      occurredAt: new Date().toISOString(),
      data,
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.secret) {
      headers['x-webhook-secret'] = this.secret
    }

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeoutMs)

      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return {
          success: false,
          error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
          httpStatus: res.status,
        }
      }

      return { success: true, httpStatus: res.status }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  // ── Interface methods ───────────────────────────────────────────────────────

  async upsertContact(contact: CrmContact): Promise<CrmResult<{ externalId: string }>> {
    const result = await this.send('contact.upserted', contact)
    if (result.success) {
      return { ...result, data: { externalId: contact.externalId } }
    }
    return result as CrmResult<{ externalId: string }>
  }

  async createCallEvent(event: CrmCallEvent): Promise<CrmResult> {
    return this.send('call.completed', event)
  }

  async createSummaryNote(note: CrmSummaryNote): Promise<CrmResult> {
    return this.send('summary.created', note)
  }

  async createTask(task: CrmTask): Promise<CrmResult> {
    return this.send('followup.required', task)
  }

  async updateLeadStatus(update: CrmLeadStatusUpdate): Promise<CrmResult> {
    return this.send('lead.status_updated', update)
  }

  async createAppointmentEvent(event: CrmAppointmentEvent): Promise<CrmResult> {
    return this.send('booking.created', event)
  }
}
