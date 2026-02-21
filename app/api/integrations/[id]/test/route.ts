/**
 * POST /api/integrations/[id]/test
 *
 * Test an integration connection by sending a synthetic event through the
 * full delivery pipeline. Uses the integration's saved config from the DB.
 *
 * Updates the integration row with the test result (last_test_at, status, etc.).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getIntegrationRawConfig } from '@/lib/integrations/crm/config-query'
import { recordTestResult } from '@/lib/integrations/crm/config-mutations'
import { deliverCrmEvent } from '@/lib/integrations/crm/delivery-service'
import type { IntegrationProvider } from '@/lib/types/domain'

// ── Schema ────────────────────────────────────────────────────────────────────

const BodySchema = z.object({
  eventType: z.string().optional().default('call.completed'),
})

// ── Sample payload ────────────────────────────────────────────────────────────

function buildTestPayload(eventType: string): Record<string, unknown> {
  const now = new Date().toISOString()
  switch (eventType) {
    case 'call.completed':
      return {
        externalContactId: 'test-contact-001',
        callId: `test-call-${Date.now()}`,
        direction: 'inbound',
        durationSec: 120,
        outcome: 'follow_up',
        occurredAt: now,
        notes: 'Test call event from Servify integration test.',
      }
    case 'booking.created':
      return {
        externalContactId: 'test-contact-001',
        externalAppointmentId: `test-appt-${Date.now()}`,
        serviceName: 'Botox — Forehead Lines',
        startAt: new Date(Date.now() + 3 * 86400000).toISOString(),
        status: 'booked',
        value: 400,
      }
    case 'lead.created':
      return {
        externalId: 'test-contact-001',
        firstName: 'Test',
        lastName: 'Lead',
        phone: '+15550001234',
        email: 'test@example.com',
        tags: ['test'],
        source: 'website',
        customFields: {},
      }
    default:
      return {
        externalContactId: 'test-contact-001',
        testPayload: true,
        occurredAt: now,
      }
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const { id } = params
  if (!id) {
    return NextResponse.json({ error: 'Missing integration id' }, { status: 400 })
  }

  // Parse optional body
  let eventType = 'call.completed'
  try {
    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (parsed.success) eventType = parsed.data.eventType
  } catch {
    // No body or invalid JSON — use default event type
  }

  // Load raw config from DB
  const integrationConfig = await getIntegrationRawConfig(tenant.id, id)
  if (!integrationConfig) {
    return NextResponse.json(
      { error: 'Integration not found' },
      { status: 404 },
    )
  }

  const payload = buildTestPayload(eventType)

  // Deliver via the standard pipeline
  const result = await deliverCrmEvent({
    tenantId: tenant.id,
    provider: integrationConfig.provider as IntegrationProvider,
    providerConfig: integrationConfig.config,
    eventType,
    eventId: `test-${Date.now()}`,
    payload,
  })

  // Record test result on the integration row
  try {
    await recordTestResult(tenant.id, id, result.success, result.errorMessage)
  } catch {
    // Non-fatal
  }

  return NextResponse.json(
    {
      success: result.success,
      logId: result.logId,
      latencyMs: result.latencyMs,
      responseStatus: result.responseStatus ?? null,
      errorCode: result.errorCode ?? null,
      errorMessage: result.errorMessage ?? null,
    },
    { status: result.success ? 200 : 207 },
  )
}
