'use client'

import { useState, useMemo } from 'react'
import {
  CalendarCheck,
  DollarSign,
  Phone,
  Target,
  Users,
  Clock,
  Zap,
  Bell,
  Construction,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { KpiCards } from './kpi-cards'
import { RoiChart } from './roi-chart'
import { CallLogsTable } from './call-logs-table'
import { TenantInfoCard } from './tenant-info-card'
import { CallDetailPanel } from './call-detail-panel'
import { ConversionTimeline } from './conversion-timeline'
import { WeeklyReportCard } from './weekly-report-card'
import { TopServicesCard } from './top-services-card'
import { useLanguage } from '@/lib/dashboard/use-language'
import type { DashboardMetrics, CallLog, Client } from '@/types/database'
import type { ClientService } from '@/lib/types/domain'

// ── Types ───────────────────────────────────────────────────────────────────

interface DashboardTabsProps {
  metrics: DashboardMetrics
  callLogs: CallLog[]
  totalCount: number
  currency: string
  clientId: string
  tenant: Client
  services: ClientService[]
}

type MainTab = 'overview' | 'inbound' | 'outbound'
type OutboundSubTab = 'speed-to-lead' | 'reminders'

// ── Tab bar ─────────────────────────────────────────────────────────────────

function TabBar<T extends string>({
  tabs,
  active,
  onSelect,
  size = 'md',
}: {
  tabs: { key: T; label: string }[]
  active: T
  onSelect: (key: T) => void
  size?: 'md' | 'sm'
}) {
  return (
    <div
      className={cn(
        'flex gap-0 border-b border-[var(--brand-border)]',
        size === 'sm' && 'mt-4',
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = active === tab.key
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(tab.key)}
            className={cn(
              'px-4 border-b-2 font-medium transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
              'focus-visible:ring-[var(--user-accent)] motion-reduce:transition-none',
              size === 'md' ? 'py-3 text-sm' : 'py-2 text-xs',
              isActive
                ? 'border-[var(--user-accent)] text-[var(--user-accent)]'
                : 'border-transparent text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-border)]',
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Mini KPI card (used in Inbound / Outbound sub-views) ────────────────────

interface MiniKpiCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
}

function MiniKpiCard({ label, value, sub, icon: Icon, color }: MiniKpiCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{ background: `radial-gradient(ellipse at top left, ${color}, transparent 70%)` }}
      />
      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--brand-muted)] uppercase tracking-wider mb-2">
              {label}
            </p>
            <p className="text-2xl font-bold text-[var(--brand-text)] tabular-nums leading-none">
              {value}
            </p>
            {sub && <p className="text-xs text-[var(--brand-muted)] mt-1.5">{sub}</p>}
          </div>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ background: `${color}22`, color }}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Scaffold placeholder for unreleased sections ────────────────────────────

function ComingSoonSection({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-border)]/50">
          <Construction className="h-6 w-6 text-[var(--brand-muted)] opacity-50" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--brand-text)]">{title}</p>
          <p className="text-xs text-[var(--brand-muted)] opacity-70 mt-1 max-w-xs mx-auto">
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Tab content: Overview ───────────────────────────────────────────────────

