/**
 * GoHighLevel (GHL) CRM adapter — placeholder.
 *
 * TODO: Implement using the GHL v2 API.
 *   Docs: https://highlevel.stoplight.io/docs/integrations/
 *
 * Config keys expected:
 *   apiKey     — GHL API key (or OAuth access token)
 *   locationId — GHL sub-account / location ID
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

const NOT_IMPLEMENTED: CrmResult = {
  success: false,
  error: 'GoHighLevel adapter not yet implemented',
}

export class GhlAdapter implements CrmAdapter {
  readonly providerName = 'GoHighLevel'

  constructor(_config: Record<string, unknown>) {
    // TODO: validate apiKey + locationId
  }

  async upsertContact(_contact: CrmContact): Promise<CrmResult<{ externalId: string }>> {
    return NOT_IMPLEMENTED as CrmResult<{ externalId: string }>
  }

  async createCallEvent(_event: CrmCallEvent): Promise<CrmResult> {
    return NOT_IMPLEMENTED
  }

  async createSummaryNote(_note: CrmSummaryNote): Promise<CrmResult> {
    return NOT_IMPLEMENTED
  }

  async createTask(_task: CrmTask): Promise<CrmResult> {
    return NOT_IMPLEMENTED
  }

  async updateLeadStatus(_update: CrmLeadStatusUpdate): Promise<CrmResult> {
    return NOT_IMPLEMENTED
  }

  async createAppointmentEvent(_event: CrmAppointmentEvent): Promise<CrmResult> {
    return NOT_IMPLEMENTED
  }
}
