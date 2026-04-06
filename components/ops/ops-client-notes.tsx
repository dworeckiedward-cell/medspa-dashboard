'use client'

import { useState, useCallback } from 'react'
import { StickyNote, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OpsClientNotesProps {
  clientId: string
  initialNotes: string | null
}

export function OpsClientNotes({ clientId, initialNotes }: OpsClientNotesProps) {
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const dirty = notes !== (initialNotes ?? '')

  const save = useCallback(async () => {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch(`/api/ops/tenants/${clientId}/patch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ops_notes: notes }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } finally {
      setSaving(false)
    }
  }, [clientId, notes])

  return (
    <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--brand-border)]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
            <StickyNote className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--brand-text)]">Internal Notes</h3>
            <p className="text-[10px] text-[var(--brand-muted)]">Only visible to operators</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          <button
            onClick={save}
            disabled={!dirty || saving}
            className={cn(
              'text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors',
              dirty && !saving
                ? 'bg-[var(--brand-primary)] text-white hover:opacity-90'
                : 'bg-[var(--brand-border)] text-[var(--brand-muted)] cursor-not-allowed',
            )}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
          </button>
        </div>
      </div>
      <div className="p-4">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add internal notes about this client..."
          rows={4}
          className="w-full resize-y rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-2.5 text-sm text-[var(--brand-text)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]/50"
        />
      </div>
    </div>
  )
}
