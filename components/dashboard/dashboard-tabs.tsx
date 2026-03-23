'use client'

import { useState, useMemo, useCallback, useTransition } from 'react'
import Link from 'next/link'
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
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn, polish, formatCurrency } from '@/lib/utils'
import { KpiCards } from './kpi-cards'
import { RoiChart } from './roi-chart'
import { CallLogsTable } from './call-logs-table'
import { CallDetailPanel } from './call-detail-panel'
import { ConversionTimeline } from './conversion-timeline'
import { TopServicesCard } from './top-services-card'
import { OperationsPanel } from './operations-panel'
import { OnboardingWizard } from './onboarding-wizard'
import { NextActionCard } from './next-action-card'
import { NeedsAttentionCard } from './needs-attention-card'
import { RecommendedActionsCard } from './recommended-actions-card'
import { ServicePerformanceCard } from './service-performance-card'
import { DataQualityCard } from './data-quality-card'
import { SystemAlertsCard } from './system-alerts-card'
import { RecentCallsPreview } from './recent-calls-preview'
import { RecentPositiveCalls } from './recent-positive-calls'
import { buildDashboardHref } from '@/lib/dashboard/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useFrontDeskMode } from '@/lib/dashboard/front-desk-mode'
import { useLanguage } from '@/lib/dashboard/use-language'
import type { DashboardMetrics, CallLog, Client } from '@/types/database'
import type { ClientService } from '@/lib/types/domain'
import type { DashboardException } from '@/lib/dashboard/exceptions'
import type { RecommendedAction } from '@/lib/dashboard/recommended-actions'
import type { RecentBooking } from './recent-appointments-preview'
import { RecentAppointmentsPreview } from './recent-appointments-preview'
import { AiSystemStatusBanner } from './ai-system-status-banner'
import { getTenantFeatures } from '@/lib/dashboard/tenant-features'

// ── Types ───────────────────────────────────────────────────────────────────

interface DashboardTabsProps {
  metrics: DashboardMetrics
  callLogs: CallLog[]
  totalCount: number
  currency: string
  clientId: string
  tenant: Client
  services: ClientService[]
  /** Number of failed CRM delivery logs (for quick actions badge) */
  failedDeliveries?: number
  /** Integration health counts (for system status card) */
  integrationsCount?: number
  integrationsHealthy?: number
  /** Billing summary (for system status card) */
  billing?: import('@/lib/types/domain').BillingSummary | null
  /** Operational exceptions for Needs Attention card */
  exceptions?: DashboardException[]
  /** Recommended actions for operator guidance */
  recommendedActions?: RecommendedAction[]
  /** Active date range in days (7 or 30) — wired to getDashboardMetrics on the server */
  rangeDays?: number
  /** Recent bookings from bookings table for the appointments preview card */
  recentBookings?: RecentBooking[]
}

type MainTab = 'overview'
type OutboundSubTab = 'speed-to-lead' | 'reminders'

const RANGE_OPTIONS = [
  { value: 1, label: '24h' },
  { value: 3, label: '72h' },
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 0, label: 'All' },
] as const

// ── Range switch ────────────────────────────────────────────────────────────

function RangeSwitch({ active }: { active: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useState(active)

  const handleChange = useCallback(
    (days: number) => {
      setOptimistic(days)
      const params = new URLSearchParams(searchParams.toString())
      if (days === 7) {
        params.delete('range')
      } else {
        params.set('range', String(days))
      }
      const qs = params.toString()
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname)
      })
    },
    [router, pathname, searchParams, startTransition],
  )

  const displayed = isPending ? optimistic : active

  return (
    <div className={cn(
      'inline-flex items-center gap-px rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-0.5',
      isPending && 'opacity-70',
    )}>
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => handleChange(opt.value)}
          className={cn(
            'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/30',
            displayed === opt.value
              ? 'bg-[var(--brand-surface)] text-[var(--brand-text)] shadow-sm'
              : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

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
        'flex gap-0.5 border-b border-[var(--brand-border)]/50',
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
              'relative px-4 font-medium transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
              'focus-visible:ring-[var(--user-accent)] motion-reduce:transition-none',
              size === 'md' ? 'py-3 text-[13px]' : 'py-2 text-xs',
              isActive
                ? 'text-[var(--user-accent)]'
                : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
            )}
          >
            {tab.label}
            {/* Active indicator — thicker, rounded bottom bar */}
            {isActive && (
              <span
                className="absolute bottom-0 left-2 right-2 h-[2px] rounded-t-full"
                style={{ background: 'var(--user-accent)' }}
                aria-hidden="true"
              />
            )}
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
      <CardContent className={polish.emptyState}>
        <div className={polish.emptyIcon}>
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
  rangeDays = 7,
  recentBookings,
  onSelectCall,
}: DashboardTabsProps & { onSelectCall: (log: CallLog) => void }) {
  const { mode } = useFrontDeskMode()
  const isSimple = mode === 'simple'
  const features = getTenantFeatures(tenant)

  return (
    <div className="space-y-4 p-4 md:space-y-6 md:p-6 animate-fade-in">
      {/* ── Above the fold: ROI-first ───────────────────────────────── */}

      {/* 1. KPI cards */}
      <KpiCards metrics={metrics} currency={currency} features={features} rangeDays={rangeDays} />

      {/* 2. Revenue Pipeline (2/3) + Recent Positive Calls (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-2">
          <RoiChart
            data={metrics.chartSeries}
            currency={currency}
            rangeDays={rangeDays}
            rangeSwitch={<RangeSwitch active={rangeDays} />}
            showBookedValue={features.showBookedRevenue}
          />
        </div>
        <div className="lg:col-span-1 flex flex-col">
          <RecentPositiveCalls callLogs={callLogs} onSelectCall={onSelectCall} className="flex-1" />
        </div>
      </div>

      {/* 3. Recent Calls — full width */}
      <RecentCallsPreview callLogs={callLogs} onSelectCall={onSelectCall} tenantSlug={tenant.slug} className="min-h-[320px]" />

      {/* 5. Conversion Funnel — hidden for tenants without Jane API */}
      {features.janeApi && (
        <ConversionTimeline callLogs={callLogs} tenantSlug={tenant.slug} showBookedSteps={features.showAppointments} />
      )}

      {/* CTA — visible in all modes including simple */}
      <div className="flex justify-end -mt-2">
        <Link
          href={buildDashboardHref('/dashboard/call-logs', tenant.slug)}
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors duration-150"
        >
          View all calls
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ── Below the fold (hidden in simple mode) ────────────────── */}

      {!isSimple && (
        <>
          {/* Service performance insights — hidden for tenants using Stripe bookings */}
          {services.length > 0 && tenant.slug !== 'live-younger' && (
            <ServicePerformanceCard callLogs={callLogs} services={services} currency={currency} />
          )}

          {/* Top services — hidden for tenants using Stripe bookings */}
          {services.length > 0 && tenant.slug !== 'live-younger' && (
            <TopServicesCard callLogs={callLogs} services={services} currency={currency} />
          )}
        </>
      )}
    </div>
  )
}

