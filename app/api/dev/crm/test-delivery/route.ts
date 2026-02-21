/**
 * POST /api/dev/crm/test-delivery
 *
 * Developer tool: trigger a synthetic CRM event for a tenant and see the
 * full delivery result + persisted log row in crm_delivery_logs.
 *
 * Production gate:
 *   If NODE_ENV === 'production', the request must include the header
 *   `x-dev-action-key: <DEV_ACTION_KEY env var>`. Returns 403 otherwise.
 *
 * Request body:
 * {
 *   "tenantSlug": "revive",
 *   "provider": "custom_webhook",
 *   "eventType": "call.completed",
 *   "providerConfig": {          // optional — falls back to env var CRM_TEST_WEBHOOK_URL
 *     "webhookUrl": "https://...",
 *     "secret": "..."
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "logId": "<uuid>",
 *   "latencyMs": 143,
 *   "responseStatus": 200,
 *   "errorCode": null,
 *   "errorMessage": null,
 *   "payload": { ... }   // the synthetic payload that was sent
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantBySlug } from '@/lib/tenant/get-tenant-config'
import { deliverCrmEvent } from '@/lib/integrations/crm/delivery-service'
import type { IntegrationProvider } from '@/lib/types/domain'
import type {
  CrmCallEvent,
  CrmContact,
  CrmSummaryNote,
  CrmTask,
  CrmAppointmentEvent,
} from '@/lib/integrations/crm/types'

// ── Auth guard ─────────────────────────────────────────────────────────────────

function isAuthorised(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true

  const devKey = process.env.DEV_ACTION_KEY
  if (!devKey) return false // key not configured → always deny in production

  return req.headers.get('x-dev-action-key') === devKey
}

// ── Request schema ─────────────────────────────────────────────────────────────

const BodySchema = z.object({
  tenantSlug: z.string().min(1),
  provider: z.enum(['custom_webhook', 'hubspot', 'ghl', 'pipedrive']),
  eventType: z.enum([
    'call.completed',
    'summary.created',
    'followup.required',
    'booking.created',
    'contact.upserted',
    'lead.created',
    'lead.status_updated',
  ]),
  /** Optional provider config override. Falls back to env CRM_TEST_WEBHOOK_URL. */
  providerConfig: z
    .object({
      webhookUrl: z.string().url().optional(),
      secret: z.string().optional(),
      timeoutMs: z.number().optional(),
    })
    .optional(),
})

// ── Sample payload builders ────────────────────────────────────────────────────

const SAMPLE_CONTACT_ID = 'test-contact-001'

function buildSamplePayload(eventType: string): Record<string, unknown> {
  const now = new Date().toISOString()

  switch (eventType) {
    case 'call.completed': {
      const payload: CrmCallEvent = {
        externalContactId: SAMPLE_CONTACT_ID,
        callId: `test-call-${Date.now()}`,
        direction: 'inbound',
        durationSec: 187,
        outcome: 'follow_up',
        occurredAt: now,
        notes:
          'Caller inquired about Botox pricing and availability. High intent. Requested callback.',
      }
      return payload as unknown as Record<string, unknown>
    }

    case 'summary.created': {
      const payload: CrmSummaryNote = {
        externalContactId: SAMPLE_CONTACT_ID,
        callId: `test-call-${Date.now()}`,
        body: 'Summary: Caller asked about Botox for forehead lines. Budget ~$400. Prefers weekend appointments.\n\nNext best action: Send before/after portfolio and call back Thursday.',
        occurredAt: now,
      }
      return payload as unknown as Record<string, unknown>
    }

    case 'followup.required': {
      const payload: CrmTask = {
        externalContactId: SAMPLE_CONTACT_ID,
        title: '[Follow-up] callback — Interested in Botox, requested callback',
        body: `Hi [Name], this is [Staff] from Luxe Aesthetics. Following up on your interest in Botox! We have openings this week. Would you like to book a quick consultation?`,
        dueAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 h from now
        priority: 'high',
        assignedTo: null,
      }
      return payload as unknown as Record<string, unknown>
    }

    case 'booking.created': {
      const payload: CrmAppointmentEvent = {
        externalContactId: SAMPLE_CONTACT_ID,
        externalAppointmentId: `test-appt-${Date.now()}`,
        serviceName: 'Botox — Forehead Lines (20 units)',
        startAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days out
        status: 'booked',
        value: 400,
      }
      return payload as unknown as Record<string, unknown>
    }

    case 'contact.upserted':
    case 'lead.created': {
      const payload: CrmContact = {
        externalId: SAMPLE_CONTACT_ID,
        firstName: 'Test',
        lastName: 'Lead',
        phone: '+15550001234',
        email: 'test.lead@example.com',
        tags: ['botox', 'high-intent', 'test'],
        source: 'website',
        customFields: {
          priorityScore: 85,
          ownerType: 'ai',
          status: 'interested',
        },
      }
      return payload as unknown as Record<string, unknown>
    }

    case 'lead.status_updated': {
      return {
        externalContactId: SAMPLE_CONTACT_ID,
        status: 'interested',
        reason: 'Test status update via dev tool',
      }
    }

    default: {
      return {
        externalContactId: SAMPLE_CONTACT_ID,
        eventType,
        testPayload: true,
        occurredAt: now,
      }
    }
  }
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorised(req)) {
    return NextResponse.json(
      {
        error: 'Forbidden',
        hint:
          process.env.NODE_ENV === 'production'
            ? 'Set x-dev-action-key header matching DEV_ACTION_KEY env var.'
            : 'Should not happen in dev.',
      },
      { status: 403 },
    )
  }

  // Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { tenantSlug, provider, eventType, providerConfig: bodyConfig } = parsed.data

  // Resolve tenant
  const tenant = await getTenantBySlug(tenantSlug)
  if (!tenant) {
    return NextResponse.json(
      { error: `Tenant not found: ${tenantSlug}` },
      { status: 404 },
    )
  }

  // Build provider config
  // Priority: body.providerConfig → env CRM_TEST_WEBHOOK_URL → fail gracefully
  const resolvedConfig: Record<string, unknown> = {}

  if (bodyConfig?.webhookUrl) {
    resolvedConfig.webhookUrl = bodyConfig.webhookUrl
    if (bodyConfig.secret) resolvedConfig.secret = bodyConfig.secret
    if (bodyConfig.timeoutMs) resolvedConfig.timeoutMs = bodyConfig.timeoutMs
  } else if (process.env.CRM_TEST_WEBHOOK_URL) {
    resolvedConfig.webhookUrl = process.env.CRM_TEST_WEBHOOK_URL
    if (process.env.CRM_TEST_WEBHOOK_SECRET) {
      resolvedConfig.secret = process.env.CRM_TEST_WEBHOOK_SECRET
    }
  }
  // If still empty, the delivery service will write a NOT_CONFIGURED error log

  // Build sample payload
  const payload = buildSamplePayload(eventType)

  // Deliver event
  const result = await deliverCrmEvent({
    tenantId: tenant.id,
    provider: provider as IntegrationProvider,
    providerConfig: resolvedConfig,
    eventType,
    eventId: `test-${Date.now()}`,
    payload,
  })

  return NextResponse.json(
    {
      success: result.success,
      logId: result.logId,
      latencyMs: result.latencyMs,
      responseStatus: result.responseStatus ?? null,
      errorCode: result.errorCode ?? null,
      errorMessage: result.errorMessage ?? null,
      payload,
    },
    { status: result.success ? 200 : 207 },
  )
}
