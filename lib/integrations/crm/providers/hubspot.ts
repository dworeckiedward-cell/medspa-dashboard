/**
 * HubSpot CRM adapter — placeholder.
 *
 * TODO: Implement using the HubSpot v3 Contacts / Engagements API.
 *   Docs: https://developers.hubspot.com/docs/api/crm/contacts
 *
 * Config keys expected:
 *   accessToken — HubSpot private app access token
 *   portalId    — HubSpot account / portal ID
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
  error: 'HubSpot adapter not yet implemented',
}

export class HubSpotAdapter implements CrmAdapter {
  readonly providerName = 'HubSpot'

  constructor(_config: Record<string, unknown>) {
    // TODO: validate accessToken + portalId
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
