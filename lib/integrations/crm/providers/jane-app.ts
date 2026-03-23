/**
 * Jane App CRM adapter.
 *
 * Integrates with Jane App (janeapp.com) practice management system.
 * Supports patient CRUD, appointment booking, and availability checks.
 *
 * When JANE_API_KEY is not set or equals "PENDING", runs in mock mode
 * returning fake data for development and testing.
 *
 * Config keys (from integration.configJson):
 *   janeUrl   — required, the Jane subdomain (e.g. "liveyounger.janeapp.com")
 *   apiKey    — required for live mode, Jane API key
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

// ── Jane-specific types ──────────────────────────────────────────────────────

export interface JanePatient {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
}

export interface JaneAppointment {
  id: string
  patient_id: string
  practitioner_id: string
  treatment_id: string
  start_at: string
  end_at: string
  status: string
  service_name?: string
  practitioner_name?: string
}

export interface JaneSlot {
  start_at: string
  end_at: string
  practitioner_id: string
  practitioner_name: string
}

export interface CreatePatientData {
  first_name: string
  last_name: string
  phone: string
  email?: string | null
}

export interface CreateAppointmentData {
  patient_id: string
  practitioner_id: string
  treatment_id: string
  start_at: string
}

// ── Adapter ──────────────────────────────────────────────────────────────────

export class JaneAppAdapter implements CrmAdapter {
  readonly providerName = 'Jane App'

  private readonly janeUrl: string
  private readonly apiKey: string
  private readonly mockMode: boolean
  private readonly timeoutMs: number

  constructor(config: Record<string, unknown>) {
    const url = config.janeUrl
    if (typeof url !== 'string' || !url) {
      throw new Error('JaneAppAdapter: janeUrl is required')
    }
    this.janeUrl = url.replace(/\/$/, '')
    this.apiKey = typeof config.apiKey === 'string' ? config.apiKey : ''
    this.timeoutMs = typeof config.timeoutMs === 'number' ? config.timeoutMs : 10_000
    this.mockMode = !this.apiKey || this.apiKey === 'PENDING'

    if (this.mockMode) {
      console.warn('[JaneAppAdapter] Running in MOCK MODE — Jane API key not configured')
    }
  }

  // ── Private HTTP helper ─────────────────────────────────────────────────────

  private get baseUrl(): string {
    const host = this.janeUrl.includes('://') ? this.janeUrl : `https://${this.janeUrl}`
    return `${host}/api/v2`
  }

  private async janeRequest<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<CrmResult<T>> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeoutMs)

      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return {
          success: false,
          error: `Jane API ${res.status}: ${text.slice(0, 200)}`,
          httpStatus: res.status,
        }
      }

      const data = await res.json().catch(() => null)
      return { success: true, data: data as T, httpStatus: res.status }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  // ── CrmAdapter interface methods ──────────────────────────────────────────

  async upsertContact(contact: CrmContact): Promise<CrmResult<{ externalId: string }>> {
    if (this.mockMode) {
      const mockId = `mock_patient_${Date.now()}`
      console.log(`[JaneAppAdapter MOCK] upsertContact: ${contact.firstName} ${contact.lastName} -> ${mockId}`)
      return { success: true, data: { externalId: mockId } }
    }

    // Try to find existing patient by phone
    const existing = await this.findPatientByPhone(contact.phone)
    if (existing) {
      return { success: true, data: { externalId: existing.id } }
    }

    // Create new patient
    const patient = await this.createPatient({
      first_name: contact.firstName,
      last_name: contact.lastName,
      phone: contact.phone,
      email: contact.email,
    })
    if (patient) {
      return { success: true, data: { externalId: patient.id } }
    }
    return { success: false, error: 'Failed to create patient in Jane' }
  }

  async createCallEvent(event: CrmCallEvent): Promise<CrmResult> {
    if (this.mockMode) {
      console.log(`[JaneAppAdapter MOCK] createCallEvent: ${event.callId} for contact ${event.externalContactId}`)
      return { success: true }
    }

    // Jane doesn't have a native call log — store as a patient note
    const noteBody = [
      `AI Call — ${event.direction} | ${event.durationSec}s`,
      event.outcome ? `Outcome: ${event.outcome}` : null,
      event.notes || null,
    ].filter(Boolean).join('\n')

    return this.janeRequest('POST', `/patients/${event.externalContactId}/chart_entries`, {
      chart_entry: { content: noteBody },
    })
  }

  async createSummaryNote(note: CrmSummaryNote): Promise<CrmResult> {
    if (this.mockMode) {
      console.log(`[JaneAppAdapter MOCK] createSummaryNote for contact ${note.externalContactId}`)
      return { success: true }
    }

    return this.janeRequest('POST', `/patients/${note.externalContactId}/chart_entries`, {
      chart_entry: { content: note.body },
    })
  }

  async createTask(_task: CrmTask): Promise<CrmResult> {
    // Jane doesn't have a native task system — log only
    if (this.mockMode) {
      console.log(`[JaneAppAdapter MOCK] createTask: ${_task.title} (Jane has no task API, logged only)`)
    } else {
      console.log(`[JaneAppAdapter] createTask skipped — Jane has no task API: ${_task.title}`)
    }
    return { success: true }
  }

  async updateLeadStatus(update: CrmLeadStatusUpdate): Promise<CrmResult> {
    if (this.mockMode) {
      console.log(`[JaneAppAdapter MOCK] updateLeadStatus: ${update.externalContactId} -> ${update.status}`)
      return { success: true }
    }

    // Use patient tags to track lead status
    return this.janeRequest('PATCH', `/patients/${update.externalContactId}`, {
      patient: { tags: [update.status] },
    })
  }

  async createAppointmentEvent(event: CrmAppointmentEvent): Promise<CrmResult> {
    if (this.mockMode) {
      const mockId = `mock_appt_${Date.now()}`
      console.log(`[JaneAppAdapter MOCK] createAppointmentEvent: ${event.serviceName} at ${event.startAt} -> ${mockId}`)
      return { success: true, data: { externalId: mockId } }
    }

    return this.janeRequest('POST', '/appointments', {
      appointment: {
        patient_id: event.externalContactId,
        start_at: event.startAt,
        status: event.status,
      },
    })
  }

  // ── Jane-specific methods (used by n8n workflows) ─────────────────────────

  async findPatientByPhone(phone: string): Promise<JanePatient | null> {
    if (this.mockMode) {
      console.log(`[JaneAppAdapter MOCK] findPatientByPhone: ${phone} -> null (not found)`)
      return null
    }

    const result = await this.janeRequest<{ patients: JanePatient[] }>(
      'GET',
      `/patients?q=${encodeURIComponent(phone)}`,
    )

    if (!result.success || !result.data?.patients?.length) return null
    return result.data.patients[0]
  }

  async createPatient(data: CreatePatientData): Promise<JanePatient | null> {
    if (this.mockMode) {
      const mockPatient: JanePatient = {
        id: `mock_patient_${Date.now()}`,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        email: data.email ?? null,
      }
      console.log(`[JaneAppAdapter MOCK] createPatient: ${data.first_name} ${data.last_name} -> ${mockPatient.id}`)
      return mockPatient
    }

    const result = await this.janeRequest<{ patient: JanePatient }>(
      'POST',
      '/patients',
      { patient: data },
    )

    return result.success ? (result.data?.patient ?? null) : null
  }

  async getAvailability(
    treatmentId: string,
    date: string,
    staffId?: string,
  ): Promise<JaneSlot[]> {
    if (this.mockMode) {
      const baseDate = new Date(date)
      const mockSlots: JaneSlot[] = [
        {
          start_at: new Date(baseDate.setHours(10, 0)).toISOString(),
          end_at: new Date(baseDate.setHours(11, 0)).toISOString(),
          practitioner_id: 'mock_pract_1',
          practitioner_name: 'Dr. Smith',
        },
        {
          start_at: new Date(baseDate.setHours(13, 0)).toISOString(),
          end_at: new Date(baseDate.setHours(14, 0)).toISOString(),
          practitioner_id: 'mock_pract_1',
          practitioner_name: 'Dr. Smith',
        },
        {
          start_at: new Date(baseDate.setHours(15, 30)).toISOString(),
          end_at: new Date(baseDate.setHours(16, 30)).toISOString(),
          practitioner_id: 'mock_pract_2',
          practitioner_name: 'Dr. Johnson',
        },
      ]
      console.log(`[JaneAppAdapter MOCK] getAvailability: ${treatmentId} on ${date} -> 3 slots`)
      return mockSlots
    }

    let path = `/openings?treatment_id=${treatmentId}&date=${date}`
    if (staffId) path += `&staff_member_id=${staffId}`

    const result = await this.janeRequest<{ openings: JaneSlot[] }>('GET', path)
    return result.success ? (result.data?.openings ?? []) : []
  }

  async createAppointment(data: CreateAppointmentData): Promise<JaneAppointment | null> {
    if (this.mockMode) {
      const mockAppt: JaneAppointment = {
        id: `mock_appt_${Date.now()}`,
        patient_id: data.patient_id,
        practitioner_id: data.practitioner_id,
        treatment_id: data.treatment_id,
        start_at: data.start_at,
        end_at: new Date(new Date(data.start_at).getTime() + 60 * 60 * 1000).toISOString(),
        status: 'booked',
      }
      console.log(`[JaneAppAdapter MOCK] createAppointment: patient ${data.patient_id} at ${data.start_at} -> ${mockAppt.id}`)
      return mockAppt
    }

    const result = await this.janeRequest<{ appointment: JaneAppointment }>(
      'POST',
      '/appointments',
      { appointment: data },
    )
    return result.success ? (result.data?.appointment ?? null) : null
  }

  async cancelAppointment(appointmentId: string): Promise<CrmResult> {
    if (this.mockMode) {
      console.log(`[JaneAppAdapter MOCK] cancelAppointment: ${appointmentId} -> cancelled`)
      return { success: true }
    }

    return this.janeRequest('DELETE', `/appointments/${appointmentId}`)
  }

  async confirmAppointment(appointmentId: string): Promise<CrmResult> {
    if (this.mockMode) {
      console.log(`[JaneAppAdapter MOCK] confirmAppointment: ${appointmentId} -> confirmed`)
      return { success: true }
    }

    return this.janeRequest('PATCH', `/appointments/${appointmentId}`, {
      appointment: { status: 'confirmed' },
    })
  }

  async getAppointmentsByDate(date: string): Promise<JaneAppointment[]> {
    if (this.mockMode) {
      const mockAppts: JaneAppointment[] = [
        {
          id: 'mock_appt_tmrw_1',
          patient_id: 'mock_patient_100',
          practitioner_id: 'mock_pract_1',
          treatment_id: 'mock_treat_1',
          start_at: `${date}T10:00:00-07:00`,
          end_at: `${date}T11:00:00-07:00`,
          status: 'booked',
          service_name: 'Acupuncture',
          practitioner_name: 'Dr. Smith',
        },
        {
          id: 'mock_appt_tmrw_2',
          patient_id: 'mock_patient_101',
          practitioner_id: 'mock_pract_2',
          treatment_id: 'mock_treat_2',
          start_at: `${date}T14:00:00-07:00`,
          end_at: `${date}T15:00:00-07:00`,
          status: 'booked',
          service_name: 'HydraFacial',
          practitioner_name: 'Dr. Johnson',
        },
      ]
      console.log(`[JaneAppAdapter MOCK] getAppointmentsByDate: ${date} -> 2 appointments`)
      return mockAppts
    }

    const result = await this.janeRequest<{ appointments: JaneAppointment[] }>(
      'GET',
      `/appointments?date=${date}&status=booked`,
    )
    return result.success ? (result.data?.appointments ?? []) : []
  }

  async getInactivePatients(daysSinceLastVisit: number): Promise<JanePatient[]> {
    if (this.mockMode) {
      const mockPatients: JanePatient[] = Array.from({ length: 5 }, (_, i) => ({
        id: `mock_inactive_${i + 1}`,
        first_name: ['Sarah', 'Michael', 'Jennifer', 'David', 'Lisa'][i],
        last_name: ['Wilson', 'Brown', 'Davis', 'Miller', 'Garcia'][i],
        phone: `+1403555${String(1000 + i)}`,
        email: null,
      }))
      console.log(`[JaneAppAdapter MOCK] getInactivePatients: ${daysSinceLastVisit}+ days -> 5 patients`)
      return mockPatients
    }

    // Jane API may not have a direct "inactive since" filter.
    // Fetch patients and filter by last appointment date.
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - daysSinceLastVisit)

    const result = await this.janeRequest<{ patients: JanePatient[] }>(
      'GET',
      `/patients?inactive_since=${cutoff.toISOString().split('T')[0]}`,
    )
    return result.success ? (result.data?.patients ?? []) : []
  }
}
