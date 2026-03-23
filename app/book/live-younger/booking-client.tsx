'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import type { BookingCategory, BookingService, BookingSlot } from '@/lib/booking/types'

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  teal:       '#0D9488',
  tealDark:   '#0F766E',
  tealDeep:   '#115E59',
  tealSoft:   '#CCFBF1',
  tealGhost:  '#F0FDFA',
  bg:         '#F8FAFB',
  card:       '#FFFFFF',
  text:       '#111827',
  textMid:    '#374151',
  muted:      '#6B7280',
  subtle:     '#9CA3AF',
  border:     '#E5E7EB',
  borderSoft: '#F9FAFB',
  success:    '#059669',
  shadow:     '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
  shadowMd:   '0 4px 24px rgba(13,148,136,0.10), 0 1px 4px rgba(0,0,0,0.06)',
  shadowLg:   '0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
}

const LOGO_URL = 'https://assets-jane-cac1-52.janeapp.net/pub/W1siZiIsImRyYWdvbmZseS82Njg2OS9pbWFnZS9waG90by8yMDI1LTAxLTA4LzIzMTI1MS8yNWI2ODViOS1jZDZiLTRjZWEtOTA1ZS1jNWExNTVhNzU0NjAvMS5wbmciXSxbInAiLCJ0aHVtYiIsIjYwMHg2MDA-Il1d?sha=cf01510ddd8d48d3&for=liveyounger.janeapp.com'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(cents: number, varies: boolean): string {
  if (varies) return 'Pricing at consult'
  if (cents === 0) return 'Complimentary'
  const d = cents / 100
  return `$${d % 1 === 0 ? d.toFixed(0) : d.toFixed(2)} CAD`
}

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60); const m = min % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function formatPhone(v: string): string {
  const digits = v.replace(/\D/g, '')
  // 9 digits → Polish mobile: +48 XXX XXX XXX
  if (digits.length === 9) return `+48 ${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6)}`
  // 11 digits starting with 1 → North American with country code: +1 (XXX) XXX-XXXX
  if (digits.length === 11 && digits[0] === '1') return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`
  // 10 digits → North American: (XXX) XXX-XXXX
  const d = digits.slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`
}

type Step = 'service' | 'datetime' | 'details' | 'confirmed'

// ── Main ──────────────────────────────────────────────────────────────────

interface BookingPageClientProps {
  categories: BookingCategory[]
  tenantId: string
  initialCategory?: string
  initialRef?: string
  initialName?: string
  initialPhone?: string
}

