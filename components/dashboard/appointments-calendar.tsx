'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, ExternalLink, Clock, Phone, PhoneOutgoing, List, CalendarDays } from 'lucide-react'
import type { CallLog } from '@/types/database'

// ── Types ────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string
  name: string
  phone: string | null
  value: number
  summary: string | null
  direction: string | null
  start: Date
  end: Date
  source: 'ai_booked' | 'gcal'
}

interface AppointmentsCalendarProps {
  bookedCalls: CallLog[]
  googleCalendarUrl?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
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

function formatTimeRange(start: Date, end: Date): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// ── Hours grid ───────────────────────────────────────────────────────────────
const START_HOUR = 8
const END_HOUR = 18
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

function hourLabel(h: number): string {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

// ── Event pill ───────────────────────────────────────────────────────────────

function EventPill({ event, compact }: { event: CalendarEvent; compact?: boolean }) {
  const isOutbound = event.direction === 'outbound'
  const colors = event.source === 'gcal'
    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-l-[3px] border-blue-500'
    : isOutbound
      ? 'bg-violet-500/12 text-violet-700 dark:text-violet-300 border-l-[3px] border-violet-500'
      : 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-l-[3px] border-emerald-500'

  if (compact) {
    return (
      <div className={cn('rounded-[4px] px-1.5 py-0.5 text-[9px] leading-tight cursor-default truncate', colors)}
        title={`${event.name}\n${formatTimeRange(event.start, event.end)}${event.value ? `\n$${event.value}` : ''}\n${event.summary || ''}`}
      >
        <span className="font-medium">{event.name}</span>
      </div>
    )
  }

  return (
    <div className={cn('rounded-md px-2 py-1.5 cursor-default', colors)}
      title={event.summary || undefined}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold truncate">{event.name}</div>
          <div className="text-[10px] opacity-70 mt-0.5">{formatTimeRange(event.start, event.end)}</div>
        </div>
        {event.value > 0 && (
          <span className="text-[10px] font-bold shrink-0 opacity-80">${event.value}</span>
        )}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function AppointmentsCalendar({ bookedCalls, googleCalendarUrl }: AppointmentsCalendarProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [view, setView] = useState<'week' | 'day' | 'list'>('week')
  const [selectedDay, setSelectedDay] = useState(() => new Date())

  const events: CalendarEvent[] = useMemo(() => {
    return bookedCalls.map((c) => {
      const start = new Date(c.created_at)
      const end = new Date(start.getTime() + 30 * 60 * 1000) // 30min default
      return {
        id: c.id,
        name: c.caller_name || 'Patient',
        phone: c.caller_phone,
        value: c.booked_value ?? 0,
        summary: c.call_summary ?? c.semantic_title ?? null,
        direction: c.direction,
        start,
        end,
        source: 'ai_booked' as const,
      }
    })
  }, [bookedCalls])

  const today = new Date()
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const weekEvents = useMemo(
    () => events.filter((e) => e.start >= weekStart && e.start < addDays(weekStart, 7)),
    [events, weekStart],
  )

  const dayEvents = useMemo(
    () => events.filter((e) => isSameDay(e.start, selectedDay)).sort((a, b) => a.start.getTime() - b.start.getTime()),
    [events, selectedDay],
  )

  const monthLabel = (() => {
    const f = weekDays[0], l = weekDays[6]
    if (f.getMonth() === l.getMonth()) return `${MONTH_NAMES[f.getMonth()]} ${f.getFullYear()}`
    return `${MONTH_NAMES[f.getMonth()].slice(0, 3)} – ${MONTH_NAMES[l.getMonth()].slice(0, 3)} ${l.getFullYear()}`
  })()

  const stats = useMemo(() => {
    const thisWeek = weekEvents.length
    const revenue = weekEvents.reduce((s, e) => s + e.value, 0)
    return { thisWeek, revenue }
  }, [weekEvents])

  return (
    <div className="space-y-3">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-[var(--brand-text)]">Appointments</h1>
          <p className="text-[11px] sm:text-xs text-[var(--brand-muted)] mt-0.5">
            {stats.thisWeek} this week{stats.revenue > 0 ? ` · $${stats.revenue.toLocaleString()} booked` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {googleCalendarUrl && (
            <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-2 py-1.5 text-[10px] sm:text-[11px] font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors">
              <ExternalLink className="h-3 w-3" />
              <span className="hidden sm:inline">Google Calendar</span>
            </a>
          )}
        </div>
      </div>

      {/* ── Calendar card ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-[var(--brand-border)] bg-[var(--brand-bg)]/50">
          <div className="flex items-center gap-1.5">
            <button onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[var(--brand-border)]/50 text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[var(--brand-border)]/50 text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-[var(--brand-text)] ml-1">{monthLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { setWeekStart(startOfWeek(new Date())); setSelectedDay(new Date()) }}
              className="text-[10px] sm:text-[11px] font-medium px-2 py-1 rounded-md border border-[var(--brand-border)] text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-bg)] transition-colors">
              Today
            </button>
            {(['week', 'list'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={cn('text-[10px] sm:text-[11px] font-medium px-2 py-1 rounded-md transition-colors',
                  view === v ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)]')}>
                {v === 'week' ? <CalendarDays className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        </div>

        {view === 'week' ? (
          /* ── Week grid ──────────────────────────────────────────────── */
          <>
            {/* Day headers */}
            <div className="grid grid-cols-[40px_repeat(7,1fr)] sm:grid-cols-[56px_repeat(7,1fr)] border-b border-[var(--brand-border)]">
              <div className="border-r border-[var(--brand-border)]" />
              {weekDays.map((day, i) => {
                const isToday = isSameDay(day, today)
                const dayEvts = weekEvents.filter((e) => isSameDay(e.start, day))
                return (
                  <div key={i} className={cn(
                    'text-center py-2 border-r border-[var(--brand-border)] last:border-r-0',
                    isToday && 'bg-[var(--brand-primary)]/5',
                  )}>
                    <div className="text-[9px] sm:text-[10px] uppercase font-medium text-[var(--brand-muted)]">{DAY_NAMES_SHORT[i]}</div>
                    <div className={cn(
                      'text-base sm:text-lg font-bold mt-0.5 leading-none',
                      isToday ? 'text-[var(--brand-primary)]' : 'text-[var(--brand-text)]',
                    )}>
                      {day.getDate()}
                    </div>
                    {dayEvts.length > 0 && (
                      <div className="flex justify-center mt-1 gap-0.5">
                        {dayEvts.slice(0, 3).map((_, j) => (
                          <div key={j} className="h-1 w-1 rounded-full bg-[var(--brand-primary)]" />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Time grid */}
            <div className="grid grid-cols-[40px_repeat(7,1fr)] sm:grid-cols-[56px_repeat(7,1fr)] max-h-[500px] sm:max-h-[600px] overflow-y-auto">
              {HOURS.map((hour) => (
                <div key={hour} className="contents">
                  {/* Hour label */}
                  <div className="border-r border-b border-[var(--brand-border)] px-1 sm:px-2 py-1 text-right">
                    <span className="text-[9px] sm:text-[10px] text-[var(--brand-muted)] font-medium">{hourLabel(hour)}</span>
                  </div>
                  {/* Day cells */}
                  {weekDays.map((day, di) => {
                    const cellEvents = weekEvents.filter((e) => isSameDay(e.start, day) && e.start.getHours() === hour)
                    const isToday = isSameDay(day, today)
                    const isNow = isToday && today.getHours() === hour
                    return (
                      <div key={di} className={cn(
                        'border-r border-b border-[var(--brand-border)] last:border-r-0 min-h-[44px] sm:min-h-[52px] p-0.5 relative',
                        isToday && 'bg-[var(--brand-primary)]/[0.02]',
                        isNow && 'ring-1 ring-inset ring-[var(--brand-primary)]/20',
                      )}>
                        {cellEvents.map((event) => (
                          <EventPill key={event.id} event={event} compact />
                        ))}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </>
        ) : (
          /* ── List view ──────────────────────────────────────────────── */
          <div className="divide-y divide-[var(--brand-border)] max-h-[600px] overflow-y-auto">
            {events.length === 0 ? (
              <div className="p-12 text-center">
                <CalendarDays className="h-8 w-8 text-[var(--brand-muted)] opacity-40 mx-auto mb-3" />
                <p className="text-sm text-[var(--brand-muted)]">No appointments yet</p>
              </div>
            ) : (
              events.slice(0, 100).map((event) => (
                <div key={event.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--brand-bg)]/50 transition-colors">
                  {/* Icon */}
                  <div className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                    event.direction === 'outbound' ? 'bg-violet-500/10' : 'bg-emerald-500/10',
                  )}>
                    {event.direction === 'outbound'
                      ? <PhoneOutgoing className="h-4 w-4 text-violet-500" />
                      : <Phone className="h-4 w-4 text-emerald-500" />}
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-[var(--brand-text)] truncate">{event.name}</span>
                      {event.value > 0 && (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">${event.value}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="h-3 w-3 text-[var(--brand-muted)]" />
                      <span className="text-[11px] text-[var(--brand-muted)]">
                        {event.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {formatTime(event.start)}
                      </span>
                      {event.phone && (
                        <span className="text-[11px] text-[var(--brand-muted)] hidden sm:inline">· {event.phone}</span>
                      )}
                    </div>
                    {event.summary && (
                      <p className="text-[10px] text-[var(--brand-muted)] mt-1 line-clamp-1 opacity-70">{event.summary}</p>
                    )}
                  </div>

                  {/* Badge */}
                  <span className={cn(
                    'text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider',
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
