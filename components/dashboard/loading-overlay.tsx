'use client'

/**
 * BrandedLoader — premium workspace loading overlay.
 *
 * Shows once per session tab. Phase state machine:
 *   hidden → entering → exiting → hidden
 *
 * Design: centered glass card with tenant logo, staged status text,
 * shimmer progress bar, rotating quote, and ambient brand glow.
 * Consistent with the premium login page and dashboard aesthetic.
 */

import { useEffect, useState, useMemo } from 'react'
import Image from 'next/image'

interface BrandedLoaderProps {
  tenantName: string
  logoUrl: string | null
  brandColor: string
  /** Pass tenant.updated_at for cache-busting logo images after upload. */
  updatedAt?: string
}

/** Append cache-buster to logo URL. */
function cacheBustLogo(url: string | null, updatedAt?: string): string | null {
  if (!url) return null
  const v = updatedAt ? new Date(updatedAt).getTime() : Date.now()
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}v=${v}`
}

// One splash per browser tab. Subsequent client-side navigations skip the overlay.
const SESSION_KEY = 'dashboard-loaded'

// Phase state machine:  hidden → entering → exiting → hidden
type Phase = 'hidden' | 'entering' | 'exiting'

// Timing constants (ms)
const DISPLAY_MS = 1800 // premium feel — longer than a flash, shorter than annoying
const EXIT_MS    = 450  // CSS fade-out duration
const HARD_CAP   = 2800 // absolute safety ceiling

// Staged status messages — rotate through for a "steps" feel
const STATUS_STEPS = [
  'Preparing your workspace',
  'Loading your data',
  'Almost ready',
]
const STEP_INTERVAL = 600 // ms between status rotations (slower = more premium)

// Rotating inspirational quotes
const QUOTES = [
  'Your AI receptionist never misses a call.',
  'Every call is an opportunity.',
  'Faster response, higher conversion.',
  'AI-powered growth, human touch.',
  'Your front desk, always on.',
]

export function BrandedLoader({ tenantName, logoUrl, brandColor, updatedAt }: BrandedLoaderProps) {
  const resolvedLogoUrl = cacheBustLogo(logoUrl, updatedAt)
  const [phase, setPhase]         = useState<Phase>('hidden')
  const [progress, setProgress]   = useState(0)
  const [stepIndex, setStepIndex] = useState(0)

  // Pick a stable random quote per session
  const quote = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], [])

  // ── Effect 1: decide whether to show (once per session) ─────────────────
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return
      sessionStorage.setItem(SESSION_KEY, '1')
      setPhase('entering')
    } catch {
      // sessionStorage blocked (e.g. private browsing) — skip overlay
    }
  }, [])

  // ── Effect 2: progress animation + exit timers ───────────────────────────
  useEffect(() => {
    if (phase !== 'entering') return

    setProgress(8) // subtle initial jump

    // Time-based rAF progress: 8 → 85 over DISPLAY_MS × 0.85 (easeOut curve)
    const startTime  = Date.now()
    const ANIM_RANGE = DISPLAY_MS * 0.85
    let rafId        = 0

    const tick = () => {
      const elapsed = Date.now() - startTime
      const t       = Math.min(elapsed / ANIM_RANGE, 1)
      const eased   = 1 - Math.pow(1 - t, 3.5) // slower easeOut power curve
      setProgress(8 + eased * 77)               // 8 → 85
      if (t < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    // Trigger exit: snap bar to 100%, start fade-out
    const exitTimer = setTimeout(() => {
      setProgress(100)
      setPhase('exiting')
    }, DISPLAY_MS)

    // Hard safety cap — overlay CANNOT stay stuck past this point
    const hardCap = setTimeout(() => setPhase('hidden'), HARD_CAP)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(exitTimer)
      clearTimeout(hardCap)
    }
  }, [phase])

  // ── Effect 3: unmount after fade-out completes ───────────────────────────
  useEffect(() => {
    if (phase !== 'exiting') return
    const timer = setTimeout(() => setPhase('hidden'), EXIT_MS + 50)
    return () => clearTimeout(timer)
  }, [phase])

  // ── Effect 4: staged status text rotation ──────────────────────────────
  useEffect(() => {
    if (phase !== 'entering') return
    const timer = setInterval(() => {
      setStepIndex((i) => (i < STATUS_STEPS.length - 1 ? i + 1 : i))
    }, STEP_INTERVAL)
    return () => clearInterval(timer)
  }, [phase])

  // Unmounted — nothing to render
  if (phase === 'hidden') return null

  const isExiting = phase === 'exiting'
  const letter    = tenantName.charAt(0).toUpperCase()

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[var(--brand-bg)]"
      style={{
        opacity:       isExiting ? 0 : 1,
        transition:    `opacity ${EXIT_MS}ms ease-out`,
        pointerEvents: isExiting ? 'none' : undefined,
      }}
    >
      {/* Clean gradient background — no dot-grid to prevent "excel grid" flicker */}

      {/* Gradient wash over dot-grid for depth */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 70% 50% at 50% 40%, ${brandColor}08 0%, transparent 100%)`,
        }}
      />

      {/* Ambient radial glow behind card */}
      <div
        aria-hidden="true"
        className="loader-ring-pulse absolute pointer-events-none"
        style={{
          width:        420,
          height:       420,
          borderRadius: '50%',
          background:   `radial-gradient(circle, ${brandColor}18 0%, ${brandColor}08 40%, transparent 68%)`,
        }}
      />

      {/* ── Main card ───────────────────────────────────────────────────── */}
      <div
        className="loader-card-enter relative z-10 flex w-[320px] flex-col items-center rounded-2xl border border-[var(--brand-border)]/60 bg-[var(--brand-surface)]/95 backdrop-blur-sm px-10 py-10"
        style={{
          boxShadow: [
            `0 0 0 1px ${brandColor}08`,
            `0 24px 64px -16px ${brandColor}22`,
            '0 8px 32px rgba(0,0,0,0.06)',
            '0 1px 3px rgba(0,0,0,0.04)',
          ].join(', '),
        }}
      >
        {/* Logo cluster */}
        <div className="relative mb-8">
          {/* Blurred glow halo */}
          <div
            aria-hidden="true"
            className="absolute -inset-5 rounded-3xl pointer-events-none blur-2xl"
            style={{ background: brandColor, opacity: 0.14 }}
          />

          {/* Soft ring around logo */}
          <div
            aria-hidden="true"
            className="absolute -inset-2 rounded-[20px] pointer-events-none"
            style={{
              border: `1.5px solid ${brandColor}18`,
              opacity: 0.6,
            }}
          />

          {/* Logo tile */}
          <div
            className="loader-logo-float relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-2xl text-2xl font-bold"
            style={{
              background: resolvedLogoUrl ? '#ffffff' : brandColor,
              color: resolvedLogoUrl ? undefined : '#ffffff',
              boxShadow:  `0 0 0 4px ${brandColor}20, 0 12px 40px ${brandColor}35`,
            }}
          >
            {/* Light-sweep shimmer */}
            <div
              aria-hidden="true"
              className="loader-shimmer absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)',
              }}
            />

            {resolvedLogoUrl ? (
              <Image
                src={resolvedLogoUrl}
                alt={tenantName}
                width={72}
                height={72}
                className="relative z-10 rounded-2xl object-cover"
              />
            ) : (
              <span className="relative z-10 select-none">{letter}</span>
            )}
          </div>
        </div>

        {/* Workspace name */}
        <p className="text-sm font-semibold leading-none text-[var(--brand-text)] tracking-tight">
          {tenantName}
        </p>

        {/* Staged status text */}
        <p
          className="mt-2 text-[11px] text-[var(--brand-muted)] transition-opacity duration-300"
          style={{ opacity: isExiting ? 0 : 0.7 }}
        >
          {STATUS_STEPS[stepIndex]}
        </p>

        {/* Progress bar with shimmer */}
        <div className="mt-8 w-full">
          <div
            className="w-full overflow-hidden rounded-full bg-[var(--brand-border)]/60"
            style={{ height: 3 }}
          >
            <div
              className="relative h-full rounded-full overflow-hidden"
              style={{
                width:      `${progress}%`,
                background: `linear-gradient(90deg, ${brandColor}bb, ${brandColor})`,
                transition: progress >= 100 ? 'width 300ms ease-out' : 'width 120ms linear',
                willChange: 'width',
              }}
            >
              {/* Shimmer highlight on bar */}
              <div
                aria-hidden="true"
                className="loader-bar-shimmer absolute inset-0"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Step dots */}
        <div className="mt-4 flex items-center gap-1.5">
          {STATUS_STEPS.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-400"
              style={{
                width:      i <= stepIndex ? 6 : 4,
                height:     i <= stepIndex ? 6 : 4,
                background: i <= stepIndex ? brandColor : 'var(--brand-border)',
                opacity:    i <= stepIndex ? 0.8 : 0.4,
              }}
            />
          ))}
        </div>

        {/* Rotating quote */}
        <p
          className="mt-6 text-[10px] text-[var(--brand-muted)] text-center italic leading-relaxed transition-opacity duration-500"
          style={{ opacity: isExiting ? 0 : 0.45, maxWidth: 220 }}
        >
          {quote}
        </p>
      </div>
    </div>
  )
}
