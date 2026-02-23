'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Clock,
  DollarSign,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Bot,
  Copy,
  Check,
  Download,
  Play,
  FileText,
  Brain,
  Code,
  Mic,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CallLog } from '@/types/database'
import { CALL_DISPOSITION_LABELS, CALL_INTENT_LABELS } from '@/types/database'

interface CallDetailViewProps {
  callLog: CallLog
}

function formatDuration(seconds: number): string {
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

function StatusPill({ status }: { status: string | null }) {
  const s = status ?? 'unknown'
  const colors: Record<string, string> = {
    ended: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
    ongoing: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',
    registered: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  }
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', colors[s] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400')}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
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

export function CallDetailView({ callLog }: CallDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'transcript' | 'raw'>('transcript')

  const c = callLog
  const startTime = c.started_at ?? c.created_at
  const endTime = c.ended_at
  const costUsd = c.cost_usd
  const retellAgentId = c.retell_agent_id
  const callStatus = c.call_status
  const fromNumber = c.from_number ?? c.caller_phone
  const toNumber = c.to_number
  const callSummaryJson = c.call_summary_json
  const disconnectReason = c.disconnect_reason

  return (
    <div className="p-4 sm:p-6 space-y-4 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/call-logs"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--brand-border)] hover:bg-[var(--brand-surface)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-[var(--brand-muted)]" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-[var(--brand-text)]">
              {c.semantic_title ?? 'Call Details'}
            </h1>
            <StatusPill status={callStatus ?? (c.disposition ? 'ended' : null)} />
            {c.direction && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--brand-muted)]">
                {c.direction === 'inbound' ? <PhoneIncoming className="h-3 w-3" /> : <PhoneOutgoing className="h-3 w-3" />}
                {c.direction}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--brand-muted)] mt-0.5">
            {formatDate(startTime)}
            {c.caller_name && ` · ${c.caller_name}`}
          </p>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={Clock} label="Duration" value={formatDuration(c.duration_seconds)} />
        <KpiCard icon={DollarSign} label="Cost" value={costUsd !== null ? `$${costUsd.toFixed(4)}` : '—'} />
        <KpiCard
          icon={c.direction === 'outbound' ? PhoneOutgoing : PhoneIncoming}
          label="Direction"
          value={c.direction ?? '—'}
        />
        <KpiCard icon={Bot} label="Agent" value={c.agent_name ?? retellAgentId ?? '—'} />
      </div>

      {/* Call Information */}
      <Card title="Call Information" icon={Phone}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <InfoRow label="Started" value={formatDate(startTime)} />
          <InfoRow label="Ended" value={formatDate(endTime)} />
          <InfoRow label="From" value={fromNumber ?? '—'} mono />
          <InfoRow label="To" value={toNumber ?? '—'} mono />
          <InfoRow label="Retell Call ID" value={c.external_call_id ?? '—'} mono />
          <InfoRow label="Disposition" value={c.disposition ? CALL_DISPOSITION_LABELS[c.disposition] ?? c.disposition : '—'} />
          <InfoRow label="Intent" value={c.intent ? CALL_INTENT_LABELS[c.intent] ?? c.intent : '—'} />
          <InfoRow label="Sentiment" value={c.sentiment ?? '—'} />
          {disconnectReason && <InfoRow label="Disconnect" value={disconnectReason} />}
        </div>
      </Card>

      {/* Recording */}
      <Card title="Recording" icon={Mic}>
        {c.recording_url ? (
          <div className="space-y-3">
            <audio controls preload="metadata" className="w-full h-10">
              <source src={c.recording_url} />
              Your browser does not support audio playback.
            </audio>
            <a
              href={c.recording_url}
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand-border)] px-3 py-1.5 text-xs font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download recording
            </a>
          </div>
        ) : (
          <p className="text-xs text-[var(--brand-muted)] italic">
            No recording available for this call.
          </p>
        )}
      </Card>

      {/* Call Analysis */}
      <Card title="Call Analysis" icon={Brain}>
        {/* Summary */}
        {(c.ai_summary || c.summary) ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wider">
                Summary
              </p>
              <CopyButton text={c.ai_summary ?? c.summary ?? ''} />
            </div>
            <p className="text-xs text-[var(--brand-text)] leading-relaxed whitespace-pre-wrap">
              {c.ai_summary ?? c.summary}
            </p>
          </div>
        ) : (
          <p className="text-xs text-[var(--brand-muted)] italic">No AI summary available.</p>
        )}

        {/* Tabs */}
        <div className="mt-4 border-t border-[var(--brand-border)] pt-3">
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
              label="Raw JSON"
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
              <div className="flex justify-end">
                <CopyButton
                  text={JSON.stringify(callSummaryJson ?? c.ai_summary_json ?? c.raw_payload ?? {}, null, 2)}
                  label="Copy JSON"
                />
              </div>
              <pre className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] p-3 text-[10px] text-[var(--brand-muted)] whitespace-pre-wrap max-h-96 overflow-y-auto font-mono">
                {JSON.stringify(callSummaryJson ?? c.ai_summary_json ?? c.raw_payload ?? {}, null, 2)}
              </pre>
            </div>
          )}
        </div>
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
