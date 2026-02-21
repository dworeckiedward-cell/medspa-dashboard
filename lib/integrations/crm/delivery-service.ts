/**
 * CRM Event Delivery Service
 *
 * Central orchestrator for outbound CRM event delivery:
 *   1. Resolve the adapter for the given provider
 *   2. Dispatch the event to the correct adapter method
 *   3. Measure latency
 *   4. Normalize result into a typed CrmDeliveryResult
 *   5. Persist a log row in crm_delivery_logs (always — even on failure)
 *   6. Return the result to the caller
 *
 * Secrets are never logged or stored in plain form.
 */

import type { IntegrationProvider, CrmDeliveryErrorCode } from '@/lib/types/domain'
import { resolveAdapter } from './adapter'
import type {
  CrmContact,
  CrmCallEvent,
  CrmSummaryNote,
  CrmTask,
  CrmAppointmentEvent,
  CrmLeadStatusUpdate,
  CrmResult,
} from './types'
import type { CrmAdapter } from './adapter'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getIntegrationRawConfig } from './config-query'
import { recordTestResult } from './config-mutations'

// ── Public types ───────────────────────────────────────────────────────────────

export interface CrmEventEnvelope {
  /** Tenant UUID (= client_id in the DB) */
  tenantId: string
  /** Which CRM provider to dispatch to */
  provider: IntegrationProvider
  /** Provider-specific config (webhookUrl, secret, etc.) */
  providerConfig: Record<string, unknown>
  /** Domain event type, e.g. 'call.completed', 'lead.created' */
  eventType: string
  /** Optional correlation ID from the source system */
  eventId?: string
  /**
   * The domain object to deliver.
   * Must conform to the CRM type that matches eventType.
   * The delivery service casts it to the correct type at the dispatch boundary.
   */
  payload: Record<string, unknown>
}

export interface CrmDeliveryResult {
  success: boolean
  /** DB row id written to crm_delivery_logs (null if DB write failed) */
  logId: string | null
  errorCode?: CrmDeliveryErrorCode
  errorMessage?: string
  responseStatus?: number
  latencyMs: number
}

// ── Internal constants ─────────────────────────────────────────────────────────

const RESPONSE_PREVIEW_MAX_CHARS = 1_000

/**
 * Maps event types to the correct adapter method.
 * Using `as unknown as SpecificType` at the dispatch boundary is intentional:
 * the caller is responsible for passing a payload that matches the eventType.
 */
const EVENT_DISPATCH: Record<
  string,
  (adapter: CrmAdapter, payload: Record<string, unknown>) => Promise<CrmResult>
> = {
  'call.completed':    (a, p) => a.createCallEvent(p as unknown as CrmCallEvent),
  'summary.created':   (a, p) => a.createSummaryNote(p as unknown as CrmSummaryNote),
  'followup.required': (a, p) => a.createTask(p as unknown as CrmTask),
  'booking.created':   (a, p) => a.createAppointmentEvent(p as unknown as CrmAppointmentEvent),
  'contact.upserted':  (a, p) => a.upsertContact(p as unknown as CrmContact),
  'lead.created':      (a, p) => a.upsertContact(p as unknown as CrmContact),
  'lead.status_updated': (a, p) => a.updateLeadStatus(p as unknown as CrmLeadStatusUpdate),
}

// ── Private helpers ────────────────────────────────────────────────────────────

/**
 * Build masked headers for storage — never store raw secrets.
 */
function buildMaskedHeaders(config: Record<string, unknown>): Record<string, string | undefined> {
  return {
    'Content-Type': 'application/json',
    'x-webhook-secret': config.secret ? '***MASKED***' : undefined,
    'Authorization': config.apiKey ? '***MASKED***' : undefined,
  }
}

/**
 * Classify a raw error message into a CrmDeliveryErrorCode.
 */
function classifyError(message: string): CrmDeliveryErrorCode {
  const lower = message.toLowerCase()
  if (lower.includes('not yet implemented') || lower.includes('not implemented')) {
    return 'NOT_IMPLEMENTED'
  }
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('abort')) {
    return 'TIMEOUT'
  }
  if (
    lower.includes('network') ||
    lower.includes('fetch failed') ||
    lower.includes('econnrefused') ||
    lower.includes('ehostunreach') ||
    lower.includes('dns')
  ) {
    return 'NETWORK_ERROR'
  }
  if (/^http \d{3}/.test(lower)) {
    return 'HTTP_ERROR'
  }
  return 'UNKNOWN_ERROR'
}

function truncate(text: string | null | undefined, max = RESPONSE_PREVIEW_MAX_CHARS): string | null {
  if (!text) return null
  if (text.length <= max) return text
  return text.slice(0, max) + '… [truncated]'
}

// ── Main delivery function ────────────────────────────────────────────────────

