'use client'

import { useState, useEffect, useCallback, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO, subHours, subDays } from 'date-fns'
import {
  CheckCircle2,
  XCircle,
  Zap,
  Webhook,
  Globe,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Info,
  Plus,
  Settings2,
  Trash2,
  Power,
  PowerOff,
  Loader2,
  Copy,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { ClientIntegration, CrmDeliveryLog, IntegrationProvider, IntegrationHealthSummary } from '@/lib/types/domain'
import type { Client } from '@/types/database'
import { deriveIntegrationHealth, getHealthBadgeConfig } from '@/lib/integrations/crm/health'
import { IntegrationConfigDialog } from './integration-config-dialog'
import { IntegrationEventToggles } from './integration-event-toggles'
import { IntegrationsHealthCard } from './integrations-health-card'

// ── Props ─────────────────────────────────────────────────────────────────────

interface IntegrationsCenterProps {
  integrations: ClientIntegration[]
  deliveryLogs: CrmDeliveryLog[]
  healthSummary: IntegrationHealthSummary
  tenant: Client
}

// ── Constants ────────────────────────────────────────────────────────────────

const PROVIDER_META: Record<string, { label: string; icon: typeof Webhook; color: string; description: string; comingSoon?: boolean }> = {
  custom_webhook: { label: 'Custom Webhook', icon: Webhook, color: 'var(--brand-primary)', description: 'Send events to your own endpoint.' },
  hubspot:        { label: 'HubSpot', icon: Globe, color: '#FF7A59', description: 'Sync to HubSpot CRM.' },
  ghl:            { label: 'GoHighLevel', icon: Globe, color: '#2196F3', description: 'Push to GHL pipeline.' },
  pipedrive:      { label: 'Pipedrive', icon: Globe, color: '#1A1A2E', description: 'Create deals in Pipedrive.', comingSoon: true },
  mindbody:       { label: 'Mindbody', icon: Sparkles, color: '#00B4D8', description: 'Sync with Mindbody booking.', comingSoon: true },
  zenoti:         { label: 'Zenoti', icon: Sparkles, color: '#6C63FF', description: 'Push to Zenoti platform.', comingSoon: true },
  boulevard:      { label: 'Boulevard', icon: Sparkles, color: '#1E293B', description: 'Sync with Boulevard CRM.', comingSoon: true },
  jane_app:       { label: 'Jane App', icon: Sparkles, color: '#10B981', description: 'Connect to Jane scheduling.', comingSoon: true },
  vagaro:         { label: 'Vagaro', icon: Sparkles, color: '#7C3AED', description: 'Sync with Vagaro platform.', comingSoon: true },
  aesthetic_record: { label: 'Aesthetic Record', icon: Sparkles, color: '#EC4899', description: 'Push to Aesthetic Record.', comingSoon: true },
}

const ERROR_CODE_LABELS: Record<string, string> = {
  NOT_CONFIGURED:       'Not configured',
  NOT_IMPLEMENTED:      'Not implemented',
  TIMEOUT:              'Timeout',
  NETWORK_ERROR:        'Network error',
  HTTP_ERROR:           'HTTP error',
  SKIPPED_DISABLED:     'Skipped (disabled)',
  SKIPPED_NOT_CONNECTED:'Skipped (disconnected)',
  VALIDATION_ERROR:     'Validation error',
  UNKNOWN_ERROR:        'Unknown error',
}

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastState { type: 'success' | 'error' | 'info'; message: string }

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4_000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg text-sm font-medium',
      'animate-in slide-in-from-bottom-4 duration-300',
      toast.type === 'success' && 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950 dark:text-emerald-200',
      toast.type === 'error' && 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950 dark:text-rose-200',
      toast.type === 'info' && 'border-[var(--brand-border)] bg-[var(--brand-surface)] text-[var(--brand-text)]',
    )}>
      {toast.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
      {toast.type === 'error' && <XCircle className="h-4 w-4 shrink-0 text-rose-500" />}
      {toast.type === 'info' && <Info className="h-4 w-4 shrink-0 text-[var(--brand-muted)]" />}
      <span>{toast.message}</span>
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

function IntegrationStatusBadge({ integration, logs }: { integration: ClientIntegration; logs: CrmDeliveryLog[] }) {
  const healthLevel = deriveIntegrationHealth(integration, logs)
  const { label, variant } = getHealthBadgeConfig(healthLevel)
  return <Badge variant={variant}>{label}</Badge>
}

// ── Provider connection card ─────────────────────────────────────────────────

function ProviderCard({
  integration,
  logs,
  onConfigure,
  onTest,
  onToggleEnabled,
  onDelete,
  onSelectEvents,
  busy,
}: {
  integration: ClientIntegration
  logs: CrmDeliveryLog[]
  onConfigure: () => void
  onTest: () => void
  onToggleEnabled: () => void
  onDelete: () => void
  onSelectEvents: () => void
  busy: boolean
}) {
  const meta = PROVIDER_META[integration.provider] ?? PROVIDER_META.custom_webhook
  const Icon = meta.icon

  return (
    <Card className="relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{ background: `radial-gradient(ellipse at top left, ${meta.color}, transparent 70%)` }}
      />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ background: meta.color + '18' }}
            >
              <Icon className="h-5 w-5" style={{ color: meta.color }} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{integration.name}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {meta.description}
                {!integration.isEnabled && <span className="text-amber-500 ml-1">(disabled)</span>}
              </CardDescription>
            </div>
          </div>
          <IntegrationStatusBadge integration={integration} logs={logs} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Timestamps */}
        <div className="flex items-center gap-4 text-[10px] text-[var(--brand-muted)] flex-wrap">
          {integration.lastSuccessAt && (
            <span>Last success: {format(parseISO(integration.lastSuccessAt), 'MMM d, h:mm a')}</span>
          )}
          {integration.lastErrorAt && (
            <span className="text-rose-500">Last error: {format(parseISO(integration.lastErrorAt), 'MMM d, h:mm a')}</span>
          )}
          {integration.lastTestAt && (
            <span>Tested: {format(parseISO(integration.lastTestAt), 'MMM d, h:mm a')}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onConfigure} disabled={busy}>
            <Settings2 className="h-3 w-3 mr-1.5" />Configure
          </Button>
          <Button
            size="sm" className="h-7 text-xs"
            style={{ background: 'var(--user-accent)', color: 'white' }}
            onClick={onTest}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Zap className="h-3 w-3 mr-1.5" />}
            Test
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onSelectEvents} disabled={busy}>
            <Zap className="h-3 w-3 mr-1.5" />Events
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost" size="sm" className="h-7 text-xs"
            onClick={onToggleEnabled}
            disabled={busy}
            title={integration.isEnabled ? 'Disable integration' : 'Enable integration'}
          >
            {integration.isEnabled
              ? <PowerOff className="h-3 w-3 text-amber-500" />
              : <Power className="h-3 w-3 text-emerald-500" />}
          </Button>
          <Button
            variant="ghost" size="sm" className="h-7 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            onClick={onDelete}
            disabled={busy}
            title="Delete integration"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Add integration CTA ─────────────────────────────────────────────────────

