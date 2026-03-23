import { redirect } from 'next/navigation'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { listClientServices } from '@/lib/dashboard/services-query'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { startOfMonth } from 'date-fns'
import { DashboardLayout } from '@/components/dashboard/layout'
import { TenantNotFound } from '@/components/shared/tenant-not-found'
import { ServicesPricingManager } from '@/components/dashboard/services-pricing-manager'
import { LogoCard } from '@/components/dashboard/logo-card'
import {
  AppearanceSection,
  SettingsHeading,
} from '@/components/dashboard/settings-sections'
import { TimezoneEditor } from '@/components/dashboard/timezone-editor'
import { StripeConnectCard } from '@/components/dashboard/stripe-connect-card'
import { AiUsageCard } from '@/components/dashboard/ai-usage-card'
import type { AiUsageData } from '@/components/dashboard/ai-usage-card'
import { SetupGuideCard } from '@/components/dashboard/setup-guide-card'
import { CallingHoursCard } from '@/components/dashboard/calling-hours-card'

export const dynamic = 'force-dynamic'

async function getAiUsageData(tenantId: string, tenantSlug: string, budgetCents: number): Promise<AiUsageData> {
  const supabase = createSupabaseServerClient()
  const monthStart = startOfMonth(new Date()).toISOString()

  const { data } = await supabase
    .from('call_logs')
    .select('cost_cents, duration_seconds')
    .eq('client_id', tenantId)
    .gte('created_at', monthStart)

  const rows = (data ?? []) as { cost_cents: number | null; duration_seconds: number | null }[]
  const realCostCents = rows.reduce((s, r) => s + (r.cost_cents ?? 0), 0)
  const totalSeconds = rows.reduce((s, r) => s + (r.duration_seconds ?? 0), 0)
  const totalMinutes = Math.round(totalSeconds / 60)
  const callCount = rows.length

  // Retell doesn't always include `cost` in their webhook payload.
  // Fall back to estimating at $0.115/min (inbound + outbound agent rate).
  const CENTS_PER_SEC = 11.5 / 60 // $0.115/min in cents/sec
  const costCents = realCostCents > 0 ? realCostCents : Math.round(totalSeconds * CENTS_PER_SEC)

  return { costCents, budgetCents, callCount, totalMinutes, tenantId, tenantSlug }
}

