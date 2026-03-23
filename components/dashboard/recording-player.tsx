'use client'

/**
 * RecordingPlayer — reusable audio player with loading state.
 *
 * Prevents the "tiny dot" bug by showing a skeleton placeholder
 * until audio metadata is loaded. Includes error + retry handling.
 */

import { useState, useCallback } from 'react'
import { Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface RecordingPlayerProps {
  src: string
  /** Auto-play when mounted (e.g. inline table expand) */
  autoPlay?: boolean
  className?: string
}

export function RecordingPlayer({ src, autoPlay, className }: RecordingPlayerProps) {
  const [isReady, setIsReady] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  const handleReady = useCallback(() => setIsReady(true), [])
  const handleError = useCallback(() => {
    setIsReady(false)
    setHasError(true)
  }, [])

  const handleRetry = useCallback(() => {
    setHasError(false)
    setIsReady(false)
    setRetryKey((k) => k + 1)
  }, [])

  // ── Error state ──────────────────────────────────────────────────────────
  if (hasError) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3',
          className,
        )}
      >
        <AlertCircle className="h-4 w-4 shrink-0 text-[var(--brand-muted)] opacity-60" />
        <span className="text-xs text-[var(--brand-muted)]">
          Unable to load recording
        </span>
        <button
          onClick={handleRetry}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-[var(--brand-border)] px-2 py-1 text-[11px] font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/30"
        >
          <RotateCcw className="h-3 w-3" />
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      {/* Loading placeholder — same height as native audio controls */}
      {!isReady && (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 h-10">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--brand-muted)]" />
          <span className="text-[11px] text-[var(--brand-muted)]">
            Loading recording…
          </span>
          <Skeleton className="h-2 flex-1 rounded-full" />
        </div>
      )}

      {/* Actual audio element — hidden until ready to prevent "tiny dot" */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        key={retryKey}
        controls
        preload="metadata"
        src={src}
        autoPlay={autoPlay}
        aria-label="Call recording"
        className={cn(
          'w-full h-10 transition-opacity duration-150',
          isReady ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none',
        )}
        onLoadedMetadata={handleReady}
        onCanPlay={handleReady}
        onError={handleError}
      />
    </div>
  )
}
