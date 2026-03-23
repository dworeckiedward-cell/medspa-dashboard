'use client'

import { useState, useMemo } from 'react'
import { CalendarCheck, Search } from 'lucide-react'
import { AppointmentDetailDrawer } from '@/components/dashboard/appointment-detail-drawer'
import type { AppointmentDetail } from '@/components/dashboard/appointment-detail-drawer'

interface Booking {
  id: string
  patient_name: string
  patient_phone: string | null
  patient_email: string | null
  appointment_date: string
  appointment_time: string
  practitioner_name: string | null
  duration_minutes: number
  amount_cents: number
  currency: string
  payment_status: string
  status: string
  source: string | null
  created_at: string
  patient_notes?: string | null
  call_log_id?: string | null
  stripe_payment_method_id?: string | null
  no_show_charged?: boolean | null
  tenant_services: unknown
}

function formatPhone(raw: string | null): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 9) return `+48 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 11 && digits[0] === '1') return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  if (digits.length >= 11) return `+${digits.slice(0, digits.length - 10)} (${digits.slice(-10, -7)}) ${digits.slice(-7, -4)}-${digits.slice(-4)}`
  return raw
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
    no_show: 'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-blue-50 text-blue-700 border-blue-200',
  }
  return colors[status] ?? 'bg-gray-50 text-gray-700 border-gray-200'
}

function paymentBadge(ps: string) {
  const colors: Record<string, string> = {
    paid: 'bg-emerald-50 text-emerald-700',
    pending_jane: 'bg-blue-50 text-blue-700',
    pending: 'bg-amber-50 text-amber-700',
    free: 'bg-gray-50 text-gray-600',
  }
  const labels: Record<string, string> = {
    paid: 'Paid (Jane)',
    pending_jane: 'Pending (Jane)',
    pending: 'Pending',
    free: 'Free',
  }
  return { className: colors[ps] ?? 'bg-gray-50 text-gray-600', label: labels[ps] ?? ps }
}

export function AppointmentsTable({ bookings, tenantSlug }: { bookings: Booking[]; tenantSlug?: string | null }) {
  const [search, setSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Booking | null>(null)

  const filtered = useMemo(() => {
    let list = bookings
    if (paymentFilter === 'paid') {
      list = list.filter(b => b.payment_status === 'paid')
    } else if (paymentFilter === 'pending') {
      list = list.filter(b => ['pending', 'pending_jane', 'card_saved'].includes(b.payment_status))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(b =>
        b.patient_name.toLowerCase().includes(q) ||
        b.patient_phone?.includes(q) ||
        b.patient_email?.toLowerCase().includes(q) ||
        ((b.tenant_services as { name: string } | null)?.name ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [bookings, search, paymentFilter])

  const upcoming = filtered.filter(b => b.appointment_date >= new Date().toISOString().slice(0, 10) && b.status === 'confirmed').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-[var(--brand-primary)]" />
          <h2 className="text-lg font-bold text-[var(--brand-text)]">Appointments</h2>
          {upcoming > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              {upcoming} upcoming
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--brand-muted)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patient, service..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] text-sm text-[var(--brand-text)] outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
          />
        </div>
        <div className="flex gap-1.5">
          {[
            { value: 'all', label: 'All' },
            { value: 'paid', label: 'Paid' },
            { value: 'pending', label: 'Pending' },
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setPaymentFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                paymentFilter === tab.value
                  ? 'bg-[var(--brand-primary)] text-white'
                  : 'bg-[var(--brand-surface)] text-[var(--brand-muted)] hover:bg-[var(--brand-bg)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <CalendarCheck className="h-8 w-8 mx-auto text-[var(--brand-muted)] opacity-40" />
          <p className="text-sm text-[var(--brand-muted)] mt-2">No appointments found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--brand-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--brand-surface)] border-b border-[var(--brand-border)]">
                <th className="text-left px-4 py-3 font-medium text-[var(--brand-muted)]">Patient</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--brand-muted)]">Service</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--brand-muted)]">Date & Time</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--brand-muted)]">Practitioner</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--brand-muted)]">Payment</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--brand-muted)]">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const svcName = (b.tenant_services as { name: string } | null)?.name ?? '—'
                const pb = paymentBadge(b.payment_status)
                return (
                  <tr key={b.id} onClick={() => setSelected(b)} className="border-b border-[var(--brand-border)] last:border-0 hover:bg-[var(--brand-bg)]/50 cursor-pointer">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--brand-text)]">{b.patient_name}</p>
                      <p className="text-xs text-[var(--brand-muted)]">{formatPhone(b.patient_phone) ?? b.patient_email ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--brand-text)]">{svcName}</td>
                    <td className="px-4 py-3">
                      <p className="text-[var(--brand-text)]">{formatDate(b.appointment_date)}</p>
                      <p className="text-xs text-[var(--brand-muted)]">{formatTime(b.appointment_time)} · {b.duration_minutes}min</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--brand-text)]">{b.practitioner_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${pb.className}`}>
                        {pb.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge(b.status)}`}>
                        {b.status === 'no_show' ? 'No-show' : b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <AppointmentDetailDrawer
          booking={selected as AppointmentDetail}
          onClose={() => setSelected(null)}
          tenantSlug={tenantSlug}
        />
      )}
    </div>
  )
}
