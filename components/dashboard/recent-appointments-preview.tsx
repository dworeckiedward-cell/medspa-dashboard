'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarCheck, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buildDashboardHref } from '@/lib/dashboard/link'
import { cn } from '@/lib/utils'
import { AppointmentDetailDrawer } from '@/components/dashboard/appointment-detail-drawer'
import type { AppointmentDetail } from '@/components/dashboard/appointment-detail-drawer'

export interface RecentBooking {
  id: string
  patient_name: string
  patient_phone: string | null
  patient_email?: string | null
  appointment_date: string
  appointment_time: string
  payment_status: string
  status: string
  service_name?: string | null
  amount_cents?: number
  currency?: string
  duration_minutes?: number
  practitioner_name?: string | null
  patient_notes?: string | null
  call_log_id?: string | null
  stripe_payment_method_id?: string | null
  no_show_charged?: boolean | null
  created_at?: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`
}

function paymentPill(ps: string) {
  if (ps === 'paid' || ps === 'card_saved') return { label: ps === 'paid' ? 'Paid' : 'Card saved', className: 'bg-emerald-100 text-emerald-700' }
  if (ps === 'free') return { label: 'Free', className: 'bg-gray-100 text-gray-600' }
  return { label: 'Pending', className: 'bg-amber-100 text-amber-700' }
}

function toAppointmentDetail(b: RecentBooking): AppointmentDetail {
  return {
    id: b.id,
    patient_name: b.patient_name,
    patient_phone: b.patient_phone,
    patient_email: b.patient_email ?? null,
    appointment_date: b.appointment_date,
    appointment_time: b.appointment_time,
    practitioner_name: b.practitioner_name ?? null,
    duration_minutes: b.duration_minutes ?? 0,
    amount_cents: b.amount_cents ?? 0,
    currency: b.currency ?? 'cad',
    payment_status: b.payment_status,
    status: b.status,
    source: 'ai_booking_page',
    created_at: b.created_at ?? new Date().toISOString(),
    patient_notes: b.patient_notes ?? null,
    call_log_id: b.call_log_id ?? null,
    stripe_payment_method_id: b.stripe_payment_method_id ?? null,
    no_show_charged: b.no_show_charged ?? null,
    tenant_services: b.service_name ? { name: b.service_name } : null,
  }
}

interface RecentAppointmentsPreviewProps {
  bookings: RecentBooking[]
  tenantSlug?: string | null
  className?: string
}

export function RecentAppointmentsPreview({ bookings, tenantSlug, className }: RecentAppointmentsPreviewProps) {
  const [selected, setSelected] = useState<RecentBooking | null>(null)

  if (bookings.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-[var(--brand-muted)]" />
            Recent Appointments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
            <CalendarCheck className="h-6 w-6 text-[var(--brand-muted)] opacity-40" />
            <p className="text-sm font-semibold text-[var(--brand-text)]">No bookings yet</p>
            <p className="text-xs text-[var(--brand-muted)] opacity-60 max-w-[240px]">
              Bookings made via your AI receptionist will appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-[var(--brand-muted)]" />
              Recent Appointments
            </CardTitle>
            <Link
              href={buildDashboardHref('/dashboard/appointments', tenantSlug)}
              className="text-[11px] text-[var(--brand-primary)] hover:text-[var(--brand-primary)]/80 font-medium flex items-center gap-1 transition-colors"
            >
              View All
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y divide-[var(--brand-border)]/50">
            {bookings.slice(0, 5).map((b) => {
              const pill = paymentPill(b.payment_status)
              return (
                <div
                  key={b.id}
                  onClick={() => setSelected(b)}
                  className="flex items-center gap-3 py-3 cursor-pointer rounded-lg hover:bg-[var(--brand-bg)]/60 transition-colors -mx-1 px-1"
                >
                  {/* Payment pill */}
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight', pill.className)}>
                    {pill.label}
                  </span>

                  {/* Patient + service */}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--brand-text)] truncate">
                      {b.patient_name}
                    </p>
                    {b.service_name && (
                      <p className="text-[11px] text-[var(--brand-muted)] truncate mt-0.5">
                        {b.service_name}
                      </p>
                    )}
                  </div>

                  {/* Date + time */}
                  <span className="text-[11px] tabular-nums text-[var(--brand-muted)] shrink-0 whitespace-nowrap">
                    {formatDate(b.appointment_date)} · {formatTime(b.appointment_time)}
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {selected && (
        <AppointmentDetailDrawer
          booking={toAppointmentDetail(selected)}
          onClose={() => setSelected(null)}
          tenantSlug={tenantSlug}
        />
      )}
    </>
  )
}
