import { redirect } from 'next/navigation'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { getDashboardMetrics, getCallLogs } from '@/lib/dashboard/metrics'
import { listActiveClientServices } from '@/lib/dashboard/services-query'
import { listClientIntegrations } from '@/lib/integrations/crm/config-query'
import { computeHealthSummary } from '@/lib/integrations/crm/health'
import { listCrmDeliveryLogs } from '@/lib/integrations/crm/query'
import { getMockBillingSummary } from '@/lib/dashboard/billing'
import { deriveExceptions } from '@/lib/dashboard/exceptions'
import { deriveRecommendedActions } from '@/lib/dashboard/recommended-actions'
import { listServiceAliases } from '@/lib/dashboard/service-alias-query'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/dashboard/layout'
import { ModeDashboard } from '@/components/dashboard/mode-dashboard'
import { DashboardTabsShell } from '@/components/dashboard/dashboard-tabs-shell'
import { TenantNotFound } from '@/components/shared/tenant-not-found'
import { getDashboardMode } from '@/lib/ops/get-client-type'
import { computeOutboundMetrics } from '@/lib/dashboard/outbound-metrics'
import { computeFbLeadsMetrics } from '@/lib/dashboard/fb-leads-metrics'
import type { BookedNotification, BudgetAlertLevel } from '@/components/dashboard/notification-bell'
import type { RecentBooking } from '@/components/dashboard/recent-appointments-preview'

// Always render fresh — tenant data and call logs must not be stale
export const dynamic = 'force-dynamic'

async function getAiBudgetAlert(tenantId: string, budgetCents: number): Promise<BudgetAlertLevel> {
  if (budgetCents <= 0) return null
  const supabase = createSupabaseServerClient()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { data } = await supabase
    .from('call_logs')
    .select('cost_cents, duration_seconds')
    .eq('client_id', tenantId)
    .gte('created_at', monthStart)
  const rows = ((data ?? []) as { cost_cents: number | null; duration_seconds: number | null }[])
  const realCostCents = rows.reduce((s, r) => s + (r.cost_cents ?? 0), 0)
  const totalSeconds = rows.reduce((s, r) => s + (r.duration_seconds ?? 0), 0)
  const costCents = realCostCents > 0 ? realCostCents : Math.round(totalSeconds * (11.5 / 60))
  const pct = Math.round((costCents / budgetCents) * 100)
  if (pct >= 100) return 'critical'
  if (pct >= 90) return 'warning'
  return null
}

const VALID_RANGES = [1, 3, 7, 30, 0] as const
type RangeDays = (typeof VALID_RANGES)[number]

// ── Shared helper: extract booked notifications from call logs ──────────────

