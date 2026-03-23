'use client'

/**
 * PrepareLoader — premium "Preparing your workspace" transition screen.
 *
 * Displays a branded loading card for a minimum of 3 seconds, then navigates
 * to the dashboard. Sets the `dashboard-loaded` session key so that the
 * BrandedLoader overlay does not double-fire on the subsequent dashboard load.
 */

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface PrepareLoaderProps {
  tenantName: string
  tenantSlug: string
  logoUrl: string | null
  brandColor: string
  updatedAt?: string
}

/** Append cache-buster to logo URL. */
function cacheBustLogo(url: string | null, updatedAt?: string): string | null {
  if (!url) return null
  const v = updatedAt ? new Date(updatedAt).getTime() : Date.now()
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}v=${v}`
}

// ── Timing ────────────────────────────────────────────────────────────────────

const DISPLAY_MS = 3000    // non-negotiable minimum
const NAV_DELAY  = 350     // pause after bar hits 100% before navigating
const STEP_INTERVAL = 900  // ms between status step rotations

const STATUS_STEPS = [
  'Preparing your workspace',
  'Loading your data',
  'Almost ready',
]

const QUOTES = [
  'Your AI receptionist never misses a call.',
  'Every call is an opportunity.',
  'Faster response, higher conversion.',
  'AI-powered growth, human touch.',
  'Your front desk, always on.',
]

// Must match the key used by BrandedLoader in loading-overlay.tsx
const DASHBOARD_SESSION_KEY = 'dashboard-loaded'

// ── Component ─────────────────────────────────────────────────────────────────

export function PrepareLoader({
  tenantName,
  tenantSlug,
  logoUrl,
  brandColor,
  updatedAt,
}: PrepareLoaderProps) {
  const router = useRouter()
  const resolvedLogoUrl = cacheBustLogo(logoUrl, updatedAt)
  const [progress, setProgress] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const quote = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], [])
  const letter = tenantName.charAt(0).toUpperCase()

  // ── Progress animation + navigation ──────────────────────────────────────
  useEffect(() => {
    setProgress(8) // subtle initial jump

    // rAF-driven progress: 8 → 85 over 85% of DISPLAY_MS (easeOut curve)
    const startTime = Date.now()
    const ANIM_RANGE = DISPLAY_MS * 0.85
    let rafId = 0

    const tick = () => {
      const elapsed = Date.now() - startTime
      const t = Math.min(elapsed / ANIM_RANGE, 1)
      const eased = 1 - Math.pow(1 - t, 3.5)
      setProgress(8 + eased * 77) // 8 → 85
      if (t < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    // After DISPLAY_MS → snap to 100%, then navigate
    const navTimer = setTimeout(() => {
      setProgress(100)

      // Prevent BrandedLoader from showing a second splash on dashboard load
      try {
        sessionStorage.setItem(DASHBOARD_SESSION_KEY, '1')
      } catch {
        /* sessionStorage blocked — acceptable */
      }

      setTimeout(() => {
        router.replace(`/dashboard?tenant=${encodeURIComponent(tenantSlug)}`)
      }, NAV_DELAY)
    }, DISPLAY_MS)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(navTimer)
    }
  }, [router, tenantSlug])

  // ── Status text rotation ─────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((i) => (i < STATUS_STEPS.length - 1 ? i + 1 : i))
    }, STEP_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[var(--brand-bg)]">
      {/* Gradient wash for depth (no dot-grid — clean premium look) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 70% 50% at 50% 40%, ${brandColor}08 0%, transparent 100%)`,
        }}
      />

      {/* Ambient radial glow — scaled for hero-size card */}
      <div
        aria-hidden="true"
        className="loader-ring-pulse absolute pointer-events-none"
        style={{
          width: 640,
          height: 640,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${brandColor}18 0%, ${brandColor}08 40%, transparent 68%)`,
        }}
      />

      {/* ── Hero card (2× larger — premium workspace transition) ───────── */}
      <div
        className="loader-card-enter relative z-10 flex w-[90vw] max-w-[720px] flex-col items-center rounded-3xl border border-[var(--brand-border)]/60 bg-[var(--brand-surface)]/95 backdrop-blur-sm px-8 py-14 sm:px-16 sm:py-16"
        style={{
          boxShadow: [
            `0 0 0 1px ${brandColor}08`,
            `0 32px 80px -16px ${brandColor}22`,
            '0 12px 48px rgba(0,0,0,0.07)',
            '0 2px 6px rgba(0,0,0,0.04)',
          ].join(', '),
        }}
      >
        {/* Logo cluster */}
        <div className="relative mb-10">
          {/* Blurred glow halo */}
          <div
            aria-hidden="true"
            className="absolute -inset-7 rounded-3xl pointer-events-none blur-2xl"
            style={{ background: brandColor, opacity: 0.16 }}
          />

          {/* Soft ring around logo */}
          <div
            aria-hidden="true"
            className="absolute -inset-3 rounded-[24px] pointer-events-none"
            style={{
              border: `1.5px solid ${brandColor}18`,
              opacity: 0.6,
            }}
          />

          {/* Logo tile — larger */}
          <div
            className="loader-logo-float relative flex h-[96px] w-[96px] items-center justify-center overflow-hidden rounded-2xl text-3xl font-bold"
            style={{
              background: resolvedLogoUrl ? '#ffffff' : brandColor,
              color: resolvedLogoUrl ? undefined : '#ffffff',
              boxShadow: `0 0 0 5px ${brandColor}20, 0 16px 48px ${brandColor}35`,
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
                width={96}
                height={96}
                className="relative z-10 rounded-2xl object-cover"
              />
            ) : (
              <span className="relative z-10 select-none">{letter}</span>
            )}
          </div>
        </div>

        {/* Workspace name — larger */}
        <p className="text-lg font-semibold leading-none text-[var(--brand-text)] tracking-tight">
          {tenantName}
        </p>

        {/* Staged status text */}
        <p
          className="mt-3 text-sm text-[var(--brand-muted)] transition-opacity duration-300"
          style={{ opacity: 0.7 }}
        >
          {STATUS_STEPS[stepIndex]}
        </p>

        {/* Progress bar — thicker */}
        <div className="mt-10 w-full max-w-sm">
          <div
            className="w-full overflow-hidden rounded-full bg-[var(--brand-border)]/60"
            style={{ height: 5 }}
          >
            <div
              className="relative h-full rounded-full overflow-hidden"
              style={{
                width: `${progress}%`,
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

        {/* Step dots — larger */}
        <div className="mt-5 flex items-center gap-2">
          {STATUS_STEPS.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-400"
              style={{
                width: i <= stepIndex ? 8 : 5,
                height: i <= stepIndex ? 8 : 5,
                background: i <= stepIndex ? brandColor : 'var(--brand-border)',
                opacity: i <= stepIndex ? 0.8 : 0.4,
              }}
            />
          ))}
        </div>

        {/* Rotating quote — larger text */}
        <p
          className="mt-8 text-xs text-[var(--brand-muted)] text-center italic leading-relaxed"
          style={{ opacity: 0.45, maxWidth: 320 }}
        >
          {quote}
        </p>
      </div>
    </div>
  )
}
