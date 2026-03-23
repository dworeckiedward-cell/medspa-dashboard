/**
 * Agent Optimization page — for Outbound clients only.
 *
 * Server component: loads existing insights + recommendations from tenant JSON.
 * All generation is async (client-initiated via API route).
 */

import { redirect } from 'next/navigation'
import { resolveTenantAccess } from '@/lib/dashboard/resolve-tenant-access'
import { readAgentOptimization } from '@/lib/ai/agent-optimization/store'
import { DashboardLayout } from '@/components/dashboard/layout'
import { TenantNotFound } from '@/components/shared/tenant-not-found'
import { AgentOptimizationClient } from '@/components/dashboard/agent-optimization/agent-optimization-client'

export const dynamic = 'force-dynamic'

export default async function AgentOptimizationPage() {
  const { tenant, accessMode, needsTenantSelection } = await resolveTenantAccess()

  if (!tenant) {
    if (needsTenantSelection) redirect('/dashboard/select-tenant')
    return (
      <TenantNotFound
        reason={accessMode === 'authenticated' ? 'no_workspace' : 'not_found'}
      />
    )
  }

  // Gate: outbound clients only
  if (tenant.client_type !== 'outbound') {
    redirect('/dashboard')
  }

  // SSR: load existing store (no generation — async only)
  const store = await readAgentOptimization(tenant.id)

  return (
    <DashboardLayout
      tenant={tenant}
      followUpCount={0}
      bookedNotificationCount={0}
      bookedNotifications={[]}
    >
      <AgentOptimizationClient store={store} tenantId={tenant.id} />
    </DashboardLayout>
  )
}
