'use client'

import { useCallback } from 'react'

const T = {
  primary: '#0D9488',
  bg: '#FAFAFA',
  card: '#FFFFFF',
  text: '#1A1A1A',
  muted: '#6B7280',
  border: '#E5E7EB',
  success: '#10B981',
}

function formatPrice(cents: number): string {
  if (cents === 0) return 'Free Consultation'
  const dollars = cents / 100
  return `$${dollars % 1 === 0 ? dollars.toFixed(0) : dollars.toFixed(2)}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`
}

interface Props {
  bookingId: string
  serviceName: string
  date: string
  time: string
  practitioner: string | null
  patientName: string
  amountCents: number
  currency: string
  durationMinutes: number
}

export function ConfirmedBookingClient({
  serviceName,
  date,
  time,
  practitioner,
  patientName,
  amountCents,
  currency,
  durationMinutes,
}: Props) {
  const generateICS = useCallback(() => {
    const startDate = new Date(`${date}T${time}:00`)
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000)
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `DTSTART:${fmt(startDate)}`,
      `DTEND:${fmt(endDate)}`,
      `SUMMARY:${serviceName} - Live Younger`,
      'LOCATION:518-922 5 Ave SW\\, Calgary\\, AB',
      `DESCRIPTION:Appointment with ${practitioner ?? 'Live Younger'}\\nPhone: (403) 237-2353`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'live-younger-appointment.ics'
    a.click()
    URL.revokeObjectURL(url)
  }, [date, time, practitioner, serviceName, durationMinutes])

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 border-b" style={{ borderColor: T.border }}>
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold tracking-tight" style={{ color: T.text }}>
              Live Younger
            </h1>
            <p className="text-xs" style={{ color: T.muted }}>
              Medical Aesthetics & Wellness
            </p>
          </div>
          <div className="flex items-center justify-center w-8 h-8 rounded-full" style={{ background: T.success }}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pb-12">
        <div className="py-10 space-y-8">
          {/* Checkmark animation */}
          <div className="flex justify-center" style={{ animation: 'fadeScale 0.5s ease-out' }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: `${T.success}15` }}>
              <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 13l4 4L19 7"
                  stroke={T.success}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    strokeDasharray: 24,
                    strokeDashoffset: 24,
                    animation: 'drawCheck 0.6s ease-out 0.3s forwards',
                  }}
                />
              </svg>
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold" style={{ color: T.text }}>You're all set!</h2>
            <p className="text-sm mt-2" style={{ color: T.muted }}>
              Your appointment has been confirmed.
            </p>
          </div>

          {/* Summary */}
          <div className="rounded-2xl p-5" style={{ background: T.card, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div className="space-y-3 text-sm">
              <Row label="Service" value={serviceName} />
              <Row label="Date" value={formatDate(date)} />
              <Row label="Time" value={formatTime(time)} />
              {practitioner && <Row label="Practitioner" value={practitioner} />}
              <Row label="Patient" value={patientName} />
              {amountCents > 0 && (
                <div className="flex justify-between pt-3 border-t" style={{ borderColor: T.border }}>
                  <span className="font-semibold" style={{ color: T.text }}>Amount</span>
                  <span className="font-bold" style={{ color: T.text }}>
                    {formatPrice(amountCents)} {currency.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Add to calendar */}
          <button
            onClick={generateICS}
            className="w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98]"
            style={{ border: `1.5px solid ${T.primary}`, color: T.primary }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Add to Calendar
          </button>

          {/* Clinic info */}
          <div className="text-center space-y-1">
            <p className="text-sm font-medium" style={{ color: T.text }}>Live Younger Medical Aesthetics</p>
            <p className="text-xs" style={{ color: T.muted }}>518-922 5 Ave SW, Calgary, AB</p>
            <p className="text-xs" style={{ color: T.muted }}>(403) 237-2353 &middot; info@liveyounger.ca</p>
          </div>

          <p className="text-[11px] text-center" style={{ color: T.muted }}>
            Need to reschedule? Call us at least 24 hours before your appointment. A $50 fee applies for no-shows or late cancellations.
          </p>
        </div>
      </main>

      <style>{`
        @keyframes drawCheck {
          to { stroke-dashoffset: 0; }
        }
        @keyframes fadeScale {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm" style={{ color: '#6B7280' }}>{label}</span>
      <span className="text-sm font-medium text-right" style={{ color: '#1A1A1A' }}>{value}</span>
    </div>
  )
}
