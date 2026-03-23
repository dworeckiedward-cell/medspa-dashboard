import { redirect } from 'next/navigation'
import { getBookingById } from '@/lib/booking/query'
import { ConfirmedBookingClient } from './confirmed-client'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ booking?: string }>
}

export default async function ConfirmedPage({ searchParams }: Props) {
  const { booking: bookingId } = await searchParams

  if (!bookingId) {
    redirect('/book/live-younger')
  }

  const booking = await getBookingById(bookingId)

  if (!booking) {
    redirect('/book/live-younger')
  }

  const serviceName = (booking.tenant_services as unknown as { name: string; duration_minutes: number })?.name ?? 'Appointment'
  const durationMinutes = (booking.tenant_services as unknown as { name: string; duration_minutes: number })?.duration_minutes ?? 60

  return (
    <ConfirmedBookingClient
      bookingId={booking.id}
      serviceName={serviceName}
      date={booking.appointment_date}
      time={booking.appointment_time}
      practitioner={booking.practitioner_name}
      patientName={booking.patient_name}
      amountCents={booking.amount_cents}
      currency={booking.currency}
      durationMinutes={durationMinutes}
    />
  )
}
