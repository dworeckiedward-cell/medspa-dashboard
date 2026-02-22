import { redirect } from 'next/navigation'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { logOperatorAction } from '@/lib/ops/audit'
import { listOpsRequests, getSupportKpiSummary } from '@/lib/support/query'
import { OpsRequestsTable } from '@/components/ops/ops-requests-table'

export const dynamic = 'force-dynamic'

export default async function OpsRequestsPage() {
  const access = await resolveOperatorAccess()

  if (!access.authorized) {
    redirect('/login')
  }

  await logOperatorAction({
    operatorId: access.userId ?? 'unknown',
    operatorEmail: access.email,
    action: 'support_requests_viewed',
  })

  const [requests, kpi] = await Promise.all([
    listOpsRequests({ limit: 100 }),
    getSupportKpiSummary(),
  ])

  return (
    <div className="min-h-screen bg-[var(--brand-bg)]">
      <header className="border-b border-[var(--brand-border)] bg-[var(--brand-surface)] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <a
                href="/ops"
                className="text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
              >
                Ops Console
              </a>
              <span className="text-xs text-[var(--brand-muted)]">/</span>
              <h1 className="text-lg font-semibold text-[var(--brand-text)] tracking-tight">
                Support Requests
              </h1>
            </div>
            <p className="text-xs text-[var(--brand-muted)] mt-0.5">
              Cross-tenant support request queue
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--brand-muted)]">
              {access.email ?? 'Operator'}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <OpsRequestsTable requests={requests} kpi={kpi} />
      </div>
    </div>
  )
}