export function BookingPageClient({ categories, tenantId, initialCategory, initialRef, initialName, initialPhone }: BookingPageClientProps) {
  const [step, setStep] = useState<Step>('service')
  const [svc, setSvc] = useState<BookingService | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [slot, setSlot] = useState<BookingSlot | null>(null)
  const [firstName, setFirstName] = useState(initialName?.split(' ')[0] ?? '')
  const [lastName, setLastName] = useState(initialName?.split(' ').slice(1).join(' ') ?? '')
  const [phone, setPhone] = useState(initialPhone ? formatPhone(initialPhone) : '')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [slots, setSlots] = useState<BookingSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [dir, setDir] = useState<'fwd' | 'bk'>('fwd')

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [step])

  useEffect(() => {
    if (!svc || !date) return
    setSlotsLoading(true); setSlot(null)
    fetch(`/api/book/live-younger/availability?serviceId=${svc.id}&date=${date}`)
      .then(r => r.json()).then(d => setSlots(d.slots ?? []))
      .catch(() => setSlots([])).finally(() => setSlotsLoading(false))
  }, [svc, date])

  function fwd(s: Step) { setDir('fwd'); setStep(s) }
  function bk(s: Step) { setDir('bk'); setStep(s) }

  async function submit() {
    if (!svc || !date || !slot) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/book/live-younger/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: svc.id, date, time: slot.time, practitioner: slot.practitioner, staffMemberId: slot.staffMemberId, firstName, lastName, phone: phone.replace(/\D/g, ''), email, notes, ref: initialRef, tenantId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSubmitError((err as { error?: string }).error ?? 'Something went wrong. Please try again.')
        return
      }
      const data = await res.json() as { checkoutUrl?: string; bookingId?: string; skipPayment?: boolean }
      if (data.checkoutUrl) window.location.href = data.checkoutUrl
      else if (data.bookingId) { setBookingId(data.bookingId); fwd('confirmed') }
      else setSubmitError('Booking could not be created. Please try again.')
    } catch {
      setSubmitError('Network error. Please check your connection and try again.')
    } finally { setSubmitting(false) }
  }

  const steps: Step[] = ['service', 'datetime', 'details']
  const stepIdx = steps.indexOf(step)

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${C.border}`, boxShadow: '0 1px 0 rgba(0,0,0,0.04)' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 20px', height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
          {step !== 'service' && step !== 'confirmed' && (
            <button onClick={() => { if (step === 'datetime') bk('service'); else if (step === 'details') bk('datetime') }}
              style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${C.border}`, background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" fill="none" stroke={C.textMid} strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: C.tealGhost, boxShadow: '0 0 0 2px rgba(13,148,136,0.12)' }}>
              <Image src={LOGO_URL} alt="Live Younger" width={36} height={36} style={{ objectFit: 'cover' }} unoptimized />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: C.text, lineHeight: 1.2, letterSpacing: '-0.01em' }}>Live Younger</p>
              <p style={{ margin: 0, fontSize: 11, color: C.muted }}>Medical Aesthetics · Calgary</p>
            </div>
          </div>
          {step !== 'confirmed' ? (
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {steps.map((s, i) => <div key={s} style={{ height: 4, borderRadius: 2, width: i === stepIdx ? 20 : 8, background: i <= stepIdx ? C.teal : C.border, transition: 'all 0.3s' }} />)}
            </div>
          ) : (
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.success, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" fill="none" stroke="white" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 560, margin: '0 auto', padding: '0 20px 80px' }}>
        <div key={step} style={{ animation: `${dir === 'fwd' ? 'slideInFwd' : 'slideInBk'} 0.27s ease-out` }}>
          {step === 'service' && <ServiceStep categories={categories} initialCategory={initialCategory} onSelect={s => { setSvc(s); fwd('datetime') }} />}
          {step === 'datetime' && svc && <DateTimeStep service={svc} slots={slots} slotsLoading={slotsLoading} selectedDate={date} selectedSlot={slot} onSelectDate={setDate} onSelectSlot={s => { setSlot(s); fwd('details') }} />}
          {step === 'details' && svc && date && slot && <DetailsStep service={svc} date={date} slot={slot} firstName={firstName} lastName={lastName} phone={phone} email={email} notes={notes} onFirstName={setFirstName} onLastName={setLastName} onPhone={v => setPhone(formatPhone(v))} onEmail={setEmail} onNotes={setNotes} onSubmit={submit} submitting={submitting} submitError={submitError} />}
          {step === 'confirmed' && svc && date && slot && <ConfirmedStep service={svc} date={date} slot={slot} patientName={`${firstName} ${lastName}`} bookingId={bookingId} />}
        </div>
      </main>

      {step !== 'confirmed' && (
        <footer style={{ textAlign: 'center', padding: '0 20px 32px' }}>
          <p style={{ margin: 0, fontSize: 11, color: C.subtle }}>518-922 5 Ave SW, Calgary, AB · (403) 237-2353</p>
        </footer>
      )}

      <style>{`
        @keyframes slideInFwd { from { opacity:0; transform:translateX(22px) } to { opacity:1; transform:translateX(0) } }
        @keyframes slideInBk  { from { opacity:0; transform:translateX(-22px) } to { opacity:1; transform:translateX(0) } }
        @keyframes fadeUp     { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeScale  { from { opacity:0; transform:scale(0.82) } to { opacity:1; transform:scale(1) } }
        @keyframes drawCheck  { to { stroke-dashoffset:0 } }
        @keyframes spin       { to { transform:rotate(360deg) } }
        * { box-sizing:border-box }
        button,input,textarea { font-family:inherit }
      `}</style>
    </div>
  )
}

// ── Step 1: Service selection ──────────────────────────────────────────────

