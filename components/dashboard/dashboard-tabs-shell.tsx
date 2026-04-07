'use client'

import { useState, useEffect } from 'react'
import { useTabState } from './tab-state-context'
import { useDashboardData } from './dashboard-data-provider'
import { CallLogsWithPanel } from './call-logs-with-panel'
import { CallLogsChart } from './call-logs-chart'
import { LeadsTable } from './leads-table'
import { FollowUpQueue } from './follow-up-queue'
import { AppointmentsTable } from '@/app/dashboard/appointments/appointments-table'
import { AppointmentsCalendar } from './appointments-calendar'
import { SupportPageClient } from '@/components/support/support-page-client'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Client } from '@/types/database'
import type { BookingRow } from '@/lib/dashboard/dashboard-cache'
import type { SupportRequest } from '@/lib/support/types'
import { getTenantFeatures } from '@/lib/dashboard/tenant-features'

interface DashboardTabsShellProps {
  /** Server-rendered overview content (ModeDashboard) */
  overviewContent: React.ReactNode
  /** Tenant from server — passed explicitly to avoid context dependency */
  tenant: Client
}

type CallFilter = 'all' | 'inbound' | 'outbound'

function CallLogsSection({ clientId, tenantSlug }: {
  clientId: string
  tenantSlug: string
}) {
  const ctx = useDashboardData()
  const tabState = useTabState()
  const allCalls = ctx?.calls ?? []
  const activeTab = tabState?.activeTab ?? '/dashboard/call-logs'

  const callFilter: CallFilter = activeTab.includes('filter=inbound') ? 'inbound'
    : activeTab.includes('filter=outbound') ? 'outbound'
    : 'all'

  function setCallFilter(f: CallFilter) {
    tabState?.setActiveTab(f === 'all' ? '/dashboard/call-logs' : `/dashboard/call-logs?filter=${f}`)
  }

  const inboundCalls = allCalls.filter((c) =>
    c.direction === 'inbound' || (!c.direction && (c.call_type as string) !== 'outbound_call'),
  )
  const outboundCalls = allCalls.filter((c) => c.direction === 'outbound')
  const filtered =
    callFilter === 'inbound' ? inboundCalls
    : callFilter === 'outbound' ? outboundCalls
    : allCalls

  const filterTabs: { key: CallFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: allCalls.length },
    { key: 'inbound', label: 'Inbound', count: inboundCalls.length },
    { key: 'outbound', label: 'Outbound', count: outboundCalls.length },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-[var(--brand-text)]">
          {callFilter === 'inbound' ? 'Inbound Call Logs' : callFilter === 'outbound' ? 'Outbound Call Logs' : 'Call Logs'}
        </h1>
        <p className="text-sm text-[var(--brand-muted)] mt-1">
          {callFilter === 'inbound'
            ? `Inbound calls · ${inboundCalls.length} total`
            : callFilter === 'outbound'
              ? `Outbound calls · ${outboundCalls.length} total`
              : `All calls handled by your AI receptionist · ${allCalls.length} total`}
        </p>
      </div>

      {/* 7-day bar chart */}
      <CallLogsChart />

      {/* Filter tabs */}
      <div className="flex gap-0.5 border-b border-[var(--brand-border)]">
        {filterTabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setCallFilter(key)}
            className={cn(
              'px-3 py-2 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px',
              callFilter === key
                ? 'border-[var(--brand-primary)] text-[var(--brand-text)]'
                : 'border-transparent text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
            )}
          >
            {label}{' '}
            <span className="text-[11px] opacity-60">({count})</span>
          </button>
        ))}
      </div>

      <CallLogsWithPanel
        initialData={filtered}
        totalCount={filtered.length}
        clientId={clientId}
        tenantSlug={tenantSlug}
      />
    </div>
  )
}

export function DashboardTabsShell({ overviewContent, tenant }: DashboardTabsShellProps) {
  const tabState = useTabState()
  const activeTab = tabState?.activeTab ?? '/dashboard'
  const ctx = useDashboardData()

  switch (activeTab) {
    case '/dashboard/call-logs':
    case '/dashboard/call-logs?filter=inbound':
    case '/dashboard/call-logs?filter=outbound': {
      return (
        <CallLogsSection
          clientId={tenant.id}
          tenantSlug={tenant.slug}
        />
      )
    }

    case '/dashboard/leads': {
      const leads = ctx?.leads ?? []
      return (
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 animate-fade-in">
          <LeadsTable contacts={leads} tenantSlug={tenant.slug} />
        </div>
      )
    }

    case '/dashboard/appointments': {
      if (!getTenantFeatures(tenant).showAppointments) return <>{overviewContent}</>
      const bookedCalls = (ctx?.calls ?? []).filter((c) => c.is_booked).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      const calendarEmail = 'clientcare@liveyounger.ca'
      return (
        <div className="p-3 sm:p-6 space-y-4 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-[var(--brand-text)]">Appointments</h1>
              <p className="text-[11px] sm:text-xs text-[var(--brand-muted)] mt-0.5">
                {bookedCalls.length} booked by AI · synced with Google Calendar
              </p>
            </div>
            <a href="https://calendar.google.com/calendar/u/4/r/week" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors">
              <ExternalLink className="h-3 w-3" />
              <span className="hidden sm:inline">Open in Google Calendar</span>
            </a>
          </div>

          {/* Google Calendar embed — public calendar */}
          <div className="rounded-xl border border-[var(--brand-border)] bg-white overflow-hidden">
            <iframe
              src={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calendarEmail)}&ctz=America/Edmonton&mode=WEEK&showTitle=0&showNav=1&showCalendars=0&showTabs=1&showPrint=0&showDate=1`}
              width="100%"
              style={{ height: 'min(70vh, 650px)', minHeight: '400px' }}
              frameBorder="0"
              scrolling="no"
            />
          </div>

          {/* AI-booked appointments list is not needed — GCal embed shows everything */}
        </div>
      )
    }

    // HIDDEN: follow-up temporarily disabled
    // case '/dashboard/follow-up': {
    //   const followUpTasks = ctx?.followUpTasks ?? []
    //   return (
    //     <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 animate-fade-in">
    //       <FollowUpQueue tasks={followUpTasks} tenantSlug={tenant.slug} />
    //     </div>
    //   )
    // }

    case '/dashboard/support':
      return <SupportTab tenantSlug={tenant.slug} />

    default:
      return <>{overviewContent}</>
  }
}

function SupportTab({ tenantSlug }: { tenantSlug: string }) {
  const [requests, setRequests] = useState<SupportRequest[]>([])

  useEffect(() => {
    fetch(`/api/support?tenant=${encodeURIComponent(tenantSlug)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setRequests(d.requests ?? []) })
      .catch(() => {})
  }, [tenantSlug])

  return (
    <div className="p-4 sm:p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-lg font-semibold text-[var(--brand-text)] tracking-tight">Support</h1>
        <p className="text-xs text-[var(--brand-muted)] mt-0.5">Submit and track support requests</p>
      </div>
      <SupportPageClient requests={requests} tenantSlug={tenantSlug} />
    </div>
  )
}
