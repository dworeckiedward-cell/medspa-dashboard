import { redirect, notFound } from 'next/navigation'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { logOperatorAction } from '@/lib/ops/audit'
import { getOpsRequestWithUpdates } from '@/lib/support/query'
import { OpsRequestDetail } from '@/components/ops/ops-request-detail'

export const dynamic = 'force-dynamic'

export default async function OpsRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>
}) {
  const access = await resolveOperatorAccess()

  if (!access.authorized) {
    redirect('/login')
  }

  const { requestId } = await params

  await logOperatorAction({
    operatorId: access.userId ?? 'unknown',
    operatorEmail: access.email,
    action: 'support_request_detail_viewed',
    metadata: { requestId },
  })

  const { request, updates, slaInfo } = await getOpsRequestWithUpdates(requestId)

  if (!request) {
    notFound()
  }

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
              <a
                href="/ops/requests"
                className="text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
              >
                Requests
              </a>
              <span className="text-xs text-[var(--brand-muted)]">/</span>
              <span className="text-xs font-medium text-[var(--brand-text)] font-mono">
                {request.shortCode}
              </span>
            </div>
            <h1 className="text-lg font-semibold text-[var(--brand-text)] tracking-tight mt-1">
              {request.subject}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--brand-muted)]">
              {access.email ?? 'Operator'}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <OpsRequestDetail request={request} updates={updates} slaInfo={slaInfo} />
      </div>
    </div>
  )
}
