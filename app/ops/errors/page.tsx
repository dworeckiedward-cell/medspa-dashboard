/**
 * /ops/errors — Cross-tenant workflow errors console.
 * Shows all errors ingested via POST /api/ops/errors/ingest.
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, CheckCircle2, Info, Zap } from 'lucide-react'
import { resolveOperatorAccess } from '@/lib/ops/resolve-operator-access'
import { getWorkflowErrors } from '@/lib/ops/notifications'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn, polish } from '@/lib/utils'
import { formatDistanceToNow, parseISO } from 'date-fns'
import type { WorkflowErrorSeverity } from '@/lib/ops/notifications'

export const dynamic = 'force-dynamic'

const SEVERITY_CONFIG: Record<WorkflowErrorSeverity, {
  label: string
  bg: string
  text: string
  icon: React.ElementType
}> = {
  critical: { label: 'Critical', bg: 'bg-red-100 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', icon: AlertTriangle },
  error:    { label: 'Error',    bg: 'bg-orange-100 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-400', icon: AlertTriangle },
  warning:  { label: 'Warning',  bg: 'bg-yellow-100 dark:bg-yellow-950/30', text: 'text-yellow-700 dark:text-yellow-400', icon: Zap },
  info:     { label: 'Info',     bg: 'bg-blue-100 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-400', icon: Info },
}

export default async function OpsErrorsPage() {
  const access = await resolveOperatorAccess()
  if (!access.authorized) redirect('/login')

  const errors = await getWorkflowErrors(100)

  return (
    <div className="min-h-screen bg-[var(--brand-bg)]">
      {/* Header */}
      <header className="sticky top-0 z-30 h-14 flex items-center border-b border-[var(--brand-border)]/50 bg-[var(--brand-bg)]/80 backdrop-blur-xl px-4 sm:px-6">
        <div className="max-w-5xl mx-auto w-full flex items-center gap-4">
          <Link
            href="/ops"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--brand-border)] text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-base font-semibold text-[var(--brand-text)]">Errors Console</h1>
            <p className="text-xs text-[var(--brand-muted)]">Cross-tenant n8n workflow errors</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['critical', 'error', 'warning', 'info'] as WorkflowErrorSeverity[]).map((sev) => {
            const count = errors.filter((e) => e.errorPayload?.severity === sev).length
            const cfg = SEVERITY_CONFIG[sev]
            const Icon = cfg.icon
            return (
              <Card key={sev}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cfg.bg}`}>
                    <Icon className={`h-4 w-4 ${cfg.text}`} />
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-[var(--brand-text)] tabular-nums">{count}</p>
                    <p className="text-[10px] text-[var(--brand-muted)]">{cfg.label}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Errors table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Errors</CardTitle>
            <CardDescription>
              Last {errors.length} workflow errors ingested via n8n
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {errors.length === 0 ? (
              <div className={polish.emptyState}>
                <div className={polish.emptyIcon}>
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 opacity-70" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--brand-text)]">No errors recorded</p>
                  <p className="text-xs text-[var(--brand-muted)] mt-0.5">
                    POST to <code className="font-mono text-[10px]">/api/ops/errors/ingest</code> to record workflow errors.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[var(--brand-border)]">
                {errors.map((e) => {
                  const payload = e.errorPayload
                  const severity = payload?.severity ?? 'error'
                  const cfg = SEVERITY_CONFIG[severity]
                  const Icon = cfg.icon
                  const timeAgo = (() => {
                    try { return formatDistanceToNow(parseISO(e.createdAt), { addSuffix: true }) }
                    catch { return '—' }
                  })()

                  return (
                    <div key={e.id} className="px-5 py-3 hover:bg-[var(--brand-bg)]/50 transition-colors">
                      <div className="flex items-start gap-3">
                        {/* Severity badge */}
                        <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${cfg.bg} ${cfg.text}`}>
                          <Icon className="h-2.5 w-2.5" />
                          {cfg.label}
                        </span>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <p className="text-xs font-medium text-[var(--brand-text)] truncate">
                              {payload?.workflow ?? 'Unknown workflow'}
                            </p>
                            {payload?.tenantSlug && (
                              <span className="text-[10px] text-[var(--brand-muted)] font-mono shrink-0">
                                {payload.tenantSlug}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--brand-muted)] mt-0.5 line-clamp-2">
                            {payload?.errorMessage ?? e.title}
                          </p>
                        </div>

                        {/* Time */}
                        <p className="text-[10px] text-[var(--brand-muted)] shrink-0 whitespace-nowrap">{timeAgo}</p>
                      </div>

                      {/* Stack trace (collapsed) */}
                      {payload?.stack && (
                        <details className="mt-2 ml-14">
                          <summary className="text-[10px] text-[var(--brand-muted)] cursor-pointer hover:text-[var(--brand-text)] select-none">
                            View stack trace
                          </summary>
                          <pre className="mt-1.5 text-[9px] text-[var(--brand-muted)] bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all">
                            {payload.stack}
                          </pre>
                        </details>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
