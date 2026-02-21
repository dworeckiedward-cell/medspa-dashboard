'use client'

import { useMemo } from 'react'
import { ShieldCheck, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { computeDataQuality } from '@/lib/dashboard/data-quality'
import type { CallLog } from '@/types/database'
import type { ClientService } from '@/lib/types/domain'

interface DataQualityCardProps {
  callLogs: CallLog[]
  services: ClientService[]
  hasIntegrations?: boolean
}

const BAND_COLORS = {
  good: {
    bg: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    label: 'Good',
  },
  fair: {
    bg: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    label: 'Fair',
  },
  poor: {
    bg: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
    label: 'Poor',
  },
} as const

export function DataQualityCard({
  callLogs,
  services,
  hasIntegrations,
}: DataQualityCardProps) {
  const quality = useMemo(
    () => computeDataQuality(callLogs, services, { hasIntegrations }),
    [callLogs, services, hasIntegrations],
  )

  if (quality.totalCalls === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-border)]/50">
            <ShieldCheck className="h-5 w-5 text-[var(--brand-muted)] opacity-50" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--brand-text)]">No call data yet</p>
            <p className="text-xs text-[var(--brand-muted)] mt-1 max-w-xs">
              Data quality metrics will appear once calls are processed.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const bandStyle = BAND_COLORS[quality.overallBand]

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--brand-muted)]" />
              Data Quality
            </CardTitle>
            <CardDescription className="mt-0.5">
              How complete and reliable your dashboard data is
            </CardDescription>
          </div>
          {/* Overall score badge */}
          <div className="flex flex-col items-center gap-0.5">
            <span className={cn('text-2xl font-bold tabular-nums', bandStyle.text)}>
              {quality.overallScore}%
            </span>
            <span className={cn('text-[10px] font-medium', bandStyle.text)}>
              {bandStyle.label}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dimension bars */}
        <div className="space-y-2.5">
          {quality.dimensions.map((dim) => {
            const dimBand = BAND_COLORS[dim.band]
            return (
              <div key={dim.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[var(--brand-text)]">{dim.label}</span>
                  <span className="text-xs tabular-nums text-[var(--brand-muted)]">
                    {dim.filled}/{dim.total} ({dim.percent}%)
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[var(--brand-border)]">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', dimBand.bg)}
                    style={{ width: `${Math.max(dim.percent, 2)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Improvement suggestions */}
        {quality.improvements.length > 0 && (
          <div className="border-t border-[var(--brand-border)] pt-3">
            <p className="text-[11px] font-medium text-[var(--brand-muted)] uppercase tracking-wider mb-2">
              Improve your score
            </p>
            <div className="space-y-1.5">
              {quality.improvements.map((imp) =>
                imp.href ? (
                  <a
                    key={imp.id}
                    href={imp.href}
                    className="flex items-center gap-2 text-xs text-[var(--brand-text)] hover:text-[var(--brand-primary)] transition-colors group"
                  >
                    <ArrowRight className="h-3 w-3 shrink-0 text-[var(--brand-muted)] group-hover:text-[var(--brand-primary)] transition-colors" />
                    {imp.label}
                  </a>
                ) : (
                  <div key={imp.id} className="flex items-center gap-2 text-xs text-[var(--brand-muted)]">
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    {imp.label}
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-[10px] text-[var(--brand-muted)] pt-1">
          Based on {quality.totalCalls} call{quality.totalCalls !== 1 ? 's' : ''} in this period
        </p>
      </CardContent>
    </Card>
  )
}
