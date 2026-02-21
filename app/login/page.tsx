'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ServifyLogo } from '@/components/branding/servify-logo'

// ── Login page ──────────────────────────────────────────────────────────────
// Premium split-screen layout (60/40):
//  Left  → dark brand hero with social proof metrics + testimonial
//  Right → clean form card with email/password sign-in

// ── Social proof metrics shown on left panel ────────────────────────────────

const PROOF_METRICS = [
  { value: '12,400+', label: 'Calls handled' },
  { value: '98.7%', label: 'Uptime' },
  { value: '< 3s', label: 'Avg response' },
] as const

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(
          authError.message === 'Invalid login credentials'
            ? 'Invalid email or password. Please try again.'
            : authError.message,
        )
        setLoading(false)
        return
      }

      // Redirect to dashboard — tenant slug is resolved by middleware
      router.push('/dashboard?tenant=luxe')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex">
      {/* ── Left hero panel (60%) ──────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[60%] relative overflow-hidden bg-gradient-to-br from-[#09090B] to-[#0F172A]">
        {/* Dot grid texture */}
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Gradient orbs */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 25% 40%, rgba(37,99,235,0.12) 0%, transparent 55%), radial-gradient(ellipse at 75% 75%, rgba(139,92,246,0.08) 0%, transparent 50%)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-14 w-full">
          {/* Top — brand lockup */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/[0.08]">
              <ServifyLogo size="md" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg leading-tight tracking-[-0.01em]">Servify</p>
              <p className="text-white/40 text-[11px] leading-tight">AI Infrastructure</p>
            </div>
          </div>

          {/* Center — tagline + social proof */}
          <div className="space-y-10 max-w-lg">
            <div className="space-y-4 login-hero-enter">
              <p className="text-sm font-medium uppercase tracking-widest text-blue-400/80">
                Client Dashboard
              </p>
              <h1 className="text-[2.75rem] font-semibold text-white leading-[1.1] tracking-[-0.035em]">
                AI-powered call
                <br />
                infrastructure for
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">
                  healthcare.
                </span>
              </h1>
            </div>

            {/* Social proof glass cards */}
            <div className="flex gap-3 login-hero-enter login-hero-delay-1">
              {PROOF_METRICS.map((metric) => (
                <div
                  key={metric.label}
                  className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm px-4 py-3"
                >
                  <p className="text-xl font-semibold text-white tabular-nums tracking-tight">
                    {metric.value}
                  </p>
                  <p className="text-white/40 text-[11px] mt-0.5">{metric.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom — testimonial */}
          <div className="login-hero-enter login-hero-delay-2">
            <blockquote className="border-l-2 border-white/10 pl-4 max-w-md">
              <p className="text-white/50 text-sm leading-relaxed">
                &ldquo;We went from missing 40% of after-hours calls to booking
                every single one. The ROI paid for itself in the first week.&rdquo;
              </p>
              <footer className="mt-2.5 flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/60">
                  SM
                </div>
                <span className="text-white/35 text-xs">Dr. Sarah Mitchell, Luxe Aesthetics</span>
              </footer>
            </blockquote>
          </div>
        </div>
      </div>

      {/* ── Right form panel (40%) ─────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-[#FAFAFA] dark:bg-[var(--brand-bg)]">
        <div className="w-full max-w-[380px]">
          {/* Mobile-only brand mark */}
          <div className="lg:hidden flex items-center gap-3 justify-center mb-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-primary)]/10 border border-[var(--brand-border)]">
              <ServifyLogo size="md" />
            </div>
            <div>
              <p className="text-[var(--brand-text)] font-semibold text-lg leading-tight">Servify</p>
              <p className="text-[var(--brand-muted)] text-xs leading-tight">AI Infrastructure</p>
            </div>
          </div>

          {/* Form card */}
          <div className="rounded-2xl border border-[var(--brand-border)]/60 bg-white dark:bg-[var(--brand-surface)] shadow-xl shadow-black/[0.03] dark:shadow-black/20 p-8 space-y-6">
            {/* Heading */}
            <div className="space-y-1.5">
              <h2 className="text-xl font-semibold text-[var(--brand-text)] tracking-[-0.035em]">
                Client Portal
              </h2>
              <p className="text-[13px] text-[var(--brand-muted)] leading-relaxed">
                Access your AI infrastructure dashboard
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="login-email"
                  className="text-[13px] font-medium text-[var(--brand-text)]"
                >
                  Email
                </label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@clinic.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11 px-3.5 border-[#E5E7EB] dark:border-[var(--brand-border)] focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500/40"
                  disabled={loading}
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="login-password"
                    className="text-[13px] font-medium text-[var(--brand-text)]"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    className="text-[12px] text-[var(--brand-primary)] hover:underline"
                    tabIndex={-1}
                    onClick={() => {
                      // TODO: wire up forgot password flow
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-11 px-3.5 pr-10 border-[#E5E7EB] dark:border-[var(--brand-border)] focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500/40"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 px-3 py-2.5">
                  <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                variant="brand"
                size="lg"
                className="w-full h-11 text-sm font-semibold rounded-lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--brand-border)]/60" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white dark:bg-[var(--brand-surface)] px-3 text-xs text-[var(--brand-muted)]">
                  or
                </span>
              </div>
            </div>

            {/* Social login — Google OAuth (not yet configured) */}
            <div className="relative group">
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 text-sm border-[#E5E7EB] dark:border-[var(--brand-border)] text-[var(--brand-muted)] cursor-not-allowed opacity-50 rounded-lg"
                disabled
                aria-label="Sign in with Google (coming soon)"
              >
                <svg className="h-4 w-4 mr-2 grayscale" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </Button>
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[var(--brand-surface)] border border-[var(--brand-border)] px-2 py-0.5 text-[10px] text-[var(--brand-muted)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                SSO coming soon
              </span>
            </div>
          </div>

          {/* Below-card footer */}
          <div className="mt-8 space-y-4">
            <p className="text-center text-[13px] text-[var(--brand-muted)]">
              Don&apos;t have access?{' '}
              <button
                type="button"
                className="text-[var(--brand-primary)] hover:underline font-medium"
                onClick={() => {
                  // TODO: wire up signup flow
                }}
              >
                Contact sales
              </button>
            </p>

            {/* Powered by */}
            <div className="flex items-center justify-center gap-1.5 opacity-40 hover:opacity-70 transition-opacity">
              <ServifyLogo size="sm" />
              <span className="text-[10px] text-[var(--brand-muted)]">Powered by Servify</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
