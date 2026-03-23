'use client'

import { useState } from 'react'
import { PhoneForwarded, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SetupGuideCardProps {
  agentPhone: string
}

export function SetupGuideCard({ agentPhone }: SetupGuideCardProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  function copyPhone() {
    navigator.clipboard.writeText(agentPhone).catch(() => undefined)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--brand-bg)]/60 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
            <PhoneForwarded className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-[var(--brand-text)]">
              Forward calls to your AI receptionist
            </p>
            <p className="text-xs text-[var(--brand-muted)] mt-0.5">
              Moby / internet phone setup guide
            </p>
          </div>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-[var(--brand-muted)] shrink-0" />
          : <ChevronDown className="h-4 w-4 text-[var(--brand-muted)] shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-[var(--brand-border)]/50 pt-4 space-y-4">
          {/* Agent phone number — prominent */}
          <div className="rounded-lg bg-[var(--brand-primary)]/8 border border-[var(--brand-primary)]/20 px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-primary)] mb-0.5">
                Forward unanswered calls to
              </p>
              <p className="text-lg font-bold text-[var(--brand-text)] tabular-nums tracking-tight">
                {agentPhone}
              </p>
            </div>
            <button
              onClick={copyPhone}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors shrink-0',
                copied
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-[var(--brand-border)] text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
              )}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Steps */}
          <div>
            <p className="text-xs font-semibold text-[var(--brand-muted)] uppercase tracking-wider mb-2">
              Steps — Moby admin panel
            </p>
            <ol className="space-y-2">
              {[
                'Log into your Moby phone admin panel at moby.ca',
                'Go to your phone line settings or Extensions',
                'Find "Call Forwarding" or "No-Answer Forward"',
                `Set the forward-to number: ${agentPhone}`,
                'Set it to forward after 3–4 rings (so you can still answer first)',
                'Save and test by calling your clinic number and not picking up',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-[var(--brand-text)]">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] font-semibold text-[10px] mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <p className="text-[11px] text-[var(--brand-muted)] border-t border-[var(--brand-border)]/50 pt-3">
            Need help? Email{' '}
            <a href="mailto:team@servifylabs.com" className="text-[var(--brand-primary)] hover:underline">
              team@servifylabs.com
            </a>{' '}
            and we'll walk you through it.
          </p>
        </div>
      )}
    </div>
  )
}
