'use client'

import { AlertCircle } from 'lucide-react'

export default function ConversationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12">
      <AlertCircle className="h-8 w-8 text-rose-500" />
      <div className="text-center">
        <p className="text-sm font-medium text-[var(--brand-text)]">
          Failed to load conversations
        </p>
        <p className="text-xs text-[var(--brand-muted)] mt-1">
          {error.message}
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 py-2 text-xs font-medium text-[var(--brand-text)] hover:bg-[var(--brand-bg)] transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
