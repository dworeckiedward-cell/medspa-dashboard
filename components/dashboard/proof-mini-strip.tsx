import { DollarSign, Bot, ShieldCheck } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { CallLog } from '@/types/database'

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeProofMini(callLogs: CallLog[]) {
  let bookedRevenue = 0
  let pipelineRevenue = 0
  let aiHandled = 0
  let coveredCalls = 0

  for (const c of callLogs) {
    if (c.is_booked) {
      bookedRevenue += c.booked_value ?? 0
    }
    if (c.is_lead && !c.is_booked) {
      pipelineRevenue += c.potential_revenue ?? 0
    }

    if (!c.human_followup_needed) {
      aiHandled++
    }

    if (c.recording_url || c.ai_summary) {
      coveredCalls++
    }
  }

  return {
    recoveredRevenue: bookedRevenue + pipelineRevenue,
    aiHandledPct: callLogs.length > 0
      ? Math.round((aiHandled / callLogs.length) * 100)
      : 0,
    coveragePct: callLogs.length > 0
      ? Math.round((coveredCalls / callLogs.length) * 100)
      : 0,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProofStat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  color: string
}) {
  return (
    <div className="rounded-xl bg-[var(--brand-bg)] border border-[var(--brand-border)]/50 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <div
          className="flex h-5 w-5 items-center justify-center rounded-md"
          style={{ background: `${color}20` }}
        >
          <Icon className="h-3 w-3" style={{ color }} />
        </div>
        <p className="text-[10px] font-medium text-[var(--brand-muted)] uppercase tracking-wide truncate">
          {label}
        </p>
      </div>
      <p className="text-lg font-semibold text-[var(--brand-text)] tabular-nums">{value}</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface ProofMiniStripProps {
  callLogs: CallLog[]
  currency: string
  tenantSlug?: string
}

export function ProofMiniStrip({ callLogs, currency }: ProofMiniStripProps) {
  if (callLogs.length === 0) return null

  const { recoveredRevenue, aiHandledPct, coveragePct } = computeProofMini(callLogs)

  return (
    <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
      <div className="mb-3">
        <p className="text-[11px] font-semibold text-[var(--brand-text)] uppercase tracking-wider">
          Revenue Proof
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <ProofStat
          icon={DollarSign}
          label="Recovered"
          value={formatCurrency(recoveredRevenue, currency)}
          color="#10B981"
        />
        <ProofStat
          icon={Bot}
          label="AI Handled"
          value={`${aiHandledPct}%`}
          color="#7C3AED"
        />
        <ProofStat
          icon={ShieldCheck}
          label="Coverage"
          value={`${coveragePct}%`}
          color="var(--brand-primary)"
        />
      </div>
    </div>
  )
}
