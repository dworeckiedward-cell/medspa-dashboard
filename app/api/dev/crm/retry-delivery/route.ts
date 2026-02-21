/**
 * POST /api/dev/crm/retry-delivery
 *
 * Retry a failed CRM delivery by replaying the original payload
 * from the crm_delivery_logs table. Limited to custom_webhook provider
 * for now — other providers return a typed NOT_IMPLEMENTED response.
 *
 * Request body:
 * { "logId": "<uuid>" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getCrmDeliveryLogById } from '@/lib/integrations/crm/query'
import { listEnabledIntegrationConfigs } from '@/lib/integrations/crm/config-query'
import { deliverCrmEvent } from '@/lib/integrations/crm/delivery-service'
import type { IntegrationProvider } from '@/lib/types/domain'

const BodySchema = z.object({
  logId: z.string().uuid(),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { tenant } = await resolveTenantAccess()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

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

  // Fetch original log row
  const log = await getCrmDeliveryLogById(tenant.id, parsed.data.logId)
  if (!log) {
    return NextResponse.json(
      { error: 'Delivery log not found' },
      { status: 404 },
    )
  }

  // Only support custom_webhook retries for now
  if (log.integrationProvider !== 'custom_webhook') {
    return NextResponse.json(
      {
        error: 'Retry not supported',
        detail: `Retry is only supported for custom_webhook. Provider: ${log.integrationProvider}`,
        errorCode: 'NOT_IMPLEMENTED',
      },
      { status: 501 },
    )
  }

  // Look up the provider config from DB
  const configs = await listEnabledIntegrationConfigs(tenant.id, log.integrationProvider)
  const config = configs[0] // Use first enabled config for this provider

  if (!config) {
    return NextResponse.json(
      {
        error: 'No enabled integration found for retry',
        detail: `No enabled ${log.integrationProvider} integration configured for this tenant.`,
        errorCode: 'NOT_CONFIGURED',
      },
      { status: 422 },
    )
  }

  // Replay the event
  const result = await deliverCrmEvent({
    tenantId: tenant.id,
    provider: log.integrationProvider as IntegrationProvider,
    providerConfig: config.config,
    eventType: log.eventType,
    eventId: `retry-${log.id}-${Date.now()}`,
    payload: log.payload,
  })

  return NextResponse.json(
    {
      success: result.success,
      logId: result.logId,
      latencyMs: result.latencyMs,
      responseStatus: result.responseStatus ?? null,
      errorCode: result.errorCode ?? null,
      errorMessage: result.errorMessage ?? null,
      retriedFromLogId: log.id,
    },
    { status: result.success ? 200 : 207 },
  )
}