export default async function SettingsPage() {
  const { tenant, accessMode, needsTenantSelection } = await resolveTenantAccess()

  if (!tenant) {
    if (needsTenantSelection) redirect('/dashboard/select-tenant')
    return (
      <TenantNotFound
        reason={accessMode === 'authenticated' ? 'no_workspace' : 'not_found'}
      />
    )
  }

  const [initialServices, aiUsage] = await Promise.all([
    listClientServices(tenant.id),
    getAiUsageData(tenant.id, tenant.slug, tenant.monthly_ai_budget_cents ?? 10000),
  ])

  return (
    <DashboardLayout tenant={tenant} followUpCount={0} bookedNotificationCount={0} bookedNotifications={[]}>
      <div className="max-w-2xl mx-auto p-4 sm:p-6 pb-16">
        <div className="pt-5 pb-4 mb-6 border-b border-[var(--brand-border)]/50">
          <SettingsHeading />
        </div>

        <div className="space-y-8">
          {/* Clinic Branding — Logo */}
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--brand-text)]">Clinic Branding</h2>
              <p className="text-xs text-[var(--brand-muted)] mt-0.5">
                Your clinic logo is displayed in the dashboard header and reports.
              </p>
            </div>
            <LogoCard
              currentLogoUrl={tenant.logo_url}
              tenantName={tenant.name}
              brandColor={tenant.brand_color}
              tenantSlug={tenant.slug}
            />
          </section>

          {/* Appearance */}
          <AppearanceSection />

          {/* Services & Pricing */}
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--brand-text)]">Services & Pricing</h2>
              <p className="text-xs text-[var(--brand-muted)] mt-0.5">
                Define the services your practice offers. Prices power revenue attribution, ROI reporting, and service performance insights across the dashboard.
              </p>
            </div>
            <ServicesPricingManager
              initialServices={initialServices}
              currency={tenant.currency}
              tenantSlug={tenant.slug}
            />
          </section>

          {/* Workspace — read-only tenant config */}
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--brand-text)]">Workspace</h2>
              <p className="text-xs text-[var(--brand-muted)] mt-0.5">
                Tenant configuration managed by the Servify team.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 space-y-3">
              <div className="flex items-center justify-between gap-4 border-b border-[var(--brand-border)] pb-3">
                <span className="text-xs text-[var(--brand-muted)] shrink-0">Name</span>
                <span className="text-xs font-medium text-[var(--brand-text)] truncate text-right">
                  {tenant.name}
                </span>
              </div>

              <div className="border-b border-[var(--brand-border)] pb-3">
                <TimezoneEditor
                  currentTimezone={tenant.timezone || 'America/Edmonton'}
                  tenantSlug={tenant.slug}
                />
              </div>

              <div className="flex items-center justify-between gap-4 border-b border-[var(--brand-border)] pb-3">
                <span className="text-xs text-[var(--brand-muted)] shrink-0">Currency</span>
                <span className="text-xs font-medium text-[var(--brand-text)] truncate text-right">
                  {tenant.currency}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-[var(--brand-muted)] shrink-0">AI Agent Phone</span>
                <span className="text-xs font-medium text-[var(--brand-text)] truncate text-right">
                  {tenant.retell_phone_number || '—'}
                </span>
              </div>
            </div>
          </section>

          {/* AI Calling Schedule */}
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--brand-text)]">AI Calling Schedule</h2>
              <p className="text-xs text-[var(--brand-muted)] mt-0.5">
                Set the two daily call times Emma uses to reach leads.
              </p>
            </div>
            <CallingHoursCard />
          </section>

          {/* AI Usage */}
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--brand-text)]">AI Usage</h2>
              <p className="text-xs text-[var(--brand-muted)] mt-0.5">
                Monthly AI call spend vs. your budget. Resets on the 1st of each month.
              </p>
            </div>
            <AiUsageCard data={aiUsage} />
          </section>

          {/* Setup & Tips */}
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--brand-text)]">Setup & Tips</h2>
              <p className="text-xs text-[var(--brand-muted)] mt-0.5">
                Quick guides to get the most out of your AI receptionist.
              </p>
            </div>
            <SetupGuideCard agentPhone={tenant.retell_phone_number ?? '+1 (587) 324-7689'} />
          </section>

          {/* Support */}
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--brand-text)]">Support</h2>
              <p className="text-xs text-[var(--brand-muted)] mt-0.5">
                Get help or report an issue with your workspace.
              </p>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 flex items-center justify-between gap-6">
                <div>
                  <p className="text-sm font-medium text-[var(--brand-text)]">Powered by Servify</p>
                  <p className="text-xs text-[var(--brand-muted)] mt-0.5">
                    AI receptionist platform for modern med spas.
                  </p>
                </div>
                <a
                  href="mailto:team@servifylabs.com"
                  className="shrink-0 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-1.5 text-xs font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-primary)]/50 transition-colors duration-150"
                >
                  Contact support
                </a>
              </div>
              <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 flex items-center justify-between gap-6">
                <div>
                  <p className="text-sm font-medium text-[var(--brand-text)]">Schedule a Call</p>
                  <p className="text-xs text-[var(--brand-muted)] mt-0.5">
                    Book a technical call with our team.
                  </p>
                </div>
                <a
                  href="https://calendly.com/servifylabs/discovery-call-1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-1.5 text-xs font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-primary)]/50 transition-colors duration-150"
                >
                  Schedule a call →
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  )
}