function ServiceStep({ categories, initialCategory, onSelect }: { categories: BookingCategory[]; initialCategory?: string; onSelect: (s: BookingService) => void }) {
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    if (!initialCategory) return
    const cat = categories.find(c => c.name.toLowerCase().includes(initialCategory.toLowerCase()))
    if (cat) { setOpen(cat.id); setTimeout(() => document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150) }
  }, [initialCategory, categories])

  return (
    <div style={{ paddingTop: 28 }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 24, animation: 'fadeUp 0.35s ease-out' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.tealGhost, border: `1px solid ${C.tealSoft}`, borderRadius: 100, padding: '4px 12px', marginBottom: 14 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.teal }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: C.teal, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>Calgary · In-Clinic</span>
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: '-0.03em', lineHeight: 1.2 }}>Book Your Appointment</h1>
        <p style={{ margin: 0, fontSize: 14, color: C.muted, lineHeight: 1.5 }}>Choose a service — our team confirms your time within 2 hours.</p>
      </div>

      {/* Trust bar */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 24, animation: 'fadeUp 0.38s ease-out 0.05s both' }}>
        {([
          [<svg key="s" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>, 'Licensed MDs & NPs'],
          [<svg key="sp" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 3.9 4.1.6-3 2.9.7 4.1L12 12.4l-3.7 1.9.7-4.1-3-2.9 4.1-.6z"/></svg>, 'Premium Treatments'],
          [<svg key="c" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, 'Flexible Scheduling'],
        ] as [React.ReactNode, string][]).map(([icon, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {icon}
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Categories */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {categories.map((cat, ci) => {
          const isOpen = open === cat.id
          return (
            <div key={cat.id} id={`cat-${cat.id}`} style={{ borderRadius: 16, background: C.card, border: `1.5px solid ${isOpen ? C.teal : C.border}`, boxShadow: isOpen ? C.shadowMd : C.shadow, overflow: 'hidden', transition: 'border-color 0.2s, box-shadow 0.2s', animation: `fadeUp 0.35s ease-out ${ci * 0.04}s both` }}>
              <button onClick={() => setOpen(isOpen ? null : cat.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left' as const }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{cat.name}</span>
                  {cat.description && <p style={{ margin: '2px 0 0', fontSize: 12, color: C.muted }}>{cat.description}</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 100, background: isOpen ? C.tealSoft : '#F3F4F6', color: isOpen ? C.tealDark : C.muted, transition: 'all 0.2s' }}>{cat.services.length}</span>
                  <svg width="14" height="14" fill="none" stroke={isOpen ? C.teal : C.muted} strokeWidth={2.5} viewBox="0 0 24 24" style={{ transition: 'transform 0.25s, stroke 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              <div style={{ maxHeight: isOpen ? `${cat.services.length * 90}px` : 0, overflow: 'hidden', transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)' }}>
                <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {cat.services.map(s => <ServiceCard key={s.id} service={s} onSelect={onSelect} />)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ServiceCard({ service: s, onSelect }: { service: BookingService; onSelect: (s: BookingService) => void }) {
  const [hov, setHov] = useState(false)
  const free = s.priceCents === 0 && !s.priceVaries
  return (
    <button onClick={() => onSelect(s)} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: 'none', borderRadius: 12, padding: '12px 14px', background: hov ? C.tealGhost : C.bg, transition: 'background 0.15s, transform 0.12s', transform: hov ? 'scale(1.006)' : 'scale(1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.text }}>{s.name}</p>
        <p style={{ margin: '3px 0 0', fontSize: 11, color: C.muted }}>
          {formatDuration(s.durationMinutes)}{s.practitioners.length > 0 && ` · ${s.practitioners.slice(0,2).join(', ')}${s.practitioners.length > 2 ? ` +${s.practitioners.length - 2}` : ''}`}
        </p>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' as const }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: free ? C.success : s.priceVaries ? C.muted : C.text }}>{formatPrice(s.priceCents, s.priceVaries)}</span>
        {hov && <p style={{ margin: '2px 0 0', fontSize: 10, fontWeight: 700, color: C.teal, letterSpacing: '0.02em', animation: 'fadeUp 0.1s' }}>Select →</p>}
      </div>
    </button>
  )
}

// ── Step 2: Date & Time ────────────────────────────────────────────────────

function DateTimeStep({ service, slots, slotsLoading, selectedDate, selectedSlot, onSelectDate, onSelectSlot }: {
  service: BookingService; slots: BookingSlot[]; slotsLoading: boolean
  selectedDate: string | null; selectedSlot: BookingSlot | null
  onSelectDate: (d: string) => void; onSelectSlot: (s: BookingSlot) => void
}) {
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d.toISOString().slice(0, 10) })
  const byTime = new Map<string, BookingSlot[]>()
  for (const s of slots) { const l = byTime.get(s.time) ?? []; l.push(s); byTime.set(s.time, l) }
  const times = Array.from(byTime.keys()).sort()

  return (
    <div style={{ paddingTop: 24 }}>
      {/* Service pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, padding: '10px 16px', borderRadius: 12, background: C.tealGhost, border: `1px solid ${C.tealSoft}`, animation: 'fadeUp 0.3s ease-out' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.teal, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.tealDeep, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{service.name}</p>
          <p style={{ margin: 0, fontSize: 11, color: C.teal }}>{formatDuration(service.durationMinutes)} · {formatPrice(service.priceCents, service.priceVaries)}</p>
        </div>
      </div>

      {/* Date picker */}
      <div style={{ marginBottom: 28, animation: 'fadeUp 0.32s ease-out 0.04s both' }}>
        <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>Select a Date</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {days.map(day => {
            const d = new Date(day + 'T12:00:00')
            const isSun = d.getDay() === 0
            const isSel = selectedDate === day
            return (
              <button key={day} onClick={() => !isSun && onSelectDate(day)} disabled={isSun}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px', borderRadius: 12, border: isSun ? `1px dashed ${C.border}` : 'none', cursor: isSun ? 'default' : 'pointer', background: isSel ? C.teal : isSun ? '#F9FAFB' : 'white', boxShadow: isSel ? '0 2px 12px rgba(13,148,136,0.30)' : isSun ? 'none' : C.shadow, opacity: isSun ? 0.45 : 1, transition: 'all 0.15s', transform: isSel ? 'scale(1.04)' : 'scale(1)', position: 'relative' as const }}>
                <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.04em', color: isSel ? 'rgba(255,255,255,0.8)' : isSun ? C.subtle : C.muted, textTransform: 'uppercase' as const }}>{d.toLocaleDateString('en', { weekday: 'short' })}</span>
                <span style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2, margin: '2px 0', color: isSel ? 'white' : isSun ? C.subtle : C.text }}>{d.getDate()}</span>
                {isSun
                  ? <span style={{ fontSize: 8, color: C.subtle, letterSpacing: '0.02em' }}>Closed</span>
                  : <span style={{ fontSize: 9, color: isSel ? 'rgba(255,255,255,0.7)' : C.subtle }}>{d.toLocaleDateString('en', { month: 'short' })}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div style={{ animation: 'fadeUp 0.28s ease-out' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>{slotsLoading ? 'Finding times…' : 'Choose a Time'}</h2>
            {!slotsLoading && <span style={{ fontSize: 12, color: C.muted }}>{formatDate(selectedDate)}</span>}
          </div>

          {slotsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '36px 0' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2.5px solid ${C.tealSoft}`, borderTopColor: C.teal, animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : times.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 20px', background: 'white', borderRadius: 16, border: `1px solid ${C.border}` }}>
              <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: C.text }}>No availability</p>
              <p style={{ margin: 0, fontSize: 13, color: C.muted }}>Please choose another date</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {times.map(time => (byTime.get(time) ?? []).map(s => <SlotBtn key={`${time}-${s.practitioner}`} slot={s} time={time} selected={selectedSlot?.time === time && selectedSlot.practitioner === s.practitioner} onSelect={onSelectSlot} />))}
              </div>
              <p style={{ textAlign: 'center', fontSize: 11, color: C.subtle, marginTop: 14 }}>We&apos;ll confirm your exact time within 2 hours</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SlotBtn({ slot, time, selected, onSelect }: { slot: BookingSlot; time: string; selected: boolean; onSelect: (s: BookingSlot) => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={() => onSelect(slot)} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ border: `1.5px solid ${selected ? C.teal : hov ? C.teal : C.border}`, borderRadius: 12, padding: '10px 6px', cursor: 'pointer', background: selected ? C.teal : hov ? C.tealGhost : 'white', textAlign: 'center', transition: 'all 0.15s', transform: selected ? 'scale(1.03)' : 'scale(1)', boxShadow: selected ? '0 2px 12px rgba(13,148,136,0.28)' : 'none' }}>
      <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: selected ? 'white' : C.text }}>{formatTime(time)}</span>
      <span style={{ display: 'block', fontSize: 10, marginTop: 2, color: selected ? 'rgba(255,255,255,0.75)' : C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, padding: '0 4px' }}>{slot.practitioner.split(' ').pop()}</span>
    </button>
  )
}

// ── Step 3: Details ────────────────────────────────────────────────────────

function DetailsStep({ service, date, slot, firstName, lastName, phone, email, notes, onFirstName, onLastName, onPhone, onEmail, onNotes, onSubmit, submitting, submitError }: {
  service: BookingService; date: string; slot: BookingSlot
  firstName: string; lastName: string; phone: string; email: string; notes: string
  onFirstName: (v: string) => void; onLastName: (v: string) => void
  onPhone: (v: string) => void; onEmail: (v: string) => void; onNotes: (v: string) => void
  onSubmit: () => void; submitting: boolean; submitError: string | null
}) {
  const valid = firstName.trim() && lastName.trim() && phone.replace(/\D/g,'').length >= 9 && email.includes('@')
  return (
    <div style={{ paddingTop: 24 }}>
      {/* Summary */}
      <div style={{ background: C.card, borderRadius: 20, padding: 20, marginBottom: 22, boxShadow: C.shadowMd, border: `1px solid ${C.border}`, animation: 'fadeUp 0.3s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, overflow: 'hidden', background: C.tealGhost, flexShrink: 0 }}>
            <Image src={LOGO_URL} alt="" width={32} height={32} style={{ objectFit: 'cover' }} unoptimized />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.teal, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>Appointment Summary</p>
            <p style={{ margin: 0, fontSize: 11, color: C.muted }}>Live Younger Medical Aesthetics</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[['Service', service.name], ['Date', formatDate(date)], ['Time', formatTime(slot.time)], ['With', slot.practitioner], ['Duration', formatDuration(service.durationMinutes)]].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 12, color: C.muted }}>{l}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text, textAlign: 'right' as const }}>{v}</span>
            </div>
          ))}
          <div style={{ height: 1, background: C.border, margin: '2px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Total</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: C.tealDark }}>{formatPrice(service.priceCents, service.priceVaries)}</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div style={{ animation: 'fadeUp 0.35s ease-out 0.05s both' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>Your Details</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <TF label="First name" value={firstName} onChange={onFirstName} required />
            <TF label="Last name" value={lastName} onChange={onLastName} required />
          </div>
          <TF label="Phone number" value={phone} onChange={onPhone} type="tel" required />
          <TF label="Email address" value={email} onChange={onEmail} type="email" required />
          <TA label="Notes (optional)" value={notes} onChange={onNotes} placeholder="Questions, allergies, or special requests…" />
        </div>
      </div>

      {/* No-show notice */}
      <div style={{ marginTop: 18, padding: '12px 16px', borderRadius: 12, background: '#FFFBEB', border: '1px solid #FDE68A', animation: 'fadeUp 0.35s ease-out 0.1s both' }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#92400E' }}>$50 no-show fee policy</p>
        <p style={{ margin: '3px 0 0', fontSize: 11, color: '#B45309', lineHeight: 1.5 }}>A $50 fee applies for missed appointments or cancellations less than 24 hours before your visit. Payment is processed securely through Jane.</p>
      </div>

      {/* CTA */}
      {submitError && (
        <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', animation: 'fadeUp 0.2s ease-out' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#DC2626' }}>{submitError}</p>
        </div>
      )}

      <button onClick={onSubmit} disabled={!valid || submitting}
        style={{ width: '100%', height: 52, borderRadius: 14, border: 'none', cursor: valid && !submitting ? 'pointer' : 'not-allowed', background: valid ? `linear-gradient(135deg, ${C.teal} 0%, ${C.tealDark} 100%)` : C.border, color: 'white', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 16, boxShadow: valid ? '0 4px 20px rgba(13,148,136,0.35)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s', animation: 'fadeUp 0.35s ease-out 0.12s both' }}>
        {submitting ? <><div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} />Booking…</> : 'Confirm Appointment'}
      </button>

      <p style={{ textAlign: 'center', fontSize: 11, color: C.subtle, marginTop: 12, lineHeight: 1.5 }}>
        By booking you accept our cancellation policy. Your information is kept secure.
      </p>
    </div>
  )
}

// ── Step 4: Confirmed ──────────────────────────────────────────────────────

function ConfirmedStep({ service, date, slot, patientName }: { service: BookingService; date: string; slot: BookingSlot; patientName: string; bookingId: string | null }) {
  const genICS = useCallback(() => {
    const start = new Date(`${date}T${slot.time}:00`)
    const end = new Date(start.getTime() + service.durationMinutes * 60000)
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')
    const ics = ['BEGIN:VCALENDAR','VERSION:2.0','BEGIN:VEVENT',`DTSTART:${fmt(start)}`,`DTEND:${fmt(end)}`,`SUMMARY:${service.name} — Live Younger`,'LOCATION:518-922 5 Ave SW\\, Calgary\\, AB',`DESCRIPTION:With ${slot.practitioner}\\nLive Younger Medical Aesthetics\\n(403) 237-2353`,'END:VEVENT','END:VCALENDAR'].join('\r\n')
    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'live-younger-appointment.ics'; a.click(); URL.revokeObjectURL(url)
  }, [date, slot, service])

  return (
    <div style={{ paddingTop: 40, paddingBottom: 20, textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24, animation: 'fadeScale 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ width: 88, height: 88, borderRadius: '50%', background: `radial-gradient(circle, ${C.tealSoft} 0%, ${C.tealGhost} 100%)`, border: `2px solid ${C.tealSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke={C.teal} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 26, strokeDashoffset: 26, animation: 'drawCheck 0.7s ease-out 0.3s forwards' }} />
          </svg>
        </div>
      </div>

      <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: '-0.03em', animation: 'fadeUp 0.4s ease-out 0.2s both' }}>You&apos;re all set!</h2>
      <p style={{ margin: '0 0 28px', fontSize: 14, color: C.muted, animation: 'fadeUp 0.4s ease-out 0.25s both' }}>Your appointment is submitted. We&apos;ll confirm within 2 hours.</p>

      <div style={{ background: C.card, borderRadius: 20, padding: 22, marginBottom: 14, textAlign: 'left', boxShadow: C.shadowLg, border: `1px solid ${C.border}`, animation: 'fadeUp 0.4s ease-out 0.3s both' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[['Service', service.name],['Date', formatDate(date)],['Time', formatTime(slot.time)],['Practitioner', slot.practitioner],['Patient', patientName]].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 12, color: C.muted }}>{l}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text, textAlign: 'right' as const }}>{v}</span>
            </div>
          ))}
          {service.priceCents > 0 && !service.priceVaries && <>
            <div style={{ height: 1, background: C.border }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Amount</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: C.teal }}>{formatPrice(service.priceCents, false)}</span>
            </div>
          </>}
        </div>
      </div>

      <button onClick={genICS} style={{ width: '100%', height: 48, borderRadius: 12, border: `1.5px solid ${C.teal}`, background: 'white', color: C.tealDark, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20, transition: 'background 0.15s', animation: 'fadeUp 0.4s ease-out 0.35s both' }}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        Add to Calendar
      </button>

      <div style={{ animation: 'fadeUp 0.4s ease-out 0.4s both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, overflow: 'hidden', background: C.tealGhost }}>
            <Image src={LOGO_URL} alt="" width={24} height={24} style={{ objectFit: 'cover' }} unoptimized />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Live Younger Medical Aesthetics</span>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: C.subtle }}>518-922 5 Ave SW, Calgary, AB · (403) 237-2353</p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: C.subtle }}>Need to reschedule? Call at least 24h before your appointment.</p>
      </div>
    </div>
  )
}

// ── Form fields ────────────────────────────────────────────────────────────

function TF({ label, value, onChange, type = 'text', required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, letterSpacing: '0.03em', textTransform: 'uppercase' as const }}>{label}{required && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}</label>
      <input type={type} value={value} required={required} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', height: 46, borderRadius: 11, padding: '0 14px', fontSize: 14, border: `1.5px solid ${focused ? C.teal : C.border}`, background: C.card, color: C.text, outline: 'none', boxShadow: focused ? '0 0 0 3px rgba(13,148,136,0.10)' : 'none', transition: 'border-color 0.15s, box-shadow 0.15s' }} />
    </div>
  )
}

function TA({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, letterSpacing: '0.03em', textTransform: 'uppercase' as const }}>{label}</label>
      <textarea value={value} rows={3} placeholder={placeholder} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', borderRadius: 11, padding: '12px 14px', fontSize: 14, resize: 'none', border: `1.5px solid ${focused ? C.teal : C.border}`, background: C.card, color: C.text, outline: 'none', boxShadow: focused ? '0 0 0 3px rgba(13,148,136,0.10)' : 'none', transition: 'border-color 0.15s, box-shadow 0.15s' }} />
    </div>
  )
}
