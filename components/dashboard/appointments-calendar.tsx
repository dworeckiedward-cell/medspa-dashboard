'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Phone, PhoneOutgoing, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import type { CallLog } from '@/types/database'

// ── Types ────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string
  name: string
  phone: string | null
  value: number
  summary: string | null
  direction: string | null
  time: Date
}

interface AppointmentsCalendarProps {
  bookedCalls: CallLog[]
  googleCalendarUrl?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// ── Component ────────────────────────────────────────────────────────────────

export function AppointmentsCalendar({ bookedCalls, googleCalendarUrl }: AppointmentsCalendarProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [view, setView] = useState<'week' | 'list'>('week')

  const events: CalendarEvent[] = useMemo(() => {
    return bookedCalls.map((c) => ({
      id: c.id,
      name: c.caller_name || 'Unknown',
      phone: c.caller_phone,
      value: c.booked_value ?? 0,
      summary: c.call_summary ?? c.semantic_title ?? null,
      direction: c.direction,
      time: new Date(c.created_at),
    })).sort((a, b) => b.time.getTime() - a.time.getTime())
  }, [bookedCalls])

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = new Date()

  const weekEvents = useMemo(() => {
    return events.filter((e) => {
      return e.time >= weekStart && e.time < addDays(weekStart, 7)
    })
  }, [events, weekStart])

  const monthLabel = (() => {
    const first = weekDays[0]
    const last = weekDays[6]
    if (first.getMonth() === last.getMonth()) {
      return `${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`
    }
    return `${MONTH_NAMES[first.getMonth()].slice(0, 3)} – ${MONTH_NAMES[last.getMonth()].slice(0, 3)} ${last.getFullYear()}`
  })()

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-[var(--brand-text)]">Appointments</h1>
          <p className="text-xs sm:text-sm text-[var(--brand-muted)] mt-0.5">{events.length} booked total</p>
        </div>
        <div className="flex items-center gap-2">
          {googleCalendarUrl && (
            <a
              href={googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-primary)]/50 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              <span className="hidden sm:inline">Google Calendar</span>
            </a>
          )}
        </div>
      </div>

      {/* Calendar card */}
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] overflow-hidden">
        {/* Navigation bar */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-[var(--brand-border)]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[var(--brand-bg)] text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[var(--brand-bg)] text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-[var(--brand-text)]">{monthLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-[var(--brand-border)] text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-bg)] transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setView(view === 'week' ? 'list' : 'week')}
              className={cn(
                'text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors',
                'border border-[var(--brand-border)] text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
              )}
            >
              {view === 'week' ? 'List' : 'Week'}
            </button>
          </div>
        </div>

        {view === 'week' ? (
          /* ── Week view ────────────────────────────────────────────── */
          <div className="grid grid-cols-7 divide-x divide-[var(--brand-border)]">
            {weekDays.map((day, i) => {
              const dayEvents = weekEvents.filter((e) => isSameDay(e.time, day))
              const isToday = isSameDay(day, today)

              return (
                <div key={i} className="min-h-[120px] sm:min-h-[160px]">
                  {/* Day header */}
                  <div className={cn(
                    'px-1.5 sm:px-2 py-1.5 text-center border-b border-[var(--brand-border)]',
                    isToday ? 'bg-[var(--brand-primary)]/5' : 'bg-[var(--brand-bg)]',
                  )}>
                    <div className="text-[9px] sm:text-[10px] uppercase font-medium text-[var(--brand-muted)]">{DAY_NAMES[i]}</div>
                    <div className={cn(
                      'text-sm sm:text-base font-semibold mt-0.5',
                      isToday ? 'text-[var(--brand-primary)]' : 'text-[var(--brand-text)]',
                    )}>
                      {day.getDate()}
                    </div>
                  </div>

                  {/* Events */}
                  <div className="p-1 space-y-1">
                    {dayEvents.map((event) => (
                      <div
                        key={event.id}
                        className={cn(
                          'rounded-md px-1.5 py-1 text-[9px] sm:text-[10px] leading-tight cursor-default',
                          event.direction === 'outbound'
                            ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-l-2 border-violet-500'
                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-l-2 border-emerald-500',
                        )}
                        title={`${event.name} — $${event.value}\n${formatTime(event.time)}\n${event.summary || ''}`}
                      >
                        <div className="font-medium truncate">{event.name}</div>
                        <div className="opacity-70 truncate">{formatTime(event.time)}</div>
                      </div>
                    ))}
                    {dayEvents.length === 0 && (
                      <div className="h-full" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ── List view ────────────────────────────────────────────── */
          <div className="divide-y divide-[var(--brand-border)]">
            {events.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--brand-muted)]">No booked appointments yet</div>
            ) : (
              events.slice(0, 50).map((event) => (
                <div key={event.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--brand-bg)]/50 transition-colors">
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    event.direction === 'outbound' ? 'bg-violet-500/10' : 'bg-emerald-500/10',
                  )}>
                    {event.direction === 'outbound'
                      ? <PhoneOutgoing className="h-3.5 w-3.5 text-violet-500" />
                      : <Phone className="h-3.5 w-3.5 text-emerald-500" />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-[var(--brand-text)] truncate">{event.name}</span>
                      {event.value > 0 && (
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">${event.value}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--brand-muted)] truncate mt-0.5">
                      {event.time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {formatTime(event.time)}
                      {event.phone && ` · ${event.phone}`}
                    </div>
                  </div>
                  <span className={cn(
                    'text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0',
                    event.direction === 'outbound'
                      ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                  )}>
                    {event.direction === 'outbound' ? 'Outbound' : 'Inbound'}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
