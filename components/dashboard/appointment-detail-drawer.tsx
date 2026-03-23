'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import {
  Phone,
  Mail,
  Calendar,
  Clock,
  User,
  DollarSign,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn, formatCurrency } from '@/lib/utils'
import { buildTenantApiUrl } from '@/lib/dashboard/tenant-api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppointmentDetail {
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPhone(raw: string | null): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 11 && digits[0] === '1') return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  return raw
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`
}

function paymentBadgeStyle(ps: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40' },
    pending_jane: { label: 'Pending (Jane)', className: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40' },
    pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40' },
    card_saved: { label: 'Card saved', className: 'bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900/40' },
    free: { label: 'Free', className: 'bg-gray-50 text-gray-600 border border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-700' },
  }
  return map[ps] ?? { label: ps, className: 'bg-gray-50 text-gray-600 border border-gray-200' }
}

function statusBadgeStyle(s: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    confirmed: { label: 'Confirmed', className: 'text-emerald-600 dark:text-emerald-400' },
    completed: { label: 'Completed', className: 'text-blue-600 dark:text-blue-400' },
    cancelled: { label: 'Cancelled', className: 'text-rose-600 dark:text-rose-400' },
    no_show: { label: 'No-show', className: 'text-rose-600 dark:text-rose-400' },
    pending: { label: 'Pending', className: 'text-amber-600 dark:text-amber-400' },
  }
  return map[s] ?? { label: s, className: 'text-[var(--brand-muted)]' }
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmOverlay({
  title,
  message,
  confirmLabel,
  confirmClass,
  onConfirm,
  onCancel,
  extra,
}: {
  title: string
  message: string
  confirmLabel: string
  confirmClass: string
  onConfirm: () => void
  onCancel: () => void
  extra?: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--brand-text)]">{title}</h3>
            <p className="text-xs text-[var(--brand-muted)] mt-1">{message}</p>
          </div>
        </div>
        {extra}
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-[var(--brand-border)] text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors', confirmClass)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── No-show confirm ───────────────────────────────────────────────────────────

function NoShowOverlay({
  hasCard,
  onConfirm,
  onCancel,
}: {
  hasCard: boolean
  onConfirm: (chargeCard: boolean) => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <div className="flex items-start gap-3 mb-5">
          <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--brand-text)]">Mark as No-Show</h3>
            <p className="text-xs text-[var(--brand-muted)] mt-1">
              {hasCard
                ? 'This patient has a saved card. Charge the $50 no-show fee?'
                : 'No saved payment method on file. Booking will be marked as no-show only.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-[var(--brand-border)] text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors">
            Cancel
          </button>
          {hasCard && (
            <button onClick={() => onConfirm(true)} className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 transition-colors">
              Charge $50 + Mark No-Show
            </button>
          )}
          <button
            onClick={() => onConfirm(false)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              hasCard
                ? 'border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/30'
                : 'bg-rose-500 text-white hover:bg-rose-600',
            )}
          >
            Mark No-Show Only
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Detail row ────────────────────────────────────────────────────────────────

function DetailRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 w-7 h-7 rounded-lg bg-[var(--brand-bg)] border border-[var(--brand-border)]/60 flex items-center justify-center mt-0.5">
        <Icon className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wider">{label}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface AppointmentDetailDrawerProps {
  booking: AppointmentDetail | null
  onClose: () => void
  onDeleted?: () => void
  tenantSlug?: string | null
}

export function AppointmentDetailDrawer({ booking, onClose, onDeleted, tenantSlug }: AppointmentDetailDrawerProps) {
  const router = useRouter()
  const [currentStatus, setCurrentStatus] = useState(booking?.status ?? '')
  const [loading, setLoading] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'cancel' | 'noshow' | null>(null)
  const [done, setDone] = useState<string | null>(null)

  if (!booking) return null

  const svcName = (booking.tenant_services as { name: string } | null)?.name ?? null
  const payBadge = paymentBadgeStyle(booking.payment_status)
  const statusInfo = statusBadgeStyle(currentStatus || booking.status)
  const formattedDate = format(parseISO(booking.appointment_date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')
  const isUpcoming = booking.appointment_date >= new Date().toISOString().slice(0, 10) && (currentStatus || booking.status) === 'confirmed'
  const isTerminal = ['completed', 'cancelled', 'no_show'].includes(currentStatus || booking.status)
  const hasCard = !!booking.stripe_payment_method_id && !booking.no_show_charged

  async function updateStatus(status: string) {
    console.log('[AppointmentDrawer] updateStatus called', { bookingId: booking!.id, status })
    setLoading(status)
    try {
      const res = await fetch(buildTenantApiUrl(`/api/bookings/${booking!.id}/status`, tenantSlug), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      console.log('[AppointmentDrawer] updateStatus response', res.status, res.ok)
      if (res.ok) {
        setCurrentStatus(status)
        setDone(status)
        router.refresh()
      } else {
        const body = await res.json().catch(() => ({}))
        console.error('[AppointmentDrawer] updateStatus failed', res.status, body)
        alert(`Failed to update status (${res.status}): ${(body as { error?: string }).error ?? 'Unknown error'}`)
      }
    } catch (err) {
      console.error('[AppointmentDrawer] updateStatus error', err)
      alert(`Network error: ${String(err)}`)
    } finally {
      setLoading(null)
      setConfirm(null)
    }
  }

  async function handleNoShow(chargeCard: boolean) {
    setConfirm(null)
    setLoading('no_show')
    try {
      if (chargeCard && tenantSlug) {
        await fetch(`/api/book/${tenantSlug}/charge-noshow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: booking!.id }),
        })
      }
      await updateStatus('no_show')
    } finally {
      setLoading(null)
    }
  }

  async function handleCancel() {
    setConfirm(null)
    await updateStatus('cancelled')
    onDeleted?.()
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[var(--brand-border)]/50">
            <div className="flex items-start justify-between gap-3 pr-6">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-lg font-bold leading-tight truncate">
                    {booking.patient_name}
                  </DialogTitle>
                  {isUpcoming && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40">
                      Upcoming
                    </span>
                  )}
                </div>
                <p className={cn('text-xs font-medium mt-0.5', statusInfo.className)}>
                  {statusInfo.label}
                </p>
              </div>
              <span className={cn('shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg', payBadge.className)}>
                {payBadge.label}
              </span>
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {/* Contact */}
            {booking.patient_phone && (
              <DetailRow icon={Phone} label="Phone">
                <a href={`tel:${booking.patient_phone}`} className="text-sm text-[var(--brand-text)] hover:text-[var(--brand-primary)] transition-colors">
                  {formatPhone(booking.patient_phone) ?? booking.patient_phone}
                </a>
              </DetailRow>
            )}
            {booking.patient_email && (
              <DetailRow icon={Mail} label="Email">
                <a href={`mailto:${booking.patient_email}`} className="text-sm text-[var(--brand-text)] hover:text-[var(--brand-primary)] transition-colors truncate block">
                  {booking.patient_email}
                </a>
              </DetailRow>
            )}

            <DetailRow icon={Calendar} label="Date">
              <p className="text-sm text-[var(--brand-text)]">{formattedDate}</p>
            </DetailRow>
            <DetailRow icon={Clock} label="Time">
              <p className="text-sm text-[var(--brand-text)]">{formatTime(booking.appointment_time)} · {booking.duration_minutes} min</p>
            </DetailRow>

            {svcName && (
              <DetailRow icon={CheckCircle2} label="Service">
                <p className="text-sm text-[var(--brand-text)]">{svcName}</p>
              </DetailRow>
            )}
            {booking.practitioner_name && (
              <DetailRow icon={User} label="Practitioner">
                <p className="text-sm text-[var(--brand-text)]">{booking.practitioner_name}</p>
              </DetailRow>
            )}
            <DetailRow icon={DollarSign} label="Amount">
              <p className="text-sm text-[var(--brand-text)]">
                {booking.amount_cents > 0
                  ? formatCurrency(booking.amount_cents / 100, booking.currency.toUpperCase())
                  : 'Free / Pay at clinic'}
              </p>
            </DetailRow>

            {/* Source */}
            <DetailRow icon={ExternalLink} label="Source">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--brand-text)]">
                  {booking.source === 'ai_booking_page' ? 'AI Booking Page' : booking.source ?? 'Unknown'}
                </span>
                {booking.call_log_id && (
                  <a href={`/dashboard/call-logs/${booking.call_log_id}`} className="flex items-center gap-1 text-xs text-[var(--brand-primary)] hover:underline">
                    <ExternalLink className="h-3 w-3" />
                    Call
                  </a>
                )}
              </div>
              <p className="text-[11px] text-[var(--brand-muted)] mt-0.5">
                Booked {format(parseISO(booking.created_at), 'MMM d, yyyy · h:mm a')}
              </p>
            </DetailRow>

            {/* Notes */}
            {booking.patient_notes && (
              <DetailRow icon={FileText} label="Notes">
                <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)]/40 px-3 py-2.5 mt-1">
                  <p className="text-xs text-[var(--brand-text)] leading-relaxed whitespace-pre-wrap">
                    {booking.patient_notes}
                  </p>
                </div>
              </DetailRow>
            )}
          </div>

          {/* Actions footer */}
          <div className="px-6 py-4 border-t border-[var(--brand-border)]/50 space-y-3">
            {done ? (
              <div className="flex items-center gap-2 text-xs text-[var(--brand-muted)]">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                {done === 'completed' ? 'Marked as completed' : done === 'cancelled' ? 'Appointment cancelled' : 'Marked as no-show'}
              </div>
            ) : isTerminal ? (
              <p className="text-xs text-[var(--brand-muted)]">This appointment is {statusInfo.label.toLowerCase()}.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={!!loading}
                  onClick={() => { console.log('[AppointmentDrawer] Mark Completed clicked'); updateStatus('completed') }}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {loading === 'completed' ? 'Saving…' : 'Mark Completed'}
                </button>
                <button
                  disabled={!!loading}
                  onClick={() => { console.log('[AppointmentDrawer] Mark No-Show clicked'); setConfirm('noshow') }}
                  className="flex items-center gap-1.5 rounded-lg border border-rose-300/60 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  {loading === 'no_show' ? 'Saving…' : 'Mark No-Show'}
                </button>
                <button
                  disabled={!!loading}
                  onClick={() => { console.log('[AppointmentDrawer] Cancel clicked'); setConfirm('cancel') }}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--brand-border)] px-3 py-1.5 text-xs font-medium text-[var(--brand-muted)] hover:text-rose-600 hover:border-rose-300/60 transition-colors disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  {loading === 'cancelled' ? 'Cancelling…' : 'Cancel Appointment'}
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel confirm */}
      {confirm === 'cancel' && (
        <ConfirmOverlay
          title="Cancel Appointment"
          message="Are you sure? This will cancel the appointment. The patient will need to be notified separately."
          confirmLabel="Yes, Cancel Appointment"
          confirmClass="bg-rose-500 text-white hover:bg-rose-600"
          onConfirm={handleCancel}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* No-show confirm */}
      {confirm === 'noshow' && (
        <NoShowOverlay
          hasCard={hasCard}
          onConfirm={handleNoShow}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  )
}
