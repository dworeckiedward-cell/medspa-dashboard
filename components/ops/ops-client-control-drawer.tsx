'use client'

import {
  ExternalLink,
  BarChart3,
  DollarSign,
  Plug,
  Phone,
  Globe,
  Palette,
  Bot,
  Activity,
  Shield,
  Calendar,
} from 'lucide-react'
import { Sheet, SheetContent, SheetSection } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { getHealthBadgeStyle } from '@/lib/ops/health-score'
import type { ClientOverview } from '@/lib/ops/query'
import type { ClientHealthScore } from '@/lib/ops/health-score'
import type { ClientUnitEconomics } from '@/lib/ops/unit-economics/types'
import type { ClientCommercialSnapshot } from '@/lib/ops-financials/types'
import {
  SETUP_FEE_STATUS_LABELS,
  SETUP_FEE_STATUS_COLORS,
  RETAINER_STATUS_LABELS,
  RETAINER_STATUS_COLORS,
} from '@/lib/ops-financials/types'
import { PAYBACK_STATUS_LABELS, PAYBACK_STATUS_COLORS } from '@/lib/ops/unit-economics/types'
import { formatMoneyCompact, formatLastPaidLabel } from '@/lib/ops-financials/format'

// ── Props ────────────────────────────────────────────────────────────────────

interface OpsClientControlDrawerProps {
  open: boolean
  onClose: () => void
  overview: ClientOverview | null
  health?: ClientHealthScore
  economics?: ClientUnitEconomics
  snapshot?: ClientCommercialSnapshot
}

// ── Component ────────────────────────────────────────────────────────────────

