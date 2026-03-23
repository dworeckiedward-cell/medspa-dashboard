'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Clock,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Bot,
  Copy,
  Check,
  Download,
  FileText,
  Brain,
  Code,
  Mic,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { RecordingPlayer } from './recording-player'
import { AiFollowupDraft } from './ai-followup-draft'
import type { CallLog } from '@/types/database'
import { CALL_DISPOSITION_LABELS, CALL_INTENT_LABELS } from '@/types/database'

interface CallDetailViewProps {
  callLog: CallLog
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatCurrency(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—'
  return `$${cents.toLocaleString()}`
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${Math.round(value * 100)}%`
}

/** Derive agent name from available fields, falling back to raw_payload. */
function deriveAgentName(c: CallLog): string {
  if (c.agent_name) return c.agent_name
  // Try migration-023 field if it exists at runtime
  const retellId = (c as unknown as Record<string, unknown>).retell_agent_id as string | undefined
  if (retellId) return retellId
  const raw = c.raw_payload as Record<string, unknown> | null
  if (raw?.agent_id && typeof raw.agent_id === 'string') return raw.agent_id
  return 'Unknown'
}

/** Derive cost from available fields, falling back to raw_payload. */
function deriveCost(c: CallLog): string {
  // Try migration-023 field if it exists at runtime
  const costField = (c as unknown as Record<string, unknown>).cost_usd as number | null | undefined
  if (costField !== null && costField !== undefined) return `$${costField.toFixed(4)}`
  const raw = c.raw_payload as Record<string, unknown> | null
  if (raw?.cost && typeof raw.cost === 'number') return `$${raw.cost.toFixed(4)}`
  return '—'
}

// ── Status pill — based on call outcome, not Retell call_status ─────────────

function OutcomePill({ callLog }: { callLog: CallLog }) {
  if (callLog.is_booked) {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
        Booked
      </span>
    )
  }
  if (callLog.is_lead) {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
        Lead
      </span>
    )
  }
  return (
    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
      Completed
    </span>
  )
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md border border-[var(--brand-border)] px-2 py-1 text-[10px] font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {label ?? (copied ? 'Copied' : 'Copy')}
    </button>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function CallDetailView({ callLog }: CallDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'transcript' | 'raw'>('transcript')
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  const c = callLog

  async function handleRefreshFromRetell() {
    if (!c.external_call_id || refreshing) return
    setRefreshing(true)
    try {
      const res = await fetch(
        `/api/ops/tenants/${c.client_id}/retell/calls/${c.external_call_id}/refresh`,
      )
      if (res.ok) {
        // Reload the page to show updated data
        router.refresh()
      }
    } catch {
      // silently fail — operator can retry
    } finally {
      setRefreshing(false)
    }
  }

  // Safe field mappings — prefer production columns, fall back gracefully
  const startTime = c.contacted_at ?? c.created_at
  const callerPhone = c.caller_phone
  const summaryText = c.ai_summary ?? c.summary

  // Infer end time from contacted_at + duration_seconds (if possible)
  const endTimeEstimate = (() => {
    if (!startTime || !c.duration_seconds) return null
    try {
      return new Date(new Date(startTime).getTime() + c.duration_seconds * 1000).toISOString()
    } catch {
      return null
    }
  })()

  return (
    <div className="p-4 sm:p-6 space-y-4 animate-fade-in max-w-4xl">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/call-logs"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--brand-border)] hover:bg-[var(--brand-surface)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-[var(--brand-muted)]" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold text-[var(--brand-text)]">
              {c.semantic_title ?? 'Call Details'}
            </h1>
            <OutcomePill callLog={c} />
            {c.direction && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--brand-muted)]">
                {c.direction === 'inbound' ? <PhoneIncoming className="h-3 w-3" /> : <PhoneOutgoing className="h-3 w-3" />}
                {c.direction}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--brand-muted)] mt-0.5">
            {callerPhone ?? 'Unknown caller'}
            {c.caller_name && ` · ${c.caller_name}`}
          </p>
        </div>
      </div>

      {/* ── KPI Strip ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard icon={Clock} label="Duration" value={formatDuration(c.duration_seconds)} />
        <KpiCard
          icon={c.direction === 'outbound' ? PhoneOutgoing : PhoneIncoming}
          label="Direction"
          value={c.direction ? c.direction.charAt(0).toUpperCase() + c.direction.slice(1) : '—'}
        />
        <KpiCard icon={Bot} label="Agent" value={deriveAgentName(c)} />
      </div>

      {/* ── Call Information ──────────────────────────────────────────────── */}
      <Card title="Call Information" icon={Phone}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          <InfoRow label="Started At" value={formatDate(startTime)} />
          <InfoRow
            label="Ended At"
            value={endTimeEstimate ? `${formatDate(endTimeEstimate)} (est.)` : '—'}
          />
          <InfoRow label="Phone Number" value={callerPhone ?? '—'} mono />
          <InfoRow label="Call ID" value={c.external_call_id ?? '—'} mono />
          <InfoRow label="Disposition" value={c.disposition ? CALL_DISPOSITION_LABELS[c.disposition] ?? c.disposition : '—'} />
          <InfoRow label="Intent" value={c.intent ? CALL_INTENT_LABELS[c.intent] ?? c.intent : '—'} />
          <InfoRow label="Sentiment" value={c.sentiment ? c.sentiment.charAt(0).toUpperCase() + c.sentiment.slice(1) : '—'} />
          <InfoRow label="Agent Provider" value={c.agent_provider ?? '—'} />
        </div>
      </Card>

      {/* ── Recording ────────────────────────────────────────────────────── */}
      <Card title="Call Recording" icon={Mic}>
        {c.recording_url ? (
          <div className="space-y-3">
            <RecordingPlayer src={c.recording_url} />
            <a
              href={c.recording_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand-border)] px-3 py-1.5 text-xs font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download Recording
            </a>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--brand-muted)] italic">
              No recording available for this call.
            </p>
            {c.external_call_id && (
              <button
                onClick={handleRefreshFromRetell}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand-border)] px-3 py-1.5 text-xs font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors disabled:opacity-50"
              >
                {refreshing
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh Call Recording
              </button>
            )}
          </div>
        )}
      </Card>


      {/* ── AI Follow-up Draft ──────────────────────────────────────────── */}
      <AiFollowupDraft callLog={c} />

      {/* ── AI Summary ───────────────────────────────────────────────────── */}
      <Card title="AI Summary" icon={Brain}>
        {summaryText ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wider">
                Summary
              </p>
              <CopyButton text={summaryText} />
            </div>
            <p className="text-xs text-[var(--brand-text)] leading-relaxed whitespace-pre-wrap">
              {summaryText}
            </p>
          </div>
        ) : (
          <p className="text-xs text-[var(--brand-muted)] italic">No AI summary available.</p>
        )}
      </Card>

      {/* ── Outcome ──────────────────────────────────────────────────────── */}
      <Card title="Outcome" icon={TrendingUp}>
        <div className="grid grid-cols-2 gap-4">
          <OutcomeStat label="Booked Value" value={formatCurrency(c.booked_value)} />
          <OutcomeStat label="Potential Revenue" value={formatCurrency(c.potential_revenue)} />
        </div>

        {c.human_followup_needed && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Human follow-up needed
              </p>
              {c.human_followup_reason && (
                <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-0.5">
                  {c.human_followup_reason}
                </p>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* ── Transcript / Raw ─────────────────────────────────────────────── */}
      <Card title="Transcript" icon={FileText}>
        <div className="flex gap-1 mb-3">
          <TabButton
            active={activeTab === 'transcript'}
            icon={FileText}
            label="Transcript"
            onClick={() => setActiveTab('transcript')}
          />
          <TabButton
            active={activeTab === 'raw'}
            icon={Code}
            label="Raw"
            onClick={() => setActiveTab('raw')}
          />
        </div>

        {activeTab === 'transcript' && (
          <div className="space-y-2">
            {c.transcript ? (
              <>
                <div className="flex justify-end">
                  <CopyButton text={c.transcript} label="Copy transcript" />
                </div>
                <pre className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-3 text-xs text-[var(--brand-text)] whitespace-pre-wrap max-h-96 overflow-y-auto font-mono leading-relaxed">
                  {c.transcript}
                </pre>
              </>
            ) : (
              <p className="text-xs text-[var(--brand-muted)] italic">
                No transcript available.
              </p>
            )}
          </div>
        )}

        {activeTab === 'raw' && (
          <div className="space-y-2">
            {(() => {
              const rawJson = c.ai_summary_json ?? c.raw_payload ?? {}
              const rawStr = JSON.stringify(rawJson, null, 2)
              return (
                <>
                  <div className="flex justify-end">
                    <CopyButton text={rawStr} label="Copy JSON" />
                  </div>
                  <pre className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-3 text-[10px] text-[var(--brand-muted)] whitespace-pre-wrap max-h-96 overflow-y-auto font-mono">
                    {rawStr}
                  </pre>
                </>
              )
            })()}
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 text-[var(--brand-muted)]" />
        <span className="text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-semibold text-[var(--brand-text)] tabular-nums truncate">{value}</p>
    </div>
  )
}

function OutcomeStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-[var(--brand-text)] tabular-nums">{value}</p>
    </div>
  )
}

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-[var(--brand-muted)]" />
        <h2 className="text-sm font-semibold text-[var(--brand-text)]">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-[11px] text-[var(--brand-muted)]">{label}</span>
      <span className={cn('text-xs text-[var(--brand-text)] text-right max-w-[60%] truncate', mono && 'font-mono text-[11px]')}>
        {value}
      </span>
    </div>
  )
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: React.ElementType
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
          : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-border)]/20',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
