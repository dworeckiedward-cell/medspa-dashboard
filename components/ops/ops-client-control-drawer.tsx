'use client'

import {
  ExternalLink,
  Settings,
  DollarSign,
  AlertTriangle,
  Bot,
  Phone,
  Globe,
  Calendar,
  Activity,
} from 'lucide-react'
import { Sheet, SheetContent, SheetSection } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { getHealthBadgeStyle } from '@/lib/ops/health-score'
import type { ClientOverview } from '@/lib/ops/query'
import type { ClientHealthScore } from '@/lib/ops/health-score'
import type { ClientUnitEconomics } from '@/lib/ops/unit-economics/types'
import type { ClientCommercialSnapshot } from '@/lib/ops-financials/types'
import { formatMoneyCompact } from '@/lib/ops-financials/format'

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
        {/* ── Health badge ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[var(--brand-border)]">
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
          <span className="text-[10px] text-[var(--brand-muted)]">{client.slug}</span>
        </div>

        {/* ── Primary Actions ────────────────────────────────────────────── */}
        <SheetSection title="Actions">
          <div className="grid grid-cols-2 gap-2">
            <PrimaryAction
              href={`/dashboard?tenant=${client.slug}`}
              icon={ExternalLink}
              label="Open Client Dashboard"
              description="View as tenant"
              external
            />
            <PrimaryAction
              href={`/ops/clients/${client.id}`}
              icon={Settings}
              label="Clinic Details"
              description="Overview & config"
            />
            <PrimaryAction
              href={`/ops/clients/${client.id}/financials`}
              icon={DollarSign}
              label="Edit Financials"
              description="CAC / LTV / MRR"
            />
            <PrimaryAction
              href={`/ops/clients/${client.id}/errors`}
              icon={AlertTriangle}
              label="View Errors"
              description="n8n workflow errors"
            />
          </div>
          {/* AI toggle — coming soon */}
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--brand-border)]/50 bg-[var(--brand-bg)]/60 px-3 py-2 opacity-60">
            <Bot className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
            <span className="text-xs text-[var(--brand-muted)]">Toggle AI</span>
            <span className="ml-auto text-[9px] rounded-full bg-[var(--brand-border)] text-[var(--brand-muted)] px-1.5 py-0.5 font-medium">
              Coming soon
            </span>
          </div>
        </SheetSection>

        {/* ── Quick Stats ────────────────────────────────────────────────── */}
        <SheetSection title="Stats (30d)">
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Calls" value={callStats.totalCalls.toString()} />
            <StatBox
              label="Bookings"
              value={`${callStats.bookedCalls} (${callStats.bookingRate}%)`}
            />
            <StatBox
              label="Revenue"
              value={callStats.totalRevenue > 0
                ? formatCurrency(callStats.totalRevenue, client.currency)
                : '—'}
            />
            <StatBox
              label="Integrations"
              value={integrationsCount > 0
                ? `${integrationsHealthy}/${integrationsCount}`
                : '—'}
              highlight={integrationsCount > 0 && integrationsHealthy < integrationsCount}
            />
          </div>
          {economics && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <StatBox
                label="MRR"
                value={snapshot?.retainerAmount
                  ? formatMoneyCompact(snapshot.retainerAmount)
                  : '—'}
              />
              <StatBox
                label="CAC"
                value={economics.cacAmount !== null
                  ? `$${Math.round(economics.cacAmount).toLocaleString()}`
                  : '—'}
              />
              <StatBox
                label="LTV:CAC"
                value={economics.paybackRatio !== null
                  ? `${economics.paybackRatio}x`
                  : '—'}
              />
            </div>
          )}
        </SheetSection>

        {/* ── Config Snapshot ────────────────────────────────────────────── */}
        <SheetSection title="Config">
          <div className="space-y-2.5">
            <InfoRow icon={Bot} label="AI enabled" value={client.ai_enabled ? 'Yes' : 'No'}>
              <span className={cn(
                'ml-1.5 h-2 w-2 rounded-full',
                client.ai_enabled ? 'bg-emerald-500' : 'bg-gray-400',
              )} />
            </InfoRow>
            <InfoRow icon={Activity} label="AI mode" value={client.ai_operating_mode} />
            <InfoRow icon={Phone} label="Forwarding" value={client.retell_phone_number ?? 'Not set'} mono />
            <InfoRow icon={Globe} label="Domain" value={client.custom_domain ?? client.slug} />
            <InfoRow icon={Calendar} label="Timezone" value={client.timezone} />
          </div>
        </SheetSection>
      </SheetContent>
    </Sheet>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PrimaryAction({
  href,
  icon: Icon,
  label,
  description,
  external,
}: {
  href: string
  icon: React.ElementType
  label: string
  description: string
  external?: boolean
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="flex items-start gap-2.5 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-bg)] p-3 hover:bg-[var(--brand-surface)] hover:border-[var(--brand-text)]/10 transition-all group"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary)]/10">
        <Icon className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[var(--brand-text)] group-hover:text-[var(--brand-primary)] transition-colors leading-tight">
          {label}
        </p>
        <p className="text-[10px] text-[var(--brand-muted)] mt-0.5">{description}</p>
      </div>
    </a>
  )
}

function StatBox({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-3 text-center">
      <p className={cn(
        'text-sm font-semibold tabular-nums leading-none',
        highlight ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--brand-text)]',
      )}>
        {value}
      </p>
      <p className="text-[10px] text-[var(--brand-muted)] mt-0.5">{label}</p>
    </div>
  )
}

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