export function OpsClientControlDrawer({
  open,
  onClose,
  overview,
  health,
  economics,
  snapshot,
}: OpsClientControlDrawerProps) {
  if (!overview) return null

  const { client, callStats, integrationsCount, integrationsHealthy } = overview
  const badge = getHealthBadgeStyle(health?.level ?? 'healthy')

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={client.name}
      description={client.slug}
      size="lg"
    >
      <SheetContent className="space-y-0 p-0">
        {/* Health + quick actions bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--brand-border)]">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
              badge.bgClass,
              badge.textClass,
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', badge.dotClass)} />
            {badge.label}
          </span>
          <div className="flex items-center gap-1">
            <QuickAction href={`/dashboard?tenant=${client.slug}`} icon={ExternalLink} label="Dashboard" />
            <QuickAction href={`/dashboard/reports?tenant=${client.slug}`} icon={BarChart3} label="Reports" />
            <QuickAction href={`/dashboard/integrations?tenant=${client.slug}`} icon={Plug} label="Integrations" />
            <QuickAction href={`/ops/clients/${client.id}/financials`} icon={DollarSign} label="Financials" />
          </div>
        </div>

        {/* ── Identity & Config ──────────────────────────────────────────── */}
        <SheetSection title="Identity & Config">
          <div className="space-y-2.5">
            <InfoRow icon={Palette} label="Brand color" value={client.brand_color ?? '—'}>
              {client.brand_color && (
                <span
                  className="inline-block h-4 w-4 rounded border border-[var(--brand-border)] ml-1.5"
                  style={{ background: client.brand_color }}
                />
              )}
            </InfoRow>
            <InfoRow icon={Globe} label="Custom domain" value={client.custom_domain ?? 'Not configured'} />
            <InfoRow icon={Globe} label="Subdomain" value={client.subdomain ?? client.slug} />
            <InfoRow icon={Calendar} label="Timezone" value={client.timezone} />
            <InfoRow label="Currency" value={client.currency} />
          </div>
        </SheetSection>

        {/* ── Forwarding & Agent IDs ─────────────────────────────────────── */}
        <SheetSection title="Forwarding & Agent IDs">
          <div className="space-y-2.5">
            <InfoRow icon={Phone} label="Forwarding number" value={client.retell_phone_number ?? 'Not set'} mono />
            <InfoRow icon={Bot} label="Agent ID" value={client.retell_agent_id ?? 'Not set'} mono />
            <InfoRow label="N8N webhook" value={client.n8n_webhook_url ? 'Configured' : 'Not set'} />
            <InfoRow label="Stripe customer" value={client.stripe_customer_id ?? 'Not linked'} mono />
          </div>
        </SheetSection>

        {/* ── Integration Health ──────────────────────────────────────────── */}
        <SheetSection title="Integration Health">
          <div className="space-y-2.5">
            <InfoRow icon={Plug} label="Integrations" value={
              integrationsCount > 0
                ? `${integrationsHealthy}/${integrationsCount} healthy`
                : 'None configured'
            }>
              {integrationsCount > 0 && (
                <span className={cn(
                  'ml-1.5 h-2 w-2 rounded-full',
                  integrationsHealthy === integrationsCount ? 'bg-emerald-500' : 'bg-amber-500',
                )} />
              )}
            </InfoRow>
          </div>
        </SheetSection>

        {/* ── AI Control State ────────────────────────────────────────────── */}
        <SheetSection title="AI Control State">
          <div className="space-y-2.5">
            <InfoRow icon={Bot} label="AI enabled" value={client.ai_enabled ? 'Yes' : 'No'}>
              <span className={cn(
                'ml-1.5 h-2 w-2 rounded-full',
                client.ai_enabled ? 'bg-emerald-500' : 'bg-gray-400',
              )} />
            </InfoRow>
            <InfoRow icon={Activity} label="Operating mode" value={formatOperatingMode(client.ai_operating_mode)} />
            <InfoRow icon={Shield} label="Fallback mode" value={formatFallbackMode(client.ai_fallback_mode)} />
            {client.ai_pause_reason && (
              <InfoRow label="Pause reason" value={client.ai_pause_reason} />
            )}
            {client.ai_auto_resume_at && (
              <InfoRow label="Auto-resume" value={new Date(client.ai_auto_resume_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })} />
            )}
          </div>
        </SheetSection>

        {/* ── Usage Snapshot (30d) ────────────────────────────────────────── */}
        <SheetSection title="Usage Snapshot (30d)">
          <div className="grid grid-cols-3 gap-4">
            <StatBox label="Calls" value={callStats.totalCalls.toString()} />
            <StatBox label="Bookings" value={`${callStats.bookedCalls} (${callStats.bookingRate}%)`} />
            <StatBox label="Revenue" value={
              callStats.totalRevenue > 0
                ? formatCurrency(callStats.totalRevenue, client.currency)
                : '—'
            } />
          </div>
          {callStats.lastCallAt && (
            <p className="text-[10px] text-[var(--brand-muted)] mt-2">
              Last activity: {new Date(callStats.lastCallAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          )}
        </SheetSection>

        {/* ── Financial Summary ───────────────────────────────────────────── */}
        <SheetSection title="Financial Summary">
          <div className="space-y-2.5">
            {economics && (
              <>
                <InfoRow label="CAC" value={
                  economics.cacAmount !== null
                    ? `$${Math.round(economics.cacAmount).toLocaleString()}`
                    : 'Not set'
                } />
                <InfoRow label="LTV (collected)" value={`$${Math.round(economics.totalCollectedLtv).toLocaleString()}`} />
                <InfoRow label="LTV:CAC" value={
                  economics.paybackRatio !== null
                    ? `${economics.paybackRatio}x`
                    : '—'
                } />
                <InfoRow label="Payback">
                  <span className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                    PAYBACK_STATUS_COLORS[economics.paybackStatus].bg,
                    PAYBACK_STATUS_COLORS[economics.paybackStatus].text,
                  )}>
                    {PAYBACK_STATUS_LABELS[economics.paybackStatus]}
                  </span>
                </InfoRow>
              </>
            )}
            {snapshot && (
              <>
                <InfoRow label="Setup fee">
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                    SETUP_FEE_STATUS_COLORS[snapshot.setupFeeStatus].bg,
                    SETUP_FEE_STATUS_COLORS[snapshot.setupFeeStatus].text,
                  )}>
                    <span className={cn('h-1 w-1 rounded-full', SETUP_FEE_STATUS_COLORS[snapshot.setupFeeStatus].dot)} />
                    {SETUP_FEE_STATUS_LABELS[snapshot.setupFeeStatus]}
                  </span>
                </InfoRow>
                <InfoRow label="Retainer" value={
                  snapshot.retainerAmount
                    ? formatMoneyCompact(snapshot.retainerAmount)
                    : '—'
                }>
                  {snapshot.retainerAmount && (
                    <span className={cn(
                      'ml-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium',
                      RETAINER_STATUS_COLORS[snapshot.retainerStatus].bg,
                      RETAINER_STATUS_COLORS[snapshot.retainerStatus].text,
                    )}>
                      {RETAINER_STATUS_LABELS[snapshot.retainerStatus]}
                    </span>
                  )}
                </InfoRow>
                <InfoRow label="Last paid" value={formatLastPaidLabel(snapshot.lastPaidAt)} />
                <InfoRow label="MRR included" value={snapshot.mrrIncluded ? 'Yes' : 'No'} />
              </>
            )}
            {!economics && !snapshot && (
              <p className="text-xs text-[var(--brand-muted)]">No financial data available</p>
            )}
          </div>
        </SheetSection>
      </SheetContent>
    </Sheet>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
  children,
}: {
  icon?: React.ElementType
  label: string
  value?: string
  mono?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs text-[var(--brand-muted)] shrink-0">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className="flex items-center text-right min-w-0">
        {value && (
          <span className={cn(
            'text-xs text-[var(--brand-text)] truncate',
            mono && 'font-mono text-[11px]',
          )}>
            {value}
          </span>
        )}
        {children}
      </div>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-3 text-center">
      <p className="text-sm font-semibold text-[var(--brand-text)] tabular-nums">{value}</p>
      <p className="text-[10px] text-[var(--brand-muted)] mt-0.5">{label}</p>
    </div>
  )
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)]/40 transition-colors"
      aria-label={label}
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
    </a>
  )
}

// ── Formatters ───────────────────────────────────────────────────────────────

function formatOperatingMode(mode: string): string {
  const labels: Record<string, string> = {
    live: 'Live',
    paused: 'Paused',
    outbound_only: 'Outbound Only',
    inbound_only: 'Inbound Only',
    maintenance: 'Maintenance',
  }
  return labels[mode] ?? mode
}

function formatFallbackMode(mode: string): string {
  const labels: Record<string, string> = {
    human_handoff: 'Human Handoff',
    voicemail_only: 'Voicemail Only',
    capture_only: 'Capture Only',
    disabled: 'Disabled',
  }
  return labels[mode] ?? mode
}
