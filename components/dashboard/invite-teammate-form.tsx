'use client'

/**
 * InviteTeammateForm — inline form for inviting teammates.
 *
 * Email input + role selector + send button.
 * Handles API call and shows success/error feedback.
 */

import { useState } from 'react'
import { Send, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROLE_LABELS, type WorkspaceRole, assignableRoles } from '@/lib/auth/rbac'

interface InviteTeammateFormProps {
  currentUserRole: WorkspaceRole
  onInviteSent?: () => void
}

export function InviteTeammateForm({ currentUserRole, onInviteSent }: InviteTeammateFormProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<WorkspaceRole>('staff')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const roles = assignableRoles(currentUserRole)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || sending) return

    setSending(true)
    setError(null)

    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to send invitation')
        return
      }

      setSent(true)
      setEmail('')
      onInviteSent?.()
      setTimeout(() => setSent(false), 3000)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        {/* Email input */}
        <input
          type="email"
          placeholder="teammate@clinic.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setError(null)
          }}
          className={cn(
            'flex-1 rounded-lg border px-3 py-2 text-xs',
            'bg-[var(--brand-bg)] text-[var(--brand-text)]',
            'placeholder:text-[var(--brand-muted)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--user-accent)]',
            'transition-colors duration-150',
            error
              ? 'border-rose-300 dark:border-rose-700'
              : 'border-[var(--brand-border)]',
          )}
        />

        {/* Role selector */}
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as WorkspaceRole)}
          className={cn(
            'rounded-lg border border-[var(--brand-border)] px-2.5 py-2 text-xs',
            'bg-[var(--brand-bg)] text-[var(--brand-text)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--user-accent)]',
          )}
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>

        {/* Send button */}
        <button
          type="submit"
          disabled={!email.trim() || sending}
          className={cn(
            'shrink-0 rounded-lg px-3 py-2 text-xs font-medium',
            'flex items-center gap-1.5 transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent)]',
            sent
              ? 'bg-emerald-500 text-white'
              : 'bg-[var(--user-accent)] text-white hover:opacity-90',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : sent ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {sent ? 'Sent' : 'Invite'}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-[10px] text-rose-600 dark:text-rose-400">{error}</p>
      )}

      {/* Success message */}
      {sent && (
        <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
          Invitation sent! They&apos;ll receive an email to join your workspace.
        </p>
      )}
    </form>
  )
}