// ── Tab content: Setup & Tips ──────────────────────────────────────────────

function SetupTipsTab({
  callLogs,
  tenant,
  services,
  integrationsCount,
  integrationsHealthy,
  billing,
  exceptions,
  recommendedActions,
}: DashboardTabsProps) {
  return (
    <div className="space-y-6 p-6 animate-fade-in">
      {/* AI system status banner — shown when AI is not fully active */}
      <AiSystemStatusBanner tenantSlug={tenant.slug} />

      {/* Operational alerts — surfaces exceptions that need attention */}
      {exceptions && exceptions.length > 0 && (
        <NeedsAttentionCard exceptions={exceptions} />
      )}

      {/* Onboarding wizard (dismissible, DB-backed with localStorage fallback) */}
      <OnboardingWizard
        tenantId={tenant.id}
        tenantSlug={tenant.slug}
        tenantName={tenant.name}
        tenantLogoUrl={tenant.logo_url}
        tenantBrandColor={tenant.brand_color}
      />

      {/* Next recommended action when setup is incomplete */}
      <NextActionCard tenantId={tenant.id} tenantSlug={tenant.slug} />

      {/* AI-driven recommended actions */}
      {recommendedActions && recommendedActions.length > 0 && (
        <RecommendedActionsCard actions={recommendedActions} />
      )}

      {/* Persistent system alerts */}
      <SystemAlertsCard />

      {/* Operations: merged system health + integration info */}
      <OperationsPanel
        callLogs={callLogs}
        tenant={tenant}
        integrationsCount={integrationsCount}
        integrationsHealthy={integrationsHealthy}
        billing={billing}
      />

      {/* Data Quality / Trust Center */}
      <DataQualityCard
        callLogs={callLogs}
        services={services}
        hasIntegrations={(integrationsCount ?? 0) > 0}
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
  // NULL direction defaults to inbound — most Retell calls arrive without an
  // explicit direction tag. Outbound calls are explicitly tagged direction='outbound'.
  const inboundLogs = useMemo(
    () =>
      callLogs.filter((c) => {
        if (c.direction === 'outbound') return false
        if (c.direction === 'inbound') return true
        // NULL direction — include unless call_type is clearly outbound
        if ((c.call_type as string) === 'outbound_call') return false
        return true
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
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 animate-fade-in">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
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
  tenant,
  onSelectCall,
}: Pick<DashboardTabsProps, 'callLogs' | 'currency' | 'clientId' | 'tenant'> & {
  onSelectCall: (log: CallLog) => void
}) {
  const { t } = useLanguage()
  const [subTab, setSubTab] = useState<OutboundSubTab>('speed-to-lead')

  // Live Younger uses a unified view without subtabs
  if (tenant.slug === 'live-younger') {
    return (
      <div className="p-6 space-y-4 animate-fade-in">
        <SpeedToLeadTab callLogs={callLogs} currency={currency} clientId={clientId} onSelectCall={onSelectCall} />
      </div>
    )
  }

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
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
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
  const { mode } = useFrontDeskMode()
  const [tab, setTab] = useState<MainTab>('overview')
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null)

  const mainTabs: { key: MainTab; label: string }[] = [
    { key: 'overview', label: t.dashboard.overview },
  ]

  return (
    <>
      {/* Call detail side panel — global, outside tab container so it overlays everything */}
      <CallDetailPanel log={selectedCall} onClose={() => setSelectedCall(null)} tenantSlug={tenant.slug} />

      <div className="flex flex-col min-h-0">
        {/* Main tab navigation */}
        <div className="px-4 sm:px-6 bg-[var(--brand-surface)] border-b border-[var(--brand-border)] transition-colors duration-200">
          <TabBar tabs={mainTabs} active={tab} onSelect={setTab} />
        </div>

        {/* Tab panels */}
        {tab === 'overview' && (
          <OverviewTab {...props} recentBookings={props.recentBookings} onSelectCall={setSelectedCall} />
        )}
      </div>
    </>
  )
}