function extractBookedNotifications(callLogs: import('@/types/database').CallLog[]): {
  notifications: BookedNotification[]
  count: number
} {
  const booked = callLogs.filter((c) => c.is_booked)
  return {
    notifications: booked
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        title: c.semantic_title ?? 'Appointment booked',
        created_at: c.created_at,
        caller_name: c.caller_name,
        potential_revenue: c.potential_revenue > 0 ? c.potential_revenue : null,
      })),
    count: booked.length,
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const sp = await searchParams
  const rangeDays: RangeDays = VALID_RANGES.includes(Number(sp.range) as RangeDays)
    ? (Number(sp.range) as RangeDays)
    : 7
  const { tenant, accessMode, needsTenantSelection } = await resolveTenantAccess()

  if (!tenant) {
    if (needsTenantSelection) redirect('/dashboard/select-tenant')
    return (
      <TenantNotFound
        reason={accessMode === 'authenticated' ? 'no_workspace' : 'not_found'}
      />
    )
  }

  const dashboardMode = getDashboardMode(tenant)

  // ── Outbound DB dashboard — lightweight fetch, computed from call_logs ─────
  if (dashboardMode === 'outbound_db') {
    const [{ data: callLogs }, budgetAlert] = await Promise.all([
      getCallLogs(tenant.id, { limit: 500 }),
      getAiBudgetAlert(tenant.id, tenant.monthly_ai_budget_cents ?? 10000),
    ])
    const outboundMetrics = computeOutboundMetrics(callLogs, rangeDays)

    const followUpCount = callLogs.filter((c) => c.human_followup_needed).length
    const { notifications: bookedNotifications, count: bookedNotificationCount } =
      extractBookedNotifications(callLogs)

    return (
      <DashboardLayout
        tenant={tenant}
        followUpCount={followUpCount}
        bookedNotificationCount={bookedNotificationCount}
        bookedNotifications={bookedNotifications}
        callLogs={callLogs}
        budgetAlert={budgetAlert}
      >
        <DashboardTabsShell
          tenant={tenant}
          overviewContent={
            <ModeDashboard
              mode="outbound_db"
              tenant={tenant}
              metrics={outboundMetrics}
              callLogs={callLogs}
              rangeDays={rangeDays}
            />
          }
        />
      </DashboardLayout>
    )
  }

  // ── FB Leads dashboard — lightweight fetch, metrics computed from call_logs ──
  if (dashboardMode === 'fb_leads') {
    const [{ data: callLogs }, budgetAlert] = await Promise.all([
      getCallLogs(tenant.id, { limit: 500 }),
      getAiBudgetAlert(tenant.id, tenant.monthly_ai_budget_cents ?? 10000),
    ])
    const fbMetrics = computeFbLeadsMetrics(callLogs, rangeDays)

    const followUpCount = callLogs.filter((c) => c.human_followup_needed).length
    const { notifications: bookedNotifications, count: bookedNotificationCount } =
      extractBookedNotifications(callLogs)

    return (
      <DashboardLayout
        tenant={tenant}
        followUpCount={followUpCount}
        bookedNotificationCount={bookedNotificationCount}
        bookedNotifications={bookedNotifications}
        callLogs={callLogs}
        budgetAlert={budgetAlert}
      >
        <DashboardTabsShell
          tenant={tenant}
          overviewContent={
            <ModeDashboard
              mode="fb_leads"
              tenant={tenant}
              metrics={fbMetrics}
              callLogs={callLogs}
              rangeDays={rangeDays}
            />
          }
        />
      </DashboardLayout>
    )
  }

  // ── Inbound Clinic (default) dashboard — full parallel fetch ──────────────
  // Parallel data fetch — all 8 queries run concurrently
  // SECURITY: client_id sourced from trusted tenant config, not URL
  const supabase = createSupabaseServerClient()
  const [
    metrics,
    { data: callLogs, count: totalCount },
    activeServices,
    integrations,
    deliveryLogs,
    billing,
    aliases,
    { data: recentBookingsRaw },
    budgetAlert,
  ] = await Promise.all([
    getDashboardMetrics(tenant.id, rangeDays),
    getCallLogs(tenant.id, { limit: 100 }),
    listActiveClientServices(tenant.id),
    listClientIntegrations(tenant.id),
    listCrmDeliveryLogs(tenant.id, undefined, 50),
    Promise.resolve(getMockBillingSummary(tenant.id)),
    listServiceAliases(tenant.id),
    supabase
      .from('bookings')
      .select('id, patient_name, patient_phone, patient_email, appointment_date, appointment_time, payment_status, status, amount_cents, currency, duration_minutes, practitioner_name, patient_notes, call_log_id, stripe_payment_method_id, no_show_charged, created_at, tenant_services(name)')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(5),
    getAiBudgetAlert(tenant.id, tenant.monthly_ai_budget_cents ?? 10000),
  ])

  const recentBookings: RecentBooking[] = (recentBookingsRaw ?? []).map((b) => ({
    id: b.id,
    patient_name: b.patient_name,
    patient_phone: b.patient_phone ?? null,
    patient_email: (b as Record<string, unknown>).patient_email as string | null ?? null,
    appointment_date: b.appointment_date,
    appointment_time: b.appointment_time,
    payment_status: b.payment_status,
    status: b.status,
    amount_cents: (b as Record<string, unknown>).amount_cents as number ?? 0,
    currency: (b as Record<string, unknown>).currency as string ?? 'cad',
    duration_minutes: (b as Record<string, unknown>).duration_minutes as number ?? 0,
    practitioner_name: (b as Record<string, unknown>).practitioner_name as string | null ?? null,
    patient_notes: (b as Record<string, unknown>).patient_notes as string | null ?? null,
    call_log_id: (b as Record<string, unknown>).call_log_id as string | null ?? null,
    stripe_payment_method_id: (b as Record<string, unknown>).stripe_payment_method_id as string | null ?? null,
    no_show_charged: (b as Record<string, unknown>).no_show_charged as boolean | null ?? null,
    created_at: (b as Record<string, unknown>).created_at as string ?? new Date().toISOString(),
    service_name: (Array.isArray(b.tenant_services) ? (b.tenant_services as { name: string }[])[0]?.name : (b.tenant_services as { name: string } | null)?.name) ?? null,
  }))

  const followUpCount = callLogs.filter((c) => c.human_followup_needed).length
  const { notifications: bookedNotifications, count: bookedNotificationCount } =
    extractBookedNotifications(callLogs)

  // Integration health for system status card
  const healthSummary = computeHealthSummary(integrations, deliveryLogs)
  const failedDeliveries = deliveryLogs.filter((l) => !l.success).length

  // Operational exceptions + recommended actions (pure computation, no IO)
  const exceptions = deriveExceptions({
    callLogs,
    deliveryLogs,
    integrations,
    servicesCount: activeServices.length,
  })

  const recommendedActions = deriveRecommendedActions({
    callLogs,
    services: activeServices,
    integrations,
    deliveryLogs,
    aliasCount: aliases.length,
  })

  return (
    <DashboardLayout
      tenant={tenant}
      followUpCount={followUpCount}
      bookedNotificationCount={bookedNotificationCount}
      bookedNotifications={bookedNotifications}
      callLogs={callLogs}
      budgetAlert={budgetAlert}
    >
      <DashboardTabsShell
        tenant={tenant}
        overviewContent={
          <ModeDashboard
            mode="inbound_clinic"
            tenant={tenant}
            metrics={metrics}
            callLogs={callLogs}
            totalCount={totalCount}
            services={activeServices}
            rangeDays={rangeDays}
            failedDeliveries={failedDeliveries}
            integrationsCount={integrations.length}
            integrationsHealthy={healthSummary.activeIntegrations}
            billing={billing}
            exceptions={exceptions}
            recommendedActions={recommendedActions}
            recentBookings={recentBookings}
          />
        }
      />
    </DashboardLayout>
  )
}
