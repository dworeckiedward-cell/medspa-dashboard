export interface BookingService {
  id: string
  categoryId: string
  categoryName: string
  name: string
  description: string | null
  durationMinutes: number
  priceCents: number
  currency: string
  practitioners: string[]
  priceVaries: boolean
  sortOrder: number
}

export interface BookingCategory {
  id: string
  name: string
  description: string | null
  sortOrder: number
  services: BookingService[]
}

export interface BookingSlot {
  time: string
  practitioner: string
  staffMemberId?: string
}

export interface BookingFormData {
  // Step 1
  service: BookingService | null
  // Step 2
  date: string | null
  slot: BookingSlot | null
  // Step 3
  firstName: string
  lastName: string
  phone: string
  email: string
  notes: string
}

export type BookingStep = 'service' | 'datetime' | 'details' | 'payment' | 'confirmed'

export interface BookingConfirmation {
  bookingId: string
  serviceName: string
  appointmentDate: string
  appointmentTime: string
  practitioner: string | null
  amountCents: number
  currency: string
  patientName: string
  paymentStatus: string
}