function OverviewTab({
  metrics,
  callLogs,
  totalCount,
  currency,
  clientId,
  tenant,
  services,
  onSelectCall,
}: DashboardTabsProps & { onSelectCall: (log: CallLog) => void }) {
  return (
    <div className="space-y-6 p-6 animate-fade-in">
      <KpiCards metrics={metrics} currency={currency} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RoiChart data={metrics.chartSeries} currency={currency} />
        </div>
        <div>
          <TenantInfoCard tenant={tenant} />
        </div>
      </div>

      {/* Conversion funnel + weekly report */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ConversionTimeline callLogs={callLogs} />
        <WeeklyReportCard callLogs={callLogs} currency={currency} />
      </div>

      {/* Top services (only shown when services are configured) */}
      {services.length > 0 && (
        <TopServicesCard callLogs={callLogs} services={services} currency={currency} />
      )}

      <CallLogsTable
        initialData={callLogs}
        totalCount={totalCount}
        clientId={clientId}
        onSelectCall={onSelectCall}
      />
    </div>
  )
}

// ── Tab content: Inbound ────────────────────────────────────────────────────

function InboundTab({
  callLogs,
  totalCount,
  currency,
  clientId,
  onSelectCall,
}: Pick<DashboardTabsProps, 'callLogs' | 'totalCount' | 'currency' | 'clientId'> & {
  onSelectCall: (log: CallLog) => void
}) {
  const { t } = useLanguage()

  // Use direction field when available (migration 004+).
  // Fall back to call_type proxy for existing rows where direction is NULL.
  const inboundLogs = useMemo(
    () =>
      callLogs.filter((c) => {
        if (c.direction !== null && c.direction !== undefined) return c.direction === 'inbound'
        // Backward compat: inbound_inquiry is always inbound; is_lead covers other patterns
        return c.call_type === 'inbound_inquiry' || c.is_lead
      }),
    [callLogs],
  )

  const leads = inboundLogs.filter((c) => c.is_lead).length
  const booked = inboundLogs.filter((c) => c.is_booked).length
  const conversionRate = leads > 0 ? Math.round((booked / leads) * 100) : 0
  const inquiriesValue = inboundLogs.reduce((s, c) => s + (c.inquiries_value ?? 0), 0)

  const kpis: MiniKpiCardProps[] = [
    {
      label: t.dashboard.inboundCalls,
      value: inboundLogs.length.toLocaleString(),
      sub: 'Last 30 days',
      icon: Phone,
      color: 'var(--brand-primary)',
    },
    {
      label: t.dashboard.leadsGenerated,
      value: leads.toLocaleString(),
      sub: 'Identified from calls',
      icon: Users,
      color: '#7C3AED',
    },
    {
      label: t.dashboard.leadBookingRate,
      value: `${conversionRate}%`,
      sub: 'Leads → bookings',
      icon: Target,
      color: '#10B981',
    },
    {
      label: t.dashboard.inquiriesValue,
      value: formatCurrency(inquiriesValue, currency),
      sub: 'Estimated pipeline',
      icon: DollarSign,
      color: '#F59E0B',
    },
  ]

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <MiniKpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Call logs filtered to inbound pattern */}
      <CallLogsTable
        initialData={inboundLogs}
        totalCount={inboundLogs.length}
        clientId={clientId}
        onSelectCall={onSelectCall}
      />
    </div>
  )
}

// ── Tab content: Outbound (nested subtabs) ──────────────────────────────────

function OutboundTab({
  callLogs,
  currency,
  clientId,
  onSelectCall,
}: Pick<DashboardTabsProps, 'callLogs' | 'currency' | 'clientId'> & {
  onSelectCall: (log: CallLog) => void
}) {
  const { t } = useLanguage()
  const [subTab, setSubTab] = useState<OutboundSubTab>('speed-to-lead')

  const subTabs: { key: OutboundSubTab; label: string }[] = [
    { key: 'speed-to-lead', label: t.dashboard.speedToLead },
    { key: 'reminders', label: t.dashboard.remindersReactivation },
  ]

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      {/* Nested sub-tab bar */}
      <TabBar tabs={subTabs} active={subTab} onSelect={setSubTab} size="sm" />

      {subTab === 'speed-to-lead' && (
        <SpeedToLeadTab callLogs={callLogs} currency={currency} clientId={clientId} onSelectCall={onSelectCall} />
      )}

      {subTab === 'reminders' && (
        <ComingSoonSection
          title={t.dashboard.comingSoon}
          description={t.dashboard.comingSoonDesc}
        />
      )}
    </div>
  )
}

// ── Speed-to-Lead sub-tab ───────────────────────────────────────────────────

