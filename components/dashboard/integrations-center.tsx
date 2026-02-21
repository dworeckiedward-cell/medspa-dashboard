'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import {
  CheckCircle2,
  XCircle,
  Zap,
  ExternalLink,
  Construction,
  Webhook,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { Integration, CrmDeliveryLog } from '@/lib/types/domain'
import type { Client } from '@/types/database'

// ── Props ─────────────────────────────────────────────────────────────────────

interface IntegrationsCenterProps {
  integrations: Integration[]
  deliveryLogs: CrmDeliveryLog[]
  tenant: Client
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  custom_webhook: 'Custom Webhook',
  hubspot: 'HubSpot',
  ghl: 'GoHighLevel',
  pipedrive: 'Pipedrive',
}

const ERROR_CODE_LABELS: Record<string, string> = {
  NOT_CONFIGURED:  'Not configured',
  NOT_IMPLEMENTED: 'Not implemented',
  TIMEOUT:         'Timeout',
  NETWORK_ERROR:   'Network error',
  HTTP_ERROR:      'HTTP error',
  UNKNOWN_ERROR:   'Unknown error',
}

const TEST_EVENT_TYPES = [
  { value: 'call.completed',    label: 'Call Completed' },
  { value: 'summary.created',   label: 'Summary Created' },
  { value: 'followup.required', label: 'Follow-up Required' },
  { value: 'booking.created',   label: 'Booking Created' },
  { value: 'lead.created',      label: 'Lead Created' },
] as const

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastState {
  type: 'success' | 'error' | 'info'
  message: string
}

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4_000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg text-sm font-medium',
        'animate-in slide-in-from-bottom-4 duration-300',
        toast.type === 'success' && 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950 dark:text-emerald-200',
        toast.type === 'error' && 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950 dark:text-rose-200',
        toast.type === 'info' && 'border-[var(--brand-border)] bg-[var(--brand-surface)] text-[var(--brand-text)]',
      )}
    >
      {toast.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
      {toast.type === 'error' && <XCircle className="h-4 w-4 shrink-0 text-rose-500" />}
      {toast.type === 'info' && <Info className="h-4 w-4 shrink-0 text-[var(--brand-muted)]" />}
      <span>{toast.message}</span>
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ success }: { success: boolean }) {
  return success ? (
    <Badge variant="success" className="text-[10px] gap-1">
      <CheckCircle2 className="h-2.5 w-2.5" />
      Success
    </Badge>
  ) : (
    <Badge variant="destructive" className="text-[10px] gap-1">
      <XCircle className="h-2.5 w-2.5" />
      Failed
    </Badge>
  )
}

// ── Log table row ─────────────────────────────────────────────────────────────