export async function deliverCrmEvent(envelope: CrmEventEnvelope): Promise<CrmDeliveryResult> {
  const start = Date.now()

  let success = false
  let errorCode: CrmDeliveryErrorCode | undefined
  let errorMessage: string | undefined
  let responseStatus: number | undefined
  let logId: string | null = null

  // Extract request URL for logging (provider-specific)
  const requestUrl: string | null =
    typeof envelope.providerConfig.webhookUrl === 'string'
      ? envelope.providerConfig.webhookUrl
      : null

  // ── 1. Resolve adapter ─────────────────────────────────────────────────────
  let adapter: CrmAdapter | null = null

  try {
    adapter = resolveAdapter(envelope.provider, envelope.providerConfig)
  } catch (err) {
    errorCode = 'NOT_CONFIGURED'
    errorMessage = err instanceof Error ? err.message : String(err)
  }

  if (!adapter && !errorCode) {
    errorCode = 'NOT_CONFIGURED'
    errorMessage = `No adapter registered for provider: ${envelope.provider}`
  }

  // ── 2. Dispatch event ──────────────────────────────────────────────────────
  if (adapter) {
    try {
      const dispatch = EVENT_DISPATCH[envelope.eventType]

      let result: CrmResult

      if (dispatch) {
        result = await dispatch(adapter, envelope.payload)
      } else {
        // Unknown event type — fall back to createCallEvent as a generic delivery
        result = await adapter.createCallEvent(envelope.payload as unknown as CrmCallEvent)
      }

      success = result.success
      responseStatus = result.httpStatus

      if (!result.success && result.error) {
        errorMessage = result.error
        errorCode = classifyError(result.error)
      }
    } catch (err) {
      success = false
      errorMessage = err instanceof Error ? err.message : String(err)
      errorCode = classifyError(errorMessage)
    }
  }

  const latencyMs = Date.now() - start

  // ── 3. Persist log row ─────────────────────────────────────────────────────
  try {
    const supabase = createSupabaseServerClient()

    const { data, error: dbError } = await supabase
      .from('crm_delivery_logs')
      .insert({
        client_id: envelope.tenantId,
        integration_provider: envelope.provider,
        event_type: envelope.eventType,
        event_id: envelope.eventId ?? null,
        payload: envelope.payload,
        request_url: requestUrl,
        request_headers_masked: buildMaskedHeaders(envelope.providerConfig),
        http_method: 'POST',
        response_status: responseStatus ?? null,
        response_body_preview: null, // response body not captured at adapter level yet
        latency_ms: latencyMs,
        success,
        error_code: errorCode ?? null,
        error_message: truncate(errorMessage),
      })
      .select('id')
      .single()

    if (dbError) {
      console.error('[crm/delivery] DB write failed:', dbError.message)
    } else if (data) {
      logId = (data as { id: string }).id
    }
  } catch (dbErr) {
    // Never let a logging failure bubble up to the caller
    console.error('[crm/delivery] Unexpected DB error:', dbErr)
  }

  return {
    success,
    logId,
    errorCode,
    errorMessage,
    responseStatus,
    latencyMs,
  }
}

// ── DB-backed delivery (resolves config from client_integrations) ────────────

export interface CrmIntegrationEventEnvelope {
  /** Tenant UUID (= client_id in the DB) */
  tenantId: string
  /** client_integrations row ID */
  integrationId: string
  /** Domain event type, e.g. 'call.completed' */
  eventType: string
  /** Optional correlation ID */
  eventId?: string
  /** The domain object to deliver */
  payload: Record<string, unknown>
}

/**
 * Deliver a CRM event using DB-backed integration config.
 * Resolves config from client_integrations, checks event toggles,
 * then delegates to deliverCrmEvent.
 * Also records test result on the integration row.
 */
export async function deliverCrmEventViaIntegration(
  envelope: CrmIntegrationEventEnvelope,
): Promise<CrmDeliveryResult> {
  const start = Date.now()

  // ── 1. Load integration config from DB ─────────────────────────────────────
  const integrationConfig = await getIntegrationRawConfig(
    envelope.tenantId,
    envelope.integrationId,
  )

  if (!integrationConfig) {
    return {
      success: false,
      logId: null,
      errorCode: 'NOT_CONFIGURED',
      errorMessage: `Integration not found: ${envelope.integrationId}`,
      latencyMs: Date.now() - start,
    }
  }

  // ── 2. Check if integration is enabled and connected ──────────────────────
  if (!integrationConfig.isEnabled) {
    return {
      success: false,
      logId: null,
      errorCode: 'SKIPPED_NOT_CONNECTED',
      errorMessage: 'Integration is disabled',
      latencyMs: Date.now() - start,
    }
  }

  if (integrationConfig.status !== 'connected' && integrationConfig.status !== 'testing') {
    return {
      success: false,
      logId: null,
      errorCode: 'SKIPPED_NOT_CONNECTED',
      errorMessage: `Integration status is "${integrationConfig.status}"`,
      latencyMs: Date.now() - start,
    }
  }

  // ── 3. Check event toggles ─────────────────────────────────────────────────
  const toggles = integrationConfig.eventToggles
  if (toggles && toggles[envelope.eventType] === false) {
    return {
      success: false,
      logId: null,
      errorCode: 'SKIPPED_DISABLED',
      errorMessage: `Event "${envelope.eventType}" is disabled for this integration`,
      latencyMs: Date.now() - start,
    }
  }

  // ── 4. Delegate to existing delivery function ──────────────────────────────
  const result = await deliverCrmEvent({
    tenantId: envelope.tenantId,
    provider: integrationConfig.provider as IntegrationProvider,
    providerConfig: integrationConfig.config,
    eventType: envelope.eventType,
    eventId: envelope.eventId,
    payload: envelope.payload,
  })

  // ── 5. Update integration status based on result ──────────────────────────
  try {
    await recordTestResult(
      envelope.tenantId,
      envelope.integrationId,
      result.success,
      result.errorMessage,
    )
  } catch {
    // Non-fatal — don't let status update failure break delivery
    console.error('[crm/delivery] Failed to record result on integration row')
  }

  return result
}
