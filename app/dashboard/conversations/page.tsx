import { redirect } from 'next/navigation'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { listConversations, getConversationsKpiSummary } from '@/lib/chat/query'
import { DashboardLayout } from '@/components/dashboard/layout'
import { TenantNotFound } from '@/components/shared/tenant-not-found'
import { ConversationsKpiStrip } from '@/components/dashboard/conversations-kpi-strip'
import { ConversationsTable } from '@/components/dashboard/conversations-table'

export const dynamic = 'force-dynamic'

export default async function ConversationsPage() {
  const { tenant, accessMode, needsTenantSelection } = await resolveTenantAccess()

  if (!tenant) {
    if (needsTenantSelection) redirect('/dashboard/select-tenant')
    return (
      <TenantNotFound
        reason={accessMode === 'authenticated' ? 'no_workspace' : 'not_found'}
      />
    )
  }

  const [conversations, kpiSummary] = await Promise.all([
    listConversations(tenant.id, { limit: 50 }),
    getConversationsKpiSummary(tenant.id),
  ])

  return (
    <DashboardLayout tenant={tenant} followUpCount={0} bookedNotificationCount={0} bookedNotifications={[]}>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Page heading */}
        <div>
          <h1 className="text-lg font-semibold text-[var(--brand-text)] tracking-tight">
            Conversations
          </h1>
          <p className="text-xs text-[var(--brand-muted)] mt-0.5">
            Chat conversations from SMS, Instagram, and WhatsApp channels
          </p>
        </div>

        {/* KPI strip */}
        <ConversationsKpiStrip summary={kpiSummary} />

        {/* Conversations table */}
        <ConversationsTable
          conversations={conversations}
          tenantSlug={tenant.slug}
        />
      </div>
    </DashboardLayout>
  )
}
