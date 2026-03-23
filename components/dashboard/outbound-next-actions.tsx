'use client'

/**
 * OutboundNextActions — "Next Best Actions" strip for outbound operators.
 *
 * Renders 3 compact action cards derived purely from existing callLogs + metrics:
 *   A) Biggest Funnel Leak    — which conversion step drops the most leads
 *   B) Unbooked Qualified     — high-confidence leads that haven't booked
 *   C) Short / No-Answer      — calls ≤30 s (prospect never connected)
 */

import { useMemo } from 'react'
import { TrendingDown, UserX, PhoneOff, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { OutboundMetrics } from '@/lib/dashboard/outbound-metrics'
import type { CallLog } from '@/types/database'

interface Props {
  metrics: OutboundMetrics
  callLogs: CallLog[]
  rangeDays?: number
  tenantSlug?: string
}

interface ActionCard {
  icon: React.ElementType
  color: string
  headline: string
  stat: string
  body: string
  href: string
  cta: string
}

export function OutboundNextActions({ metrics, callLogs }: Props) {
  const cards = useMemo((): ActionCard[] => {
    // ── A) Biggest funnel leak ───────────────────────────────────────────────
    const steps = [
      {
        label: 'Calls → Contacted',
        drop: metrics.callsMade - metrics.contacted,
        pct:
          metrics.callsMade > 0
            ? Math.round(((metrics.callsMade - metrics.contacted) / metrics.callsMade) * 100)
            : 0,
      },
      {
        label: 'Contacted → Qualified',
        drop: metrics.contacted - metrics.qualified,
        pct:
          metrics.contacted > 0
            ? Math.round(((metrics.contacted - metrics.qualified) / metrics.contacted) * 100)
            : 0,
      },
      {
        label: 'Qualified → Booked',
        drop: metrics.qualified - metrics.booked,
        pct:
          metrics.qualified > 0
            ? Math.round(((metrics.qualified - metrics.booked) / metrics.qualified) * 100)
            : 0,
      },
    ]
    const leak = steps.reduce((a, b) => (b.pct > a.pct ? b : a))
    const leakColor = leak.pct >= 70 ? '#EF4444' : leak.pct >= 40 ? '#F59E0B' : '#10B981'

    // ── B) High-confidence unbooked leads ────────────────────────────────────
    const outbound = callLogs.filter((c) => c.direction === 'outbound')
    const hcUnbooked = outbound.filter(
      (c) => (c.lead_confidence ?? 0) >= 0.6 && !c.is_booked,
    )
    const hcColor =
      hcUnbooked.length >= 10 ? '#EF4444' : hcUnbooked.length >= 3 ? '#F59E0B' : '#10B981'

    // ── C) Short / no-answer calls ───────────────────────────────────────────
    const shortCalls = outbound.filter((c) => (c.duration_seconds ?? 0) <= 30)
    const shortPct =
      outbound.length > 0 ? Math.round((shortCalls.length / outbound.length) * 100) : 0
    const shortColor = shortPct >= 60 ? '#EF4444' : shortPct >= 30 ? '#F59E0B' : '#10B981'

    return [
      {
        icon: TrendingDown,
        color: leakColor,
        headline: 'Biggest Funnel Leak',
        stat: `${leak.pct}%`,
        body: `${leak.label}: ${leak.drop} lead${leak.drop !== 1 ? 's' : ''} lost at this step.`,
        href: '/dashboard/call-logs?direction=outbound',
        cta: 'View outbound calls',
      },
      {
        icon: UserX,
        color: hcColor,
        headline: 'Unbooked Qualified Leads',
        stat: hcUnbooked.length.toString(),
        body:
          hcUnbooked.length > 0
            ? `${hcUnbooked.length} lead${hcUnbooked.length !== 1 ? 's' : ''} at ≥60% confidence haven't booked yet.`
            : 'All high-confidence leads have been booked.',
        href: '/dashboard/call-logs?direction=outbound&minConfidence=60',
        cta: 'Review leads',
      },
      {
        icon: PhoneOff,
        color: shortColor,
        headline: 'Short / No-Answer Calls',
        stat: `${shortPct}%`,
        body: `${shortCalls.length} of ${outbound.length} outbound calls lasted ≤30 s — no live contact made.`,
        href: '/dashboard/call-logs?direction=outbound',
        cta: 'View calls',
      },
    ]
  }, [metrics, callLogs])

  if (metrics.callsMade === 0) return null

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-muted)] mb-2.5">
        Next Best Actions
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.headline}
            className="relative overflow-hidden rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4"
          >
            {/* Subtle color bleed */}
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                background: `radial-gradient(ellipse at top left, ${card.color}, transparent 70%)`,
              }}
            />
            <div className="relative flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                  style={{ background: `${card.color}18`, color: card.color }}
                >
                  <card.icon className="h-3 w-3" />
                </div>
                <span
                  className="text-xl font-bold tabular-nums leading-none"
                  style={{ color: card.color }}
                >
                  {card.stat}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-[var(--brand-text)]">{card.headline}</p>
              <p className="text-[10px] leading-relaxed text-[var(--brand-muted)]">{card.body}</p>
              <Link
                href={card.href}
                className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium transition-opacity hover:opacity-70"
                style={{ color: card.color }}
              >
                {card.cta}
                <ArrowRight className="h-2.5 w-2.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
