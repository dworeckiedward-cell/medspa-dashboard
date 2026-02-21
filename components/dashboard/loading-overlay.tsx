'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface BrandedLoaderProps {
  tenantName: string
  logoUrl: string | null
  brandColor: string
}

// One splash per browser tab. Subsequent client-side navigations skip the overlay.
const SESSION_KEY = 'dashboard-loaded'

// Phase state machine:  hidden → entering → exiting → hidden
type Phase = 'hidden' | 'entering' | 'exiting'

// Timing constants (ms)
const DISPLAY_MS = 1200 // how long overlay stays before exit begins
const EXIT_MS    = 380  // CSS fade-out duration (must match transition below)
const HARD_CAP   = 2000 // absolute safety ceiling — overlay ALWAYS gone by this point

export function BrandedLoader({ tenantName, logoUrl, brandColor }: BrandedLoaderProps) {
  const [phase, setPhase]       = useState<Phase>('hidden')
  const [progress, setProgress] = useState(0)

  // ── Effect 1: decide whether to show (once per session) ─────────────────
  // No timers here — just state machine trigger.
  // Strict-mode safe: sessionStorage key prevents duplicate shows on re-mount.
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
  // Runs whenever phase changes. Guard ensures work only happens for 'entering'.
  // Strict-mode safe: cleanup cancels rAF + clears all timers; re-run restarts them.
  useEffect(() => {
    if (phase !== 'entering') return

    setProgress(12) // initial jump so bar feels responsive

    // Time-based rAF progress: 12 → 88 over DISPLAY_MS × 0.9 (easeOut curve)
    const startTime  = Date.now()
    const ANIM_RANGE = DISPLAY_MS * 0.9
    let rafId        = 0

    const tick = () => {
      const elapsed = Date.now() - startTime
      const t       = Math.min(elapsed / ANIM_RANGE, 1)
      const eased   = 1 - Math.pow(1 - t, 2.5) // easeOut power curve
      setProgress(12 + eased * 76)              // 12 → 88
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
  // Separate effect so it survives phase transitions cleanly.
  useEffect(() => {
    if (phase !== 'exiting') return
    const timer = setTimeout(() => setPhase('hidden'), EXIT_MS + 50)
    return () => clearTimeout(timer)
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
        // Disable pointer capture during fade-out so UI is immediately interactive
        pointerEvents: isExiting ? 'none' : undefined,
      }}
    >
      {/* Dot-grid texture — decorative, very low opacity */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none select-none"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--brand-border) 1px, transparent 1px)',
          backgroundSize:  '28px 28px',
          opacity: 0.45,
        }}
      />

      {/* Ambient radial glow behind card */}
      <div
        aria-hidden="true"
        className="loader-ring-pulse absolute pointer-events-none"
        style={{
          width:        380,
          height:       380,
          borderRadius: '50%',
          background:   `radial-gradient(circle, ${brandColor}1a 0%, transparent 68%)`,
        }}
      />

      {/* ── Main card ───────────────────────────────────────────────────── */}
      <div
        className="loader-card-enter relative z-10 flex w-[296px] flex-col items-center rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] px-8 py-9"
        style={{
          boxShadow: `0 0 0 1px ${brandColor}10, 0 20px 60px -12px ${brandColor}28, 0 4px 24px rgba(0,0,0,0.08)`,
        }}
      >
        {/* Logo cluster */}
        <div className="relative mb-7">
          {/* Blurred glow halo */}
          <div
            aria-hidden="true"
            className="absolute -inset-4 rounded-3xl pointer-events-none blur-2xl"
            style={{ background: brandColor, opacity: 0.18 }}
          />

          {/* Logo tile */}
          <div
            className="loader-logo-float relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl text-2xl font-bold text-white"
            style={{
              background: brandColor,
              boxShadow:  `0 0 0 5px ${brandColor}28, 0 8px 32px ${brandColor}42`,
            }}
          >
            {/* Light-sweep shimmer — purely decorative */}
            <div
              aria-hidden="true"
              className="loader-shimmer absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.40) 50%, transparent 70%)',
              }}
            />

            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={tenantName}
                width={64}
                height={64}
                className="relative z-10 rounded-2xl object-cover"
              />
            ) : (
              <span className="relative z-10 select-none">{letter}</span>
            )}
          </div>
        </div>

        {/* Workspace name */}
        <p className="text-[13px] font-semibold leading-none text-[var(--brand-text)]">
          {tenantName}
        </p>
        <p className="mt-1.5 text-[11px] text-[var(--brand-muted)]">
          Preparing your workspace
        </p>

        {/* Progress bar */}
        <div
          className="mt-7 w-full overflow-hidden rounded-full bg-[var(--brand-border)]"
          style={{ height: 3 }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width:      `${progress}%`,
              background: `linear-gradient(90deg, ${brandColor}cc, ${brandColor})`,
              // Snap to 100% with a satisfying ease; otherwise ride rAF increments
              transition: progress >= 100 ? 'width 200ms ease-out' : 'width 80ms linear',
              willChange: 'width',
            }}
          />
        </div>
      </div>
    </div>
  )
}