function SpeedToLeadTab({
  callLogs,
  currency,
  clientId,
  onSelectCall,
}: Pick<DashboardTabsProps, 'callLogs' | 'currency' | 'clientId'> & {
  onSelectCall: (log: CallLog) => void
}) {
  const { t } = useLanguage()

  // Use direction field when available; fall back to is_lead proxy for old rows.
  // Speed-to-lead tab shows outbound calls — i.e. callbacks to leads.
  const outboundLogs = useMemo(
    () =>
      callLogs.filter((c) => {
        if (c.direction !== null && c.direction !== undefined) return c.direction === 'outbound'
        // Backward compat: treat leads without explicit direction as outbound candidates
        return c.is_lead
      }),
    [callLogs],
  )

  const leads = outboundLogs.length > 0 ? outboundLogs : callLogs.filter((c) => c.is_lead)
  const followUpNeeded = leads.filter((c) => c.human_followup_needed)
  const booked = leads.filter((c) => c.is_booked)
  const leadConversion = leads.length > 0 ? Math.round((booked.length / leads.length) * 100) : 0

  const kpis: MiniKpiCardProps[] = [
    {
      label: t.dashboard.newLeads,
      value: leads.length.toLocaleString(),
      sub: 'Last 30 days',
      icon: Zap,
      color: '#F59E0B',
    },
    {
      label: t.dashboard.followUpsNeeded,
      value: followUpNeeded.length.toLocaleString(),
      sub: 'Awaiting human callback',
      icon: Bell,
      color: '#E11D48',
    },
    {
      label: t.dashboard.leadBookingRate,
      value: `${leadConversion}%`,
      sub: 'Leads → bookings',
      icon: CalendarCheck,
      color: '#10B981',
    },
    {
      label: 'Avg Handle Time',
      value: '—',
      sub: 'Coming soon',
      icon: Clock,
      color: 'var(--brand-accent)',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <MiniKpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Leads that need follow-up — closest proxy for speed-to-lead tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads Needing Follow-up</CardTitle>
          <CardDescription>
            {followUpNeeded.length} lead{followUpNeeded.length !== 1 ? 's' : ''} awaiting callback
            {/* TODO: add response_time_seconds + contacted_at to track speed-to-lead properly */}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <CallLogsTable
            initialData={followUpNeeded}
            totalCount={followUpNeeded.length}
            clientId={clientId}
            onSelectCall={onSelectCall}
          />
        </CardContent>
      </Card>
    </div>
  )
}

// ── DashboardTabs — root export ─────────────────────────────────────────────

export function DashboardTabs(props: DashboardTabsProps) {
  const { metrics, callLogs, totalCount, currency, clientId, tenant } = props
  const { t } = useLanguage()
  const [tab, setTab] = useState<MainTab>('overview')
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null)

  const mainTabs: { key: MainTab; label: string }[] = [
    { key: 'overview', label: t.dashboard.overview },
    { key: 'inbound', label: t.dashboard.inbound },
    { key: 'outbound', label: t.dashboard.outbound },
  ]

  return (
    <>
      {/* Call detail side panel — global, outside tab container so it overlays everything */}
      <CallDetailPanel log={selectedCall} onClose={() => setSelectedCall(null)} />

      <div className="flex flex-col min-h-0">
        {/* Main tab navigation */}
        <div className="px-6 bg-[var(--brand-surface)] border-b border-[var(--brand-border)] transition-colors duration-200">
          <TabBar tabs={mainTabs} active={tab} onSelect={setTab} />
        </div>

        {/* Tab panels */}
        {tab === 'overview' && (
          <OverviewTab {...props} onSelectCall={setSelectedCall} />
        )}
        {tab === 'inbound' && (
          <InboundTab
            callLogs={callLogs}
            totalCount={totalCount}
            currency={currency}
            clientId={clientId}
            onSelectCall={setSelectedCall}
          />
        )}
        {tab === 'outbound' && (
          <OutboundTab callLogs={callLogs} currency={currency} clientId={clientId} onSelectCall={setSelectedCall} />
        )}
      </div>
    </>
  )
}