const ACTIVE_PROVIDERS: IntegrationProvider[] = ['custom_webhook', 'hubspot', 'ghl']
const COMING_SOON_PROVIDERS = ['mindbody', 'zenoti', 'boulevard', 'jane_app', 'vagaro', 'aesthetic_record'] as const

function AddIntegrationCards({ onAdd }: { onAdd: (provider: IntegrationProvider) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ACTIVE_PROVIDERS.map((p) => {
          const meta = PROVIDER_META[p]
          const Icon = meta.icon
          return (
            <button
              key={p}
              onClick={() => onAdd(p)}
              className={cn(
                'group flex items-center gap-3 rounded-xl border-2 border-dashed border-[var(--brand-border)]',
                'px-4 py-3 text-left transition-all duration-150',
                'hover:border-[var(--brand-primary)]/40 hover:bg-[var(--brand-primary)]/5',
              )}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg opacity-60 group-hover:opacity-100 transition-opacity"
                style={{ background: meta.color + '18' }}
              >
                <Icon className="h-4 w-4" style={{ color: meta.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--brand-text)]">{meta.label}</p>
                <p className="text-[10px] text-[var(--brand-muted)]">
                  {p === 'custom_webhook' ? 'Add endpoint' : 'Connect'}
                </p>
              </div>
              <Plus className="h-4 w-4 text-[var(--brand-muted)] group-hover:text-[var(--brand-primary)] ml-auto shrink-0 transition-colors" />
            </button>
          )
        })}
      </div>

      {/* MedSpa connector presets — coming soon */}
      <div className="rounded-xl border border-[var(--brand-border)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[var(--brand-text)] flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[var(--brand-accent)]" />
              MedSpa Software Connectors
            </p>
            <p className="text-[10px] text-[var(--brand-muted)] mt-0.5">
              Native integrations on the roadmap. Use Custom Webhook in the meantime.
            </p>
          </div>
          <a
            href="mailto:support@servify.ai?subject=Native%20Connector%20Request"
            className="shrink-0 text-[10px] font-medium text-[var(--brand-primary)] hover:underline"
          >
            Request connector
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {COMING_SOON_PROVIDERS.map((p) => {
            const meta = PROVIDER_META[p]
            const Icon = meta.icon
            return (
              <div
                key={p}
                className="flex items-center gap-3 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)]/50 px-3 py-2.5"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: meta.color + '18' }}
                >
                  <Icon className="h-4 w-4" style={{ color: meta.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-[var(--brand-text)] truncate">{meta.label}</p>
                  <p className="text-[9px] text-[var(--brand-muted)]">{meta.description}</p>
                </div>
                <Badge variant="muted" className="text-[8px] shrink-0">Soon</Badge>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--brand-muted)]">
          <Info className="h-3 w-3 shrink-0" />
          All MedSpa connectors can be approximated today via Custom Webhook with your booking system&apos;s API.
        </div>
      </div>
    </div>
  )
}

// ── Log row ──────────────────────────────────────────────────────────────────

function LogRow({ log, onSelect, onRetry, retrying }: {
  log: CrmDeliveryLog
  onSelect: (log: CrmDeliveryLog) => void
  onRetry: (log: CrmDeliveryLog) => void
  retrying: boolean
}) {
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
          {PROVIDER_META[log.integrationProvider]?.label ?? log.integrationProvider}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <code className="text-[10px] bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded px-1.5 py-0.5 text-[var(--brand-muted)] font-mono">
          {log.eventType}
        </code>
      </td>
      <td className="px-3 py-2.5">
        {log.success ? (
          <Badge variant="success" className="text-[10px] gap-1">
            <CheckCircle2 className="h-2.5 w-2.5" />Success
          </Badge>
        ) : (
          <Badge variant="destructive" className="text-[10px] gap-1">
            <XCircle className="h-2.5 w-2.5" />Failed
          </Badge>
        )}
      </td>
      <td className="px-3 py-2.5 text-[10px] tabular-nums text-[var(--brand-muted)]">
        {log.responseStatus ?? '—'}
      </td>
      <td className="px-3 py-2.5 text-[10px] tabular-nums text-[var(--brand-muted)] whitespace-nowrap">
        {log.latencyMs != null ? `${log.latencyMs}ms` : '—'}
      </td>
      <td className="px-3 py-2.5 max-w-[140px]">
        {log.errorCode && (
          <span className="text-[10px] text-rose-500 truncate block">
            {ERROR_CODE_LABELS[log.errorCode] ?? log.errorCode}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          {!log.success && log.integrationProvider === 'custom_webhook' && (
            <button
              onClick={(e) => { e.stopPropagation(); onRetry(log) }}
              disabled={retrying}
              className="p-1 rounded hover:bg-[var(--brand-border)]/60 text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors disabled:opacity-40"
              title="Retry delivery"
            >
              {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            </button>
          )}
          <ChevronRight className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
        </div>
      </td>
    </tr>
  )
}

// ── Log detail sheet ─────────────────────────────────────────────────────────

function LogDetailSheet({ log, onClose }: { log: CrmDeliveryLog | null; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null)

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  return (
    <Sheet open={log !== null} onClose={onClose} title="Delivery Log Detail" size="lg">
      <SheetContent>
        {log && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 flex-wrap">
              {log.success ? (
                <Badge variant="success" className="text-[10px] gap-1"><CheckCircle2 className="h-2.5 w-2.5" />Success</Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px] gap-1"><XCircle className="h-2.5 w-2.5" />Failed</Badge>
              )}
              <code className="text-[10px] bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded px-1.5 py-0.5 text-[var(--brand-muted)] font-mono">
                {log.eventType}
              </code>
              <span className="text-xs text-[var(--brand-muted)]">
                {PROVIDER_META[log.integrationProvider]?.label ?? log.integrationProvider}
              </span>
              {log.latencyMs != null && (
                <span className="text-xs text-[var(--brand-muted)]">{log.latencyMs}ms</span>
              )}
            </div>

            <div>
              <p className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-1">Timestamp</p>
              <p className="text-xs text-[var(--brand-text)] font-mono">
                {format(parseISO(log.createdAt), "yyyy-MM-dd HH:mm:ss 'UTC'")}
              </p>
            </div>

            {log.requestUrl && (
              <div>
                <p className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-1">Request URL</p>
                <p className="text-xs text-[var(--brand-text)] font-mono break-all">{log.requestUrl}</p>
              </div>
            )}

            {log.responseStatus != null && (
              <div>
                <p className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-1">HTTP Status</p>
                <p className={cn(
                  'text-xs font-mono font-semibold',
                  log.responseStatus >= 200 && log.responseStatus < 300 ? 'text-emerald-500' : 'text-rose-500',
                )}>{log.responseStatus}</p>
              </div>
            )}

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

            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider">Payload</p>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(log.payload, null, 2), 'payload')}
                  className="flex items-center gap-1 text-[10px] text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  {copied === 'payload' ? 'Copied!' : 'Copy JSON'}
                </button>
              </div>
              <pre className="text-[10px] font-mono text-[var(--brand-text)] bg-[var(--brand-bg)] rounded-lg border border-[var(--brand-border)] p-3 overflow-auto max-h-72">
                {JSON.stringify(log.payload, null, 2)}
              </pre>
            </div>

            {log.responseBodyPreview && (
              <div>
                <p className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-1">Response Preview</p>
                <pre className="text-[10px] font-mono text-[var(--brand-muted)] bg-[var(--brand-bg)] rounded-lg border border-[var(--brand-border)] p-3 overflow-auto max-h-40">
                  {log.responseBodyPreview}
                </pre>
              </div>
            )}

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

// ── Delivery logs section ────────────────────────────────────────────────────

type FilterStatus = 'all' | 'success' | 'failed'
type FilterProvider = 'all' | 'custom_webhook' | 'hubspot' | 'ghl'
type FilterDateRange = 'all' | '24h' | '7d' | '30d'

const DATE_RANGE_LABELS: Record<FilterDateRange, string> = {
  all: 'All time',
  '24h': '24h',
  '7d': '7 days',
  '30d': '30 days',
}

function getDateRangeCutoff(range: FilterDateRange): Date | null {
  const now = new Date()
  switch (range) {
    case '24h': return subHours(now, 24)
    case '7d':  return subDays(now, 7)
    case '30d': return subDays(now, 30)
    default:    return null
  }
}

function DeliveryLogsSection({ initialLogs }: { initialLogs: CrmDeliveryLog[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterProvider, setFilterProvider] = useState<FilterProvider>('all')
  const [filterEvent, setFilterEvent] = useState('')
  const [filterDateRange, setFilterDateRange] = useState<FilterDateRange>('all')
  const [selectedLog, setSelectedLog] = useState<CrmDeliveryLog | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const cutoff = getDateRangeCutoff(filterDateRange)
    return initialLogs.filter((log) => {
      if (filterStatus === 'success' && !log.success) return false
      if (filterStatus === 'failed' && log.success) return false
      if (filterProvider !== 'all' && log.integrationProvider !== filterProvider) return false
      if (filterEvent && !log.eventType.includes(filterEvent.toLowerCase())) return false
      if (cutoff && parseISO(log.createdAt) < cutoff) return false
      return true
    })
  }, [initialLogs, filterStatus, filterProvider, filterEvent, filterDateRange])

  const totalCount = initialLogs.length
  const successCount = initialLogs.filter((l) => l.success).length
  const failedCount = totalCount - successCount

  async function handleRetry(log: CrmDeliveryLog) {
    setRetryingId(log.id)
    try {
      await fetch('/api/dev/crm/retry-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId: log.id }),
      })
      startTransition(() => router.refresh())
    } catch {
      // Silent
    } finally {
      setRetryingId(null)
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-[var(--brand-text)]">Delivery Logs</h2>
          <p className="text-xs text-[var(--brand-muted)] mt-0.5">Real-time record of every CRM event delivery attempt.</p>
        </div>
        <Button
          size="sm" variant="ghost"
          className="h-8 text-xs border border-[var(--brand-border)]"
          onClick={() => startTransition(() => router.refresh())}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
        </Button>
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
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status chips */}
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

        {/* Date range presets */}
        <div className="flex rounded-lg border border-[var(--brand-border)] overflow-hidden text-xs">
          {(['all', '24h', '7d', '30d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilterDateRange(r)}
              className={cn(
                'px-3 py-1.5 font-medium transition-colors',
                filterDateRange === r
                  ? 'bg-[var(--user-accent-soft)] text-[var(--user-accent)]'
                  : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-bg)]',
              )}
            >
              {DATE_RANGE_LABELS[r]}
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
          placeholder="Filter by event..."
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
              <p className="text-xs text-[var(--brand-muted)] opacity-60 mt-1">
                Test an integration to see delivery results here.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-[var(--brand-muted)]">No results match filters</p>
              <button
                onClick={() => { setFilterStatus('all'); setFilterProvider('all'); setFilterEvent(''); setFilterDateRange('all') }}
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
                  <LogRow
                    key={log.id}
                    log={log}
                    onSelect={setSelectedLog}
                    onRetry={handleRetry}
                    retrying={retryingId === log.id}
                  />
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

      <LogDetailSheet log={selectedLog} onClose={() => setSelectedLog(null)} />
    </>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function IntegrationsCenter({ integrations: initialIntegrations, deliveryLogs, healthSummary, tenant }: IntegrationsCenterProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [integrations, setIntegrations] = useState<ClientIntegration[]>(initialIntegrations)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // Dialog state
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [configDialogExisting, setConfigDialogExisting] = useState<ClientIntegration | null>(null)
  const [configDialogProvider, setConfigDialogProvider] = useState<IntegrationProvider>('custom_webhook')

  // Event toggles panel
  const [eventsIntegration, setEventsIntegration] = useState<ClientIntegration | null>(null)

  const dismissToast = useCallback(() => setToast(null), [])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function openAddDialog(provider: IntegrationProvider) {
    setConfigDialogExisting(null)
    setConfigDialogProvider(provider)
    setConfigDialogOpen(true)
  }

  function openEditDialog(integration: ClientIntegration) {
    setConfigDialogExisting(integration)
    setConfigDialogProvider(integration.provider)
    setConfigDialogOpen(true)
  }

  function handleSaved(result: ClientIntegration) {
    if (configDialogExisting) {
      setIntegrations((prev) => prev.map((i) => i.id === result.id ? result : i))
      setToast({ type: 'success', message: 'Integration updated' })
    } else {
      setIntegrations((prev) => [...prev, result])
      setToast({ type: 'success', message: 'Integration added' })
    }
    setConfigDialogOpen(false)
    startTransition(() => router.refresh())
  }

  async function handleTest(integration: ClientIntegration) {
    setBusy(integration.id)
    try {
      const res = await fetch(`/api/integrations/${integration.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'call.completed' }),
      })
      const data = await res.json()
      if (data.success) {
        setToast({ type: 'success', message: `Test delivered in ${data.latencyMs}ms` })
      } else {
        setToast({ type: 'error', message: data.errorMessage ?? 'Test delivery failed' })
      }
      startTransition(() => router.refresh())
    } catch {
      setToast({ type: 'error', message: 'Network error during test' })
    } finally {
      setBusy(null)
    }
  }

  async function handleToggleEnabled(integration: ClientIntegration) {
    setBusy(integration.id)
    try {
      const res = await fetch(`/api/integrations/${integration.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !integration.isEnabled }),
      })
      const json = await res.json()
      if (res.ok && json.integration) {
        setIntegrations((prev) => prev.map((i) => i.id === integration.id ? json.integration : i))
        setToast({
          type: 'info',
          message: `${integration.name} ${integration.isEnabled ? 'disabled' : 'enabled'}`,
        })
      }
    } catch {
      setToast({ type: 'error', message: 'Failed to update integration' })
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete(integration: ClientIntegration) {
    if (!confirm(`Delete "${integration.name}"? Delivery logs will be preserved.`)) return
    setBusy(integration.id)
    try {
      const res = await fetch(`/api/integrations/${integration.id}`, { method: 'DELETE' })
      if (res.ok) {
        setIntegrations((prev) => prev.filter((i) => i.id !== integration.id))
        setToast({ type: 'info', message: `${integration.name} deleted` })
      }
    } catch {
      setToast({ type: 'error', message: 'Failed to delete integration' })
    } finally {
      setBusy(null)
    }
  }

  function handleEventsUpdate(updated: ClientIntegration) {
    setIntegrations((prev) => prev.map((i) => i.id === updated.id ? updated : i))
    setEventsIntegration(updated)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-[var(--brand-text)]">Integrations</h1>
        <p className="text-sm text-[var(--brand-muted)] mt-1">
          CRM connections, event routing, and delivery monitoring.
        </p>
      </div>

      {/* Zone 1: Health summary */}
      <IntegrationsHealthCard health={healthSummary} />

      {/* Zone 2: Provider connections */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--brand-text)]">Connections</h2>
            <p className="text-xs text-[var(--brand-muted)] mt-0.5">
              {integrations.length === 0
                ? 'Add your first integration to start delivering CRM events.'
                : `${integrations.length} integration${integrations.length !== 1 ? 's' : ''} configured`}
            </p>
          </div>
          <Button variant="brand" size="sm" onClick={() => openAddDialog('custom_webhook')}>
            <Plus className="h-3.5 w-3.5" />
            Add Integration
          </Button>
        </div>

        {integrations.length === 0 ? (
          <AddIntegrationCards onAdd={openAddDialog} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {integrations.map((i) => (
                <ProviderCard
                  key={i.id}
                  integration={i}
                  logs={deliveryLogs}
                  onConfigure={() => openEditDialog(i)}
                  onTest={() => handleTest(i)}
                  onToggleEnabled={() => handleToggleEnabled(i)}
                  onDelete={() => handleDelete(i)}
                  onSelectEvents={() => setEventsIntegration(i)}
                  busy={busy === i.id}
                />
              ))}
            </div>
            <AddIntegrationCards onAdd={openAddDialog} />
          </div>
        )}
      </section>

      {/* Zone 2b: Event routing */}
      {eventsIntegration && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--brand-text)]">
                Event Routing — {eventsIntegration.name}
              </h2>
              <p className="text-xs text-[var(--brand-muted)] mt-0.5">
                Choose which events are delivered to this integration.
              </p>
            </div>
            <button
              onClick={() => setEventsIntegration(null)}
              className="text-xs text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
            >
              Close
            </button>
          </div>
          <IntegrationEventToggles
            integration={eventsIntegration}
            onUpdate={handleEventsUpdate}
          />
        </section>
      )}

      {/* Zone 3: Delivery logs */}
      <section className="space-y-4">
        <DeliveryLogsSection initialLogs={deliveryLogs} />
      </section>

      {/* Config dialog */}
      <IntegrationConfigDialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        onSave={handleSaved}
        existing={configDialogExisting}
        provider={configDialogProvider}
      />

      {/* Toast */}
      {toast && <Toast toast={toast} onDismiss={dismissToast} />}
    </div>
  )
}
