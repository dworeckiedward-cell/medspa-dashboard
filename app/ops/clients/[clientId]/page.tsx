/**
 * /ops/clients/[clientId] — Operator control panel for a single clinic.
 *
 * Tabs: Overview · Branding · AI Control · Errors
 * Financials tab links to the existing /ops/clients/[id]/financials page.
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ExternalLink,
  DollarSign,
  AlertTriangle,
  Bot,
  Palette,
  BarChart3,
  Globe,
  Phone,
  Calendar,
  Activity,
  Shield,
  CheckCircle2,
} from 'lucide-react'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { logOperatorAction } from '@/lib/ops/audit'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { computeClientHealth } from '@/lib/ops/health-score'
import { OpsClientNotes } from '@/components/ops/ops-client-notes'
import { getClientCallStats } from '@/lib/ops/query'
import { getWorkflowErrors } from '@/lib/ops/notifications'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, polish, formatCurrency } from '@/lib/utils'
import type { Client } from '@/types/database'
import { OpsClientDetailsTabs } from './tabs-client'

export const dynamic = 'force-dynamic'

export default async function ClientDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const access = await resolveOperatorAccess()
  if (!access.authorized) redirect('/login')

  const [{ clientId }, sp] = await Promise.all([params, searchParams])
  if (!clientId) redirect('/ops')

  const activeTab = (sp.tab ?? 'overview') as string

  const supabase = createSupabaseServerClient()
  const { data: clientData, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .maybeSingle()

  if (clientError || !clientData) {
    return (
      <div className="min-h-screen bg-[var(--brand-bg)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-[var(--brand-muted)]">Client not found</p>
          <Link href="/ops" className="text-xs text-[var(--brand-primary)] hover:underline mt-2 inline-block">
            Back to Ops Console
          </Link>
        </div>
      </div>
    )
  }

  const client = clientData as unknown as Client

  // Parallel data fetches
  const [callStats, recentErrors] = await Promise.all([
    getClientCallStats(clientId),
    activeTab === 'errors' ? getWorkflowErrors(50, clientId) : Promise.resolve([]),
  ])

  const health = computeClientHealth(
    {
      client,
      callStats,
      integrationsCount: 0,
      integrationsHealthy: 0,
      hasOnboarding: false,
      onboardingComplete: false,
    },
    { failedDeliveries24h: 0 },
  )

  await logOperatorAction({
    operatorId: access.userId ?? 'unknown',
    operatorEmail: access.email,
    action: 'client_dashboard_opened',
    targetClientId: clientId,
    targetClientSlug: client.slug,
    metadata: { tab: activeTab },
  })

  return (
    <div className="min-h-screen bg-[var(--brand-bg)]">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 h-14 flex items-center border-b border-[var(--brand-border)]/50 bg-[var(--brand-bg)]/80 backdrop-blur-xl px-4 sm:px-6">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/ops"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--brand-border)] text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white text-sm font-bold"
              style={{ background: client.brand_color ?? '#2563EB' }}
            >
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-base font-semibold text-[var(--brand-text)]">{client.name}</h1>
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-[var(--brand-muted)]">{client.slug}</p>
                <HealthBadge level={health.level} />
              </div>
            </div>
          </div>

          {/* Quick action: open client dashboard */}
          <a
            href={`/dashboard?tenant=${client.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-1.5 text-xs font-medium text-[var(--brand-text)] hover:bg-[var(--brand-bg)] transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Dashboard
          </a>
        </div>
      </header>

      {/* ── Tab navigation ───────────────────────────────────────────────── */}
      <OpsClientDetailsTabs clientId={clientId} activeTab={activeTab} />

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <>
            {/* Quick actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ActionCard
                href={`/dashboard?tenant=${client.slug}`}
                icon={ExternalLink}
                label="Client Dashboard"
                description="Open as tenant"
                external
              />
              <ActionCard
                href={`/ops/clients/${clientId}/financials`}
                icon={DollarSign}
                label="Edit Financials"
                description="CAC / LTV / MRR"
              />
              <ActionCard
                href={`/ops/clients/${clientId}/errors`}
                icon={AlertTriangle}
                label="View Errors"
                description="n8n workflow errors"
              />
              <ActionCard
                href={`/dashboard/reports?tenant=${client.slug}`}
                icon={BarChart3}
                label="Reports"
                description="Analytics & reports"
                external
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Calls (30d)" value={callStats.totalCalls.toString()} />
              <StatCard label="Bookings" value={`${callStats.bookedCalls} (${callStats.bookingRate}%)`} />
              <StatCard
                label="Revenue"
                value={callStats.totalRevenue > 0
                  ? formatCurrency(callStats.totalRevenue, client.currency)
                  : '—'}
              />
              <StatCard
                label="Last Activity"
                value={callStats.lastCallAt
                  ? new Date(callStats.lastCallAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : '—'}
              />
            </div>

            {/* Internal notes */}
            <OpsClientNotes clientId={clientId} initialNotes={(client as unknown as Record<string, unknown>).ops_notes as string | null} />

            {/* Config snapshot */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-2.5">
                <InfoRow icon={Globe} label="Custom domain" value={client.custom_domain ?? 'Not configured'} />
                <InfoRow icon={Globe} label="Subdomain" value={client.subdomain ?? client.slug} />
                <InfoRow icon={Calendar} label="Timezone" value={client.timezone} />
                <InfoRow label="Currency" value={client.currency} />
                <InfoRow icon={Phone} label="Forwarding number" value={client.retell_phone_number ?? 'Not set'} mono />
                <InfoRow icon={Bot} label="Agent ID" value={client.retell_agent_id ?? 'Not set'} mono />
                <InfoRow label="n8n webhook" value={client.n8n_webhook_url ? 'Configured' : 'Not set'} />
                <InfoRow label="Stripe customer" value={client.stripe_customer_id ?? 'Not linked'} mono />
              </CardContent>
            </Card>
          </>
        )}

        {/* ── BRANDING ── */}
        {activeTab === 'branding' && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Branding</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <InfoRow icon={Palette} label="Logo URL" value={client.logo_url ?? 'Not set'} mono />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-[var(--brand-muted)]">
                  <Palette className="h-3.5 w-3.5" />
                  Brand color
                </div>
                <div className="flex items-center gap-2">
                  {client.brand_color && (
                    <div
                      className="h-5 w-5 rounded border border-[var(--brand-border)]"
                      style={{ background: client.brand_color }}
                    />
                  )}
                  <span className="text-xs font-mono text-[var(--brand-text)]">
                    {client.brand_color ?? '—'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-[var(--brand-muted)]">
                  <Palette className="h-3.5 w-3.5" />
                  Accent color
                </div>
                <div className="flex items-center gap-2">
                  {client.accent_color && (
                    <div
                      className="h-5 w-5 rounded border border-[var(--brand-border)]"
                      style={{ background: client.accent_color }}
                    />
                  )}
                  <span className="text-xs font-mono text-[var(--brand-text)]">
                    {client.accent_color ?? '—'}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[var(--brand-muted)] pt-2 border-t border-[var(--brand-border)]">
                Branding edits are available in the client dashboard Settings → Branding.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── AI CONTROL ── */}
        {activeTab === 'ai' && (
          <Card>
            <CardHeader><CardTitle className="text-sm">AI System Control</CardTitle></CardHeader>
            <CardContent className="space-y-2.5">
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
              {client.ai_pause_note && (
                <InfoRow label="Pause note" value={client.ai_pause_note} />
              )}
              {client.ai_auto_resume_at && (
                <InfoRow label="Auto-resume" value={new Date(client.ai_auto_resume_at).toLocaleString()} />
              )}
              <p className="text-[11px] text-[var(--brand-muted)] pt-2 border-t border-[var(--brand-border)]">
                AI control changes are managed via the AI Control admin page or the n8n automation API.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── ERRORS ── */}
        {activeTab === 'errors' && (
          <div>
            {recentErrors.length === 0 ? (
              <Card>
                <CardContent className="p-0">
                  <div className={polish.emptyState}>
                    <div className={polish.emptyIcon}>
                      <CheckCircle2 className="h-6 w-6 text-emerald-500 opacity-70" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--brand-text)]">No errors for this clinic</p>
                      <p className="text-xs text-[var(--brand-muted)] mt-1">
                        Errors from n8n workflows will appear here automatically.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-[var(--brand-border)]">
                    {recentErrors.map((e) => {
                      const payload = e.errorPayload
                      const sev = payload?.severity ?? 'error'
                      const sevColors: Record<string, string> = {
                        critical: 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400',
                        error: 'bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400',
                        warning: 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400',
                        info: 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400',
                      }
                      let timeAgo = '—'
                      try { timeAgo = new Date(e.createdAt).toLocaleString() } catch { /**/ }
                      return (
                        <div key={e.id} className="px-5 py-3 hover:bg-[var(--brand-bg)]/50">
                          <div className="flex items-start gap-3">
                            <span className={cn('mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0', sevColors[sev] ?? sevColors.error)}>
                              {sev}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-[var(--brand-text)]">{payload?.workflow ?? 'Unknown workflow'}</p>
                              <p className="text-xs text-[var(--brand-muted)] mt-0.5 line-clamp-2">{payload?.errorMessage ?? e.title}</p>
                            </div>
                            <p className="text-[10px] text-[var(--brand-muted)] shrink-0">{timeAgo}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HealthBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    healthy: 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400',
    watch: 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
    critical: 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400',
    onboarding: 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400',
  }
  const labels: Record<string, string> = {
    healthy: 'Healthy', watch: 'Watch', critical: 'Critical', onboarding: 'Onboarding',
  }
  return (
    <span className={cn('text-[9px] font-medium rounded-full px-1.5 py-0.5', styles[level] ?? styles.healthy)}>
      {labels[level] ?? level}
    </span>
  )
}

function ActionCard({
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
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3.5 hover:bg-[var(--brand-bg)] hover:border-[var(--brand-text)]/10 transition-all group block"
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-primary)]/10 mb-2">
        <Icon className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
      </div>
      <p className="text-xs font-semibold text-[var(--brand-text)] group-hover:text-[var(--brand-primary)] transition-colors">{label}</p>
      <p className="text-[10px] text-[var(--brand-muted)] mt-0.5">{description}</p>
    </Link>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
      <p className="text-sm font-semibold text-[var(--brand-text)] tabular-nums">{value}</p>
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
          <span className={cn('text-xs text-[var(--brand-text)] truncate', mono && 'font-mono text-[11px]')}>
            {value}
          </span>
        )}
        {children}
      </div>
    </div>
  )
}

function formatOperatingMode(mode: string): string {
  const labels: Record<string, string> = {
    live: 'Live', paused: 'Paused', outbound_only: 'Outbound Only',
    inbound_only: 'Inbound Only', maintenance: 'Maintenance',
  }
  return labels[mode] ?? mode
}

function formatFallbackMode(mode: string): string {
  const labels: Record<string, string> = {
    human_handoff: 'Human Handoff', voicemail_only: 'Voicemail Only',
    capture_only: 'Capture Only', disabled: 'Disabled',
  }
  return labels[mode] ?? mode
}
