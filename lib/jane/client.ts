/**
 * Jane App API client — wraps Jane Developer Platform (JDP) API.
 *
 * Feature flag: JANE_API_ENABLED
 *   false (default) → use fallback static schedule
 *   true → use real Jane API for availability + auto-booking
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'

export interface JaneSlot {
  time: string        // "09:00"
  practitioner: string
  staffMemberId?: string
}

export interface JanePatient {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string
}

export interface JaneAppointment {
  id: string
  treatmentId: string
  patientId: string
  staffMemberId: string
  date: string
  time: string
  status: string
}

const JANE_API_ENABLED = process.env.JANE_API_ENABLED === 'true'

// Static fallback schedule when Jane API not available
const PRACTITIONER_SCHEDULE: Record<number, string[]> = {
  1: ['Taylor Lekach', 'Dr. Lasheka Morgan'],           // Monday
  2: ['Dr. Salma Mitha', 'Hanna Stoliarova'],           // Tuesday
  3: ['Hanna Stoliarova'],                                // Wednesday
  4: ['Hanna Dutkowska', 'Dr. Salma Mitha', 'Dr. Lasheka Morgan', 'Michal Ofer', 'Young Suk Cho'], // Thursday
  5: ['Dr. Matthew Rider', 'Hanna Stoliarova'],          // Friday
  6: ['Dr. Salma Mitha', 'Dr. Lasheka Morgan'],         // Saturday
  0: [],                                                   // Sunday — closed
}

function generateFallbackSlots(date: string, practitioners: string[]): JaneSlot[] {
  const d = new Date(date + 'T00:00:00')
  const dayOfWeek = d.getDay()
  const available = PRACTITIONER_SCHEDULE[dayOfWeek] ?? []

  // Filter to only practitioners who offer this service
  const matching = available.filter(p => practitioners.includes(p))
  if (matching.length === 0) return []

  // Generate 30-min slots from 9 AM to 5 PM
  const slots: JaneSlot[] = []
  for (let hour = 9; hour < 17; hour++) {
    for (const min of [0, 30]) {
      const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
      for (const practitioner of matching) {
        slots.push({ time, practitioner })
      }
    }
  }
  return slots
}

export class JaneClient {
  private tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  private async getTokens() {
    const supabase = createSupabaseServerClient()
    const { data } = await supabase
      .from('jane_integrations')
      .select('access_token, refresh_token, token_expires_at, clinic_url')
      .eq('tenant_id', this.tenantId)
      .eq('status', 'connected')
      .maybeSingle()
    return data
  }

  private async refreshTokenIfNeeded(tokens: { access_token: string | null; refresh_token: string | null; token_expires_at: string | null; clinic_url: string }) {
    if (!tokens.token_expires_at || !tokens.access_token) return tokens.access_token

    const expiresAt = new Date(tokens.token_expires_at)
    if (expiresAt > new Date(Date.now() + 60_000)) return tokens.access_token

    // Token expired or expiring soon — refresh
    if (!tokens.refresh_token) return null

    try {
      const res = await fetch(`${process.env.JANE_IAM_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
          client_id: process.env.JANE_CLIENT_ID!,
          client_secret: process.env.JANE_CLIENT_SECRET!,
        }),
      })

      if (!res.ok) {
        console.error('[jane] Token refresh failed:', res.status)
        // Mark integration as error
        const supabase = createSupabaseServerClient()
        await supabase
          .from('jane_integrations')
          .update({ status: 'error', updated_at: new Date().toISOString() })
          .eq('tenant_id', this.tenantId)
        return null
      }

      const data = await res.json()
      const supabase = createSupabaseServerClient()
      await supabase
        .from('jane_integrations')
        .update({
          access_token: data.access_token,
          refresh_token: data.refresh_token ?? tokens.refresh_token,
          token_expires_at: new Date(Date.now() + (data.expires_in ?? 300) * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', this.tenantId)

      return data.access_token as string
    } catch (err) {
      console.error('[jane] Token refresh error:', err)
      return null
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async apiCall(path: string, options?: RequestInit): Promise<any> {
    const tokens = await this.getTokens()
    if (!tokens) throw new Error('Jane integration not connected')

    const accessToken = await this.refreshTokenIfNeeded(tokens)
    if (!accessToken) throw new Error('Jane token refresh failed')

    const baseUrl = tokens.clinic_url.replace(/\/$/, '')
    const res = await fetch(`${baseUrl}/api/2025-02-28-beta${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (res.status === 429) {
      // Rate limited — wait and retry once
      await new Promise(r => setTimeout(r, 2000))
      return this.apiCall(path, options)
    }

    if (!res.ok) {
      throw new Error(`Jane API error: ${res.status} ${await res.text()}`)
    }

    return res.json()
  }

  async getAvailability(treatmentId: string, date: string, practitioners: string[]): Promise<JaneSlot[]> {
    if (!JANE_API_ENABLED) {
      return generateFallbackSlots(date, practitioners)
    }

    try {
      const data = await this.apiCall(`/appointments?treatment_id=${treatmentId}&date=${date}&available=true`)
      // Transform Jane API response to our slot format
      return (data.data ?? []).map((slot: Record<string, unknown>) => ({
        time: (slot.start_at as string)?.slice(11, 16) ?? '',
        practitioner: (slot.staff_member as Record<string, unknown>)?.name as string ?? '',
        staffMemberId: (slot.staff_member as Record<string, unknown>)?.id as string,
      }))
    } catch (err) {
      console.error('[jane] Availability fetch failed, using fallback:', err)
      return generateFallbackSlots(date, practitioners)
    }
  }

  async createPatient(firstName: string, lastName: string, phone: string, email: string): Promise<JanePatient | null> {
    if (!JANE_API_ENABLED) return null

    try {
      const data = await this.apiCall('/patients', {
        method: 'POST',
        body: JSON.stringify({
          patient: { first_name: firstName, last_name: lastName, phone, email }
        }),
      })
      return {
        id: data.data?.id ?? '',
        firstName, lastName, phone, email,
      }
    } catch (err) {
      console.error('[jane] Create patient failed:', err)
      return null
    }
  }

  async findPatient(phone: string): Promise<JanePatient | null> {
    if (!JANE_API_ENABLED) return null

    try {
      const data = await this.apiCall(`/patients?phone=${encodeURIComponent(phone)}`)
      const patient = data.data?.[0]
      if (!patient) return null
      return {
        id: patient.id,
        firstName: patient.first_name ?? '',
        lastName: patient.last_name ?? '',
        phone: patient.phone ?? '',
        email: patient.email ?? '',
      }
    } catch (err) {
      console.error('[jane] Find patient failed:', err)
      return null
    }
  }

  async createAppointment(
    patientId: string,
    treatmentId: string,
    staffMemberId: string,
    date: string,
    time: string,
  ): Promise<JaneAppointment | null> {
    if (!JANE_API_ENABLED) return null

    try {
      const data = await this.apiCall('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          appointment: {
            patient_id: patientId,
            treatment_id: treatmentId,
            staff_member_id: staffMemberId,
            date,
            start_at: `${date}T${time}:00`,
          }
        }),
      })
      return {
        id: data.data?.id ?? '',
        treatmentId,
        patientId,
        staffMemberId,
        date,
        time,
        status: data.data?.status ?? 'booked',
      }
    } catch (err) {
      console.error('[jane] Create appointment failed:', err)
      return null
    }
  }

  async getClinicUrl(): Promise<string | null> {
    const tokens = await this.getTokens()
    return tokens?.clinic_url ?? null
  }

  async getTreatments() {
    if (!JANE_API_ENABLED) return []
    const data = await this.apiCall('/treatments')
    return data.data ?? []
  }

  async getStaffMembers() {
    if (!JANE_API_ENABLED) return []
    const data = await this.apiCall('/staff_members')
    return data.data ?? []
  }
}
