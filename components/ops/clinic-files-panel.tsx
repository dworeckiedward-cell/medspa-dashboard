'use client'

import { useState, useCallback } from 'react'
import { FileText, Copy, Check, RefreshCw, Loader2, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface ClinicAsset {
  id: string
  tenantId: string
  type: string
  title: string
  content: string
  status: string
  source: string
  generatedFromUrl: string | null
  createdAt: string
  updatedAt: string
}

interface ClinicFilesPanelProps {
  tenantId: string
  tenantName: string
  assets: ClinicAsset[]
  onRefresh?: () => void
}

// ── Status helpers ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  ready: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    label: 'Ready',
  },
  pending: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    label: 'Pending',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-400',
    label: 'Error',
  },
}

// ── Component ────────────────────────────────────────────────────────────────

export function ClinicFilesPanel({
  tenantId,
  tenantName,
  assets,
  onRefresh,
}: ClinicFilesPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  const handleCopy = useCallback(async (assetId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(assetId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = content
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedId(assetId)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }, [])

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true)
    try {
      await fetch(`/api/ops/tenants/${tenantId}/generate-retell-prompts`, {
        method: 'POST',
      })
      onRefresh?.()
    } catch {
      // Graceful
    } finally {
      setRegenerating(false)
    }
  }, [tenantId, onRefresh])

  const prompts = assets.filter(
    (a) => a.type === 'retell_prompt_inbound' || a.type === 'retell_prompt_outbound',
  )
  const otherFiles = assets.filter(
    (a) => a.type !== 'retell_prompt_inbound' && a.type !== 'retell_prompt_outbound',
  )

  return (
    <div className="space-y-4">
      {/* Header with regenerate */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[var(--brand-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--brand-text)]">
            Client Files
          </h3>
          <span className="text-[10px] text-[var(--brand-muted)]">
            {tenantName}
          </span>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--brand-border)] px-2.5 py-1 text-[10px] font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] disabled:opacity-50 transition-colors"
        >
          {regenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Regenerate Prompts
        </button>
      </div>

      {/* Retell Prompts */}
      {prompts.length > 0 && (
        <div className="space-y-3">
          {prompts.map((asset) => (
            <PromptCard
              key={asset.id}
              asset={asset}
              copied={copiedId === asset.id}
              onCopy={() => handleCopy(asset.id, asset.content)}
            />
          ))}
        </div>
      )}

      {/* Other files */}
      {otherFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wide">
            Other Files
          </p>
          {otherFiles.map((asset) => (
            <div
              key={asset.id}
              className="flex items-center justify-between rounded-lg border border-[var(--brand-border)] px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
                <span className="text-xs text-[var(--brand-text)]">{asset.title}</span>
              </div>
              <StatusBadge status={asset.status} />
            </div>
          ))}
        </div>
      )}

      {assets.length === 0 && (
        <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-8 text-center">
          <Bot className="h-6 w-6 text-[var(--brand-muted)] mx-auto mb-2" />
          <p className="text-xs text-[var(--brand-muted)]">
            No files yet. Click &ldquo;Regenerate Prompts&rdquo; to generate Retell agent prompts.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function PromptCard({
  asset,
  copied,
  onCopy,
}: {
  asset: ClinicAsset
  copied: boolean
  onCopy: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isInbound = asset.type === 'retell_prompt_inbound'
  const statusStyle = STATUS_STYLES[asset.status] ?? STATUS_STYLES.pending

  return (
    <div className="rounded-xl border border-[var(--brand-border)] overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--brand-surface)]">
        <div className="flex items-center gap-2">
          <Bot className={cn('h-3.5 w-3.5', isInbound ? 'text-blue-500' : 'text-violet-500')} />
          <span className="text-xs font-medium text-[var(--brand-text)]">{asset.title}</span>
          <StatusBadge status={asset.status} />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
          <button
            onClick={onCopy}
            disabled={!asset.content}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all',
              copied
                ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/20 disabled:opacity-50',
            )}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content preview / expanded */}
      {expanded && asset.content && (
        <div className="border-t border-[var(--brand-border)]">
          <pre className="whitespace-pre-wrap text-[11px] text-[var(--brand-text)] p-4 max-h-80 overflow-y-auto font-mono leading-relaxed bg-[var(--brand-bg)]">
            {asset.content}
          </pre>
        </div>
      )}

      {!expanded && asset.content && (
        <div className="px-4 py-2 border-t border-[var(--brand-border)] bg-[var(--brand-bg)]">
          <p className="text-[10px] text-[var(--brand-muted)] line-clamp-2 font-mono">
            {asset.content.slice(0, 200)}...
          </p>
        </div>
      )}

      {asset.generatedFromUrl && (
        <div className="px-4 py-1.5 border-t border-[var(--brand-border)] bg-[var(--brand-surface)]">
          <p className="text-[9px] text-[var(--brand-muted)]">
            Generated from: {asset.generatedFromUrl}
          </p>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending
  return (
    <span className={cn('inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium', style.bg, style.text)}>
      {style.label}
    </span>
  )
}
