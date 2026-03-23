/**
 * CRM adapter interface.
 *
 * Each CRM provider implements this interface. The application layer only
 * calls these methods — it never touches provider-specific APIs directly.
 *
 * All methods are fire-and-forget from the caller's perspective: they return
 * a CrmResult that captures success/failure without throwing.
 */

import type {
  CrmContact,
  CrmCallEvent,
  CrmSummaryNote,
  CrmTask,
  CrmAppointmentEvent,
  CrmLeadStatusUpdate,
  CrmResult,
} from './types'

// ── Adapter interface ─────────────────────────────────────────────────────────

export interface CrmAdapter {
  /**
   * Human-readable name used in logs and the Integrations Center UI.
   */
  readonly providerName: string

  /**
   * Create or update a contact / lead in the external CRM.
   * Returns the external contact ID on success.
   */
  upsertContact(contact: CrmContact): Promise<CrmResult<{ externalId: string }>>

  /**
   * Log a completed call against a contact.
   */
  createCallEvent(event: CrmCallEvent): Promise<CrmResult>

  /**
   * Attach an AI-generated summary as a note on the contact.
   */
  createSummaryNote(note: CrmSummaryNote): Promise<CrmResult>

  /**
   * Create a follow-up task assigned to a contact.
   */
  createTask(task: CrmTask): Promise<CrmResult>

  /**
   * Update a contact's lead status / pipeline stage.
   */
  updateLeadStatus(update: CrmLeadStatusUpdate): Promise<CrmResult>

  /**
   * Record an appointment booking or status change.
   */
  createAppointmentEvent(event: CrmAppointmentEvent): Promise<CrmResult>
}

// ── Registry helper ───────────────────────────────────────────────────────────

/**
 * Map of registered CRM providers.
 * Import adapters and register them here so the application can resolve the
 * correct adapter from an IntegrationProvider string at runtime.
 *
 * Usage:
 *   import { resolveAdapter } from '@/lib/integrations/crm/adapter'
 *   const adapter = resolveAdapter(integration.provider, integration.configJson)
 */

import type { IntegrationProvider } from '@/lib/types/domain'
import { CustomWebhookAdapter } from './providers/custom-webhook'
import { HubSpotAdapter } from './providers/hubspot'
import { GhlAdapter } from './providers/ghl'
import { JaneAppAdapter } from './providers/jane-app'

type AdapterFactory = (config: Record<string, unknown>) => CrmAdapter

const ADAPTER_REGISTRY: Partial<Record<IntegrationProvider, AdapterFactory>> = {
  custom_webhook: (config) => new CustomWebhookAdapter(config),
  hubspot:        (config) => new HubSpotAdapter(config),
  ghl:            (config) => new GhlAdapter(config),
  jane_app:       (config) => new JaneAppAdapter(config),
}

export function resolveAdapter(
  provider: IntegrationProvider,
  config: Record<string, unknown>,
): CrmAdapter | null {
  const factory = ADAPTER_REGISTRY[provider]
  if (!factory) return null
  return factory(config)
}