function LogRow({ log, onSelect }: { log: CrmDeliveryLog; onSelect: (log: CrmDeliveryLog) => void }) {
  return (
    <tr
      className="border-b border-[var(--brand-border)] hover:bg-[var(--brand-bg)]/50 cursor-pointer transition-colors"
      onClick={() => onSelect(log)}
    >
      <td className="px-3 py-2.5 text-[10px] text-[var(--brand-muted)] tabular-nums whitespace-nowrap">
        {format(parseISO(log.createdAt), 'MMM d, h:mm:ss a')}
      </td>
      <td className="px-3 py-2.5">
        <span className="text-xs font-medium text-[var(--brand-text)]">
          {PROVIDER_LABELS[log.integrationProvider] ?? log.integrationProvider}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <code className="text-[10px] bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded px-1.5 py-0.5 text-[var(--brand-muted)] font-mono">
          {log.eventType}
        </code>
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge success={log.success} />
      </td>
      <td className="px-3 py-2.5 text-[10px] tabular-nums text-[var(--brand-muted)]">
        {log.responseStatus ?? '—'}
      </td>
      <td className="px-3 py-2.5 text-[10px] tabular-nums text-[var(--brand-muted)] whitespace-nowrap">
        {log.latencyMs != null ? `${log.latencyMs}ms` : '—'}
      </td>
      <td className="px-3 py-2.5 max-w-[180px]">
        {log.errorCode ? (
          <span className="text-[10px] text-rose-500 truncate block">
            {ERROR_CODE_LABELS[log.errorCode] ?? log.errorCode}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2.5">
        <ChevronRight className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
      </td>
    </tr>
  )
}

// ── Log detail sheet ──────────────────────────────────────────────────────────

function LogDetailSheet({ log, onClose }: { log: CrmDeliveryLog | null; onClose: () => void }) {
  return (
    <Sheet open={log !== null} onClose={onClose} title="Delivery Log Detail" size="lg">
      <SheetContent>
        {log && (
          <div className="space-y-5">
            {/* Summary row */}
            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge success={log.success} />
              <code className="text-[10px] bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded px-1.5 py-0.5 text-[var(--brand-muted)] font-mono">
                {log.eventType}
              </code>
              <span className="text-xs text-[var(--brand-muted)]">
                {PROVIDER_LABELS[log.integrationProvider] ?? log.integrationProvider}
              </span>
              {log.latencyMs != null && (
                <span className="text-xs text-[var(--brand-muted)]">{log.latencyMs}ms</span>
              )}
            </div>

            {/* Timestamp */}
            <div>
              <p className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-1">Timestamp</p>
              <p className="text-xs text-[var(--brand-text)] font-mono">
                {format(parseISO(log.createdAt), "yyyy-MM-dd HH:mm:ss 'UTC'")}
              </p>
            </div>

            {/* Request URL */}
            {log.requestUrl && (
              <div>
                <p className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-1">Request URL</p>
                <p className="text-xs text-[var(--brand-text)] font-mono break-all">{log.requestUrl}</p>
              </div>
            )}

            {/* HTTP Status */}
            {log.responseStatus != null && (
              <div>
                <p className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-1">HTTP Status</p>
                <p className={cn(
                  'text-xs font-mono font-semibold',
                  log.responseStatus >= 200 && log.responseStatus < 300 ? 'text-emerald-500' : 'text-rose-500',
                )}>
                  {log.responseStatus}
                </p>
              </div>
            )}

            {/* Error */}
            {(log.errorCode || log.errorMessage) && (
              <div className="rounded-lg border border-rose-300 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30 p-3 space-y-1">
                {log.errorCode && (
                  <p className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider">
                    {ERROR_CODE_LABELS[log.errorCode] ?? log.errorCode}
                  </p>
                )}
                {log.errorMessage && (
                  <p className="text-xs text-rose-700 dark:text-rose-400 font-mono break-all">{log.errorMessage}</p>
                )}
              </div>
            )}

            {/* Masked headers */}
            {log.requestHeadersMasked && Object.keys(log.requestHeadersMasked).length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-1">
                  Request Headers (masked)
                </p>
                <pre className="text-[10px] font-mono text-[var(--brand-muted)] bg-[var(--brand-bg)] rounded-lg border border-[var(--brand-border)] p-3 overflow-auto max-h-40">
                  {JSON.stringify(log.requestHeadersMasked, null, 2)}
                </pre>
              </div>
            )}

            {/* Payload */}
            <div>
              <p className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-1">Payload</p>
              <pre className="text-[10px] font-mono text-[var(--brand-text)] bg-[var(--brand-bg)] rounded-lg border border-[var(--brand-border)] p-3 overflow-auto max-h-72">
                {JSON.stringify(log.payload, null, 2)}
              </pre>
            </div>

            {/* Response preview */}
            {log.responseBodyPreview && (
              <div>
                <p className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-1">Response Preview</p>
                <pre className="text-[10px] font-mono text-[var(--brand-muted)] bg-[var(--brand-bg)] rounded-lg border border-[var(--brand-border)] p-3 overflow-auto max-h-40">
                  {log.responseBodyPreview}
                </pre>
              </div>
            )}

            {/* Log ID */}
            <div>
              <p className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-1">Log ID</p>
              <p className="text-[10px] text-[var(--brand-muted)] font-mono">{log.id}</p>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── Send test event dialog ────────────────────────────────────────────────────

interface TestDeliveryResult {
  success: boolean
  latencyMs: number
  responseStatus: number | null
  errorCode: string | null
  errorMessage: string | null
  logId: string | null
}

interface TestEventDialogProps {
  open: boolean
  tenantSlug: string
  onClose: () => void
  onSuccess: (result: TestDeliveryResult) => void
}

function TestEventDialog({ open, tenantSlug, onClose, onSuccess }: TestEventDialogProps) {
  const [provider, setProvider] = useState('custom_webhook')
  const [eventType, setEventType] = useState<string>('call.completed')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastResult, setLastResult] = useState<TestDeliveryResult | null>(null)

  async function handleSend() {
    setLoading(true)
    setLastResult(null)
    try {
      const body: Record<string, unknown> = { tenantSlug, provider, eventType }
      if (webhookUrl.trim()) {
        body.providerConfig = { webhookUrl: webhookUrl.trim() }
      }
      const res = await fetch('/api/dev/crm/test-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as TestDeliveryResult & { error?: string }
      const result: TestDeliveryResult = {
        success: data.success ?? false,
        latencyMs: data.latencyMs ?? 0,
        responseStatus: data.responseStatus ?? null,
        errorCode: data.errorCode ?? null,
        errorMessage: data.errorMessage ?? (typeof data.error === 'string' ? data.error : null),
        logId: data.logId ?? null,
      }
      setLastResult(result)
      if (result.success) onSuccess(result)
    } catch (err) {
      setLastResult({
        success: false, latencyMs: 0, responseStatus: null,
        errorCode: 'NETWORK_ERROR',
        errorMessage: err instanceof Error ? err.message : 'Network error',
        logId: null,
      })
    } finally {
      setLoading(false)
    }
  }

  function handleClose() { setLastResult(null); onClose() }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Test Event</DialogTitle>
          <DialogDescription>
            Fire a synthetic CRM event to verify your integration end-to-end.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Provider */}
          <div>
            <label className="block text-xs font-medium text-[var(--brand-muted)] mb-1.5">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] text-xs text-[var(--brand-text)] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            >
              <option value="custom_webhook">Custom Webhook</option>
              <option value="hubspot">HubSpot (stub)</option>
              <option value="ghl">GoHighLevel (stub)</option>
            </select>
          </div>

          {/* Event type */}
          <div>
            <label className="block text-xs font-medium text-[var(--brand-muted)] mb-1.5">Event Type</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] text-xs text-[var(--brand-text)] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            >
              {TEST_EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Webhook URL override */}
          <div>
            <label className="block text-xs font-medium text-[var(--brand-muted)] mb-1.5">
              Webhook URL <span className="opacity-60">(optional override)</span>
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.example.com/crm"
              className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] text-xs text-[var(--brand-text)] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] placeholder:text-[var(--brand-muted)] placeholder:opacity-50 font-mono"
            />
            <p className="text-[10px] text-[var(--brand-muted)] opacity-60 mt-1">
              Leave empty to use CRM_TEST_WEBHOOK_URL env var.
            </p>
          </div>

          {/* Result */}
          {lastResult && (
            <div className={cn(
              'rounded-lg border p-3 space-y-1.5',
              lastResult.success
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30'
                : 'border-rose-300 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30',
            )}>
              <div className="flex items-center gap-2">
                {lastResult.success
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  : <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                <span className={cn('text-xs font-semibold', lastResult.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300')}>
                  {lastResult.success ? 'Delivered successfully' : 'Delivery failed'}
                </span>
                {lastResult.latencyMs > 0 && (
                  <span className="text-[10px] text-[var(--brand-muted)] ml-auto">{lastResult.latencyMs}ms</span>
                )}
              </div>
              {lastResult.responseStatus != null && (
                <p className="text-[10px] text-[var(--brand-muted)] font-mono">HTTP {lastResult.responseStatus}</p>
              )}
              {lastResult.errorCode && (
                <p className="text-[10px] text-rose-600 dark:text-rose-400">
                  {ERROR_CODE_LABELS[lastResult.errorCode] ?? lastResult.errorCode}
                  {lastResult.errorMessage && ` — ${lastResult.errorMessage.slice(0, 80)}`}
                </p>
              )}
              {lastResult.logId && (
                <p className="text-[10px] text-[var(--brand-muted)] font-mono">Log: {lastResult.logId}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={loading}
            className="min-w-[100px]"
            style={{ background: 'var(--user-accent)', color: 'white' }}
          >
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Zap className="h-3.5 w-3.5 mr-1.5" />}
            {loading ? 'Sending…' : 'Send Event'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Delivery logs section ─────────────────────────────────────────────────────

type FilterStatus = 'all' | 'success' | 'failed'
type FilterProvider = 'all' | 'custom_webhook' | 'hubspot' | 'ghl' | 'pipedrive'

function DeliveryLogsSection({
  initialLogs,
  tenantSlug,
}: {
  initialLogs: CrmDeliveryLog[]
  tenantSlug: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterProvider, setFilterProvider] = useState<FilterProvider>('all')
  const [filterEvent, setFilterEvent] = useState('')
  const [selectedLog, setSelectedLog] = useState<CrmDeliveryLog | null>(null)
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  const dismissToast = useCallback(() => setToast(null), [])

  const filtered = initialLogs.filter((log) => {
    if (filterStatus === 'success' && !log.success) return false
    if (filterStatus === 'failed' && log.success) return false
    if (filterProvider !== 'all' && log.integrationProvider !== filterProvider) return false
    if (filterEvent && !log.eventType.includes(filterEvent.toLowerCase())) return false
    return true
  })

  function handleTestSuccess(result: TestDeliveryResult) {
    setTestDialogOpen(false)
    setToast({ type: 'success', message: `Delivered in ${result.latencyMs}ms — log written` })
    startTransition(() => router.refresh())
  }

  const totalCount = initialLogs.length
  const successCount = initialLogs.filter((l) => l.success).length
  const failedCount = totalCount - successCount
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : null

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-[var(--brand-text)]">Delivery Logs</h2>
          <p className="text-xs text-[var(--brand-muted)] mt-0.5">Real-time record of every CRM event delivery attempt.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm" variant="ghost"
            className="h-8 text-xs border border-[var(--brand-border)]"
            onClick={() => startTransition(() => router.refresh())}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
          </Button>
          <Button
            size="sm" className="h-8 text-xs"
            style={{ background: 'var(--user-accent)', color: 'white' }}
            onClick={() => setTestDialogOpen(true)}
          >
            <Zap className="h-3.5 w-3.5 mr-1.5" />Send Test Event
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      {totalCount > 0 && (
        <div className="flex items-center gap-4 text-xs text-[var(--brand-muted)]">
          <span>{totalCount} total</span>
          <span className="text-emerald-500">{successCount} succeeded</span>
          {failedCount > 0 && (
            <span className="text-rose-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />{failedCount} failed
            </span>
          )}
          {successRate !== null && (
            <span className="ml-auto">
              Success rate:{' '}
              <span className={successRate >= 90 ? 'text-emerald-500' : successRate >= 70 ? 'text-amber-500' : 'text-rose-500'}>
                {successRate}%
              </span>
            </span>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg border border-[var(--brand-border)] overflow-hidden text-xs">
          {(['all', 'success', 'failed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                'px-3 py-1.5 font-medium transition-colors',
                filterStatus === s
                  ? 'bg-[var(--user-accent-soft)] text-[var(--user-accent)]'
                  : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-bg)]',
              )}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <select
          value={filterProvider}
          onChange={(e) => setFilterProvider(e.target.value as FilterProvider)}
          className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] text-xs text-[var(--brand-text)] px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
        >
          <option value="all">All Providers</option>
          <option value="custom_webhook">Custom Webhook</option>
          <option value="hubspot">HubSpot</option>
          <option value="ghl">GoHighLevel</option>
        </select>

        <input
          type="text"
          value={filterEvent}
          onChange={(e) => setFilterEvent(e.target.value)}
          placeholder="Filter by event…"
          className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] text-xs text-[var(--brand-text)] px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] placeholder:text-[var(--brand-muted)] placeholder:opacity-50 w-40"
        />
      </div>

      {/* Table or empty state */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--brand-border)] py-14 text-center">
          {initialLogs.length === 0 ? (
            <>
              <Webhook className="h-8 w-8 text-[var(--brand-muted)] opacity-30 mx-auto mb-3" />
              <p className="text-sm font-medium text-[var(--brand-muted)]">No delivery logs yet</p>
              <p className="text-xs text-[var(--brand-muted)] opacity-60 mt-1 mb-4">
                Send a test event to verify your integration end-to-end.
              </p>
              <Button
                size="sm" className="h-8 text-xs"
                style={{ background: 'var(--user-accent)', color: 'white' }}
                onClick={() => setTestDialogOpen(true)}
              >
                <Zap className="h-3.5 w-3.5 mr-1.5" />Send Test Event
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-[var(--brand-muted)]">No results match filters</p>
              <button
                onClick={() => { setFilterStatus('all'); setFilterProvider('all'); setFilterEvent('') }}
                className="text-xs text-[var(--brand-primary)] mt-2 hover:underline"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--brand-border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--brand-border)] bg-[var(--brand-bg)]/50">
                  {['Time', 'Provider', 'Event', 'Status', 'HTTP', 'Latency', 'Error', ''].map((h) => (
                    <th key={h} className="px-3 py-2 text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <LogRow key={log.id} log={log} onSelect={setSelectedLog} />
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length < totalCount && (
            <p className="px-3 py-2 text-[10px] text-[var(--brand-muted)] border-t border-[var(--brand-border)]">
              Showing {filtered.length} of {totalCount} (filters applied)
            </p>
          )}
        </div>
      )}

      {/* Detail sheet */}
      <LogDetailSheet log={selectedLog} onClose={() => setSelectedLog(null)} />

      {/* Test dialog */}
      <TestEventDialog
        open={testDialogOpen}
        tenantSlug={tenantSlug}
        onClose={() => setTestDialogOpen(false)}
        onSuccess={handleTestSuccess}
      />

      {/* Toast */}
      {toast && <Toast toast={toast} onDismiss={dismissToast} />}
    </>
  )
}

// ── Coming soon provider card ─────────────────────────────────────────────────

function ComingSoonCard({ name, logoText, logoColor, description }: {
  name: string; logoText: string; logoColor: string; description: string
}) {
  return (
    <Card className="relative overflow-hidden opacity-75">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{ background: `radial-gradient(ellipse at top left, ${logoColor}, transparent 70%)` }}
      />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white text-xs font-bold"
              style={{ background: logoColor }}
            >
              {logoText}
            </div>
            <div>
              <CardTitle className="text-base">{name}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Construction className="h-3.5 w-3.5 text-[var(--brand-muted)] opacity-50" />
            <Badge variant="muted" className="text-xs">Coming soon</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button variant="ghost" className="h-8 text-xs w-full border border-[var(--brand-border)] opacity-50" disabled>
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Connect
        </Button>
      </CardContent>
    </Card>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function IntegrationsCenter({ integrations, deliveryLogs, tenant }: IntegrationsCenterProps) {
  const customWebhook = integrations.find((i) => i.provider === 'custom_webhook') ?? null
  const webhookUrl = (customWebhook?.configJson as Record<string, unknown> | null)
    ?.webhookUrl as string | undefined
  const isConnected = customWebhook?.status === 'active' && !!webhookUrl

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-[var(--brand-text)]">Integrations</h1>
        <p className="text-sm text-[var(--brand-muted)] mt-1">
          CRM delivery status, webhook health, and sync activity.
        </p>
      </div>

      {/* Webhook status card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary)]/10">
                <Webhook className="h-5 w-5 text-[var(--brand-primary)]" />
              </div>
              <div>
                <CardTitle className="text-base">Custom Webhook</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Receive CRM events at your own endpoint on every AI action.
                </CardDescription>
              </div>
            </div>
            <Badge variant={isConnected ? 'success' : 'muted'} className="shrink-0 text-xs">
              {isConnected ? 'Connected' : 'Not configured'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {webhookUrl ? (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)]/50 px-3 py-2">
              <code className="flex-1 text-xs text-[var(--brand-text)] truncate font-mono">{webhookUrl}</code>
            </div>
          ) : (
            <p className="text-xs text-[var(--brand-muted)] opacity-60">
              No webhook URL configured. Use the test dialog to send to a custom URL.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Delivery logs */}
      <div className="space-y-4">
        <DeliveryLogsSection initialLogs={deliveryLogs} tenantSlug={tenant.slug} />
      </div>

      {/* Coming soon */}
      <div>
        <p className="text-xs font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-3">
          Coming soon
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ComingSoonCard
            name="HubSpot" logoText="HS" logoColor="#FF7A59"
            description="Sync contacts, deals and notes to HubSpot CRM automatically."
          />
          <ComingSoonCard
            name="GoHighLevel" logoText="GHL" logoColor="#2196F3"
            description="Push leads, calls and bookings to your GHL pipeline."
          />
          <ComingSoonCard
            name="Pipedrive" logoText="PD" logoColor="#1A1A2E"
            description="Create deals and activities in Pipedrive from every call."
          />
        </div>
      </div>
    </div>
  )
}
