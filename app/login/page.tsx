'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, ArrowRight, Loader2, Mail } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { ServifyLogo } from '@/components/branding/servify-logo'

// ── Login page ──────────────────────────────────────────────────────────────
// Premium split-screen layout:
//  Left  → dark branding panel (near-black) with social proof metrics
//  Right → clean white form panel with email/password, Google OAuth, Magic Link

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

  // Magic link state
  const [magicLinkEmail, setMagicLinkEmail] = useState('')
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [magicLinkLoading, setMagicLinkLoading] = useState(false)
  const [magicLinkError, setMagicLinkError] = useState<string | null>(null)

  const callbackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : '/auth/callback'

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

      // Redirect to dashboard — resolveTenantAccess handles multi-tenant selection
      router.push('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setError(null)
    setLoading(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
        },
      })

      if (oauthError) {
        setError(oauthError.message)
        setLoading(false)
      }
      // Browser will redirect to Google — no need to handle success here
    } catch {
      setError('Failed to initiate Google login.')
      setLoading(false)
    }
  }

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault()
    setMagicLinkError(null)
    setMagicLinkLoading(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: magicLinkEmail,
        options: {
          emailRedirectTo: callbackUrl,
        },
      })

      if (otpError) {
        setMagicLinkError(otpError.message)
        setMagicLinkLoading(false)
        return
      }

      setMagicLinkSent(true)
    } catch {
      setMagicLinkError('Failed to send magic link.')
    } finally {
      setMagicLinkLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex bg-[#FAFAFA]">
      {/* ── Left branding panel (55%, desktop only) — DARK ──────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-[#0A0A0B]">
        {/* Dot grid texture */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'radial-gradient(circle, #FFFFFF 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Blue glow accent */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-500/[0.06] blur-[120px]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between px-10 xl:px-14 py-10 w-full">
          {/* Top — tag + logo */}
          <div className="space-y-6">
            <p className="text-[11px] tracking-[0.15em] uppercase text-[#2563EB] font-medium">
              Client Dashboard
            </p>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex items-center justify-center">
                <ServifyLogo size="xl" className="h-10 w-10" />
              </div>
            </div>
          </div>

          {/* Center — tagline + social proof */}
          <div className="space-y-10 max-w-lg">
            <div className="space-y-4">
              <h1 className="text-[40px] xl:text-[48px] font-bold tracking-[-0.035em] text-white leading-tight">
                AI-powered call
                <br />
                infrastructure for
                <br />
                <span className="text-[#2563EB]">healthcare.</span>
              </h1>
            </div>

            {/* Social proof cards */}
            <div className="flex flex-wrap gap-3">
              {PROOF_METRICS.map((metric) => (
                <div
                  key={metric.label}
                  className="flex-1 min-w-[120px] bg-white/[0.06] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-4"
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
          <div>
            <blockquote className="max-w-md">
              <p className="text-[14px] text-white/50 italic leading-relaxed">
                &ldquo;We went from missing 40% of after-hours calls to booking
                every single one. The ROI paid for itself in the first week.&rdquo;
              </p>
              <footer className="mt-3 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[11px] font-bold text-white/60">
                  SM
                </div>
                <span className="text-[13px] text-white/40">Dr. Sarah Mitchell, Luxe Aesthetics</span>
              </footer>
            </blockquote>
          </div>
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-5 py-10 sm:px-8 md:px-12 bg-white lg:border-l lg:border-[#E5E7EB]/40">
        <div className="w-full max-w-md mx-auto">
          {/* Mobile-only brand mark */}
          <div className="lg:hidden flex justify-center mb-10">
            <div className="w-14 h-14 rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex items-center justify-center">
              <ServifyLogo size="lg" className="h-7 w-7" />
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-1.5 mb-8">
            <h2 className="text-[24px] font-bold tracking-[-0.03em] text-[#0F172A]">
              Client Portal
            </h2>
            <p className="text-[14px] text-[#94A3B8]">
              Access your AI infrastructure dashboard
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="text-[13px] font-medium text-[#0F172A]"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="you@clinic.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#0F172A] placeholder:text-[#CBD5E1] transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="text-[13px] font-medium text-[#0F172A]"
                >
                  Password
                </label>
                <button
                  type="button"
                  className="text-[12px] text-[#2563EB] hover:underline"
                  tabIndex={-1}
                  onClick={() => {
                    // TODO: wire up forgot password flow
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 pr-11 text-[14px] text-[#0F172A] placeholder:text-[#CBD5E1] transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="button"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#C9CDD5] hover:text-[#6B7280] transition-colors"
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
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-[13px] text-red-600">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#2563EB] text-white font-semibold py-3 text-[14px] transition-all duration-150 hover:bg-[#1D4FD7] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm shadow-[#2563EB]/20"
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
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E5E7EB]/60" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[12px] text-[#94A3B8]">
                or
              </span>
            </div>
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full rounded-xl border border-[#E5E7EB] bg-white py-3 text-[14px] text-[#374151] hover:bg-[#F9FAFB] hover:border-[#D1D5DB] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
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
            Continue with Google
          </button>

          {/* Magic Link section */}
          <div className="mt-6 rounded-xl border border-[#E5E7EB]/60 bg-[#FAFAFA] p-4">
            <p className="text-[12px] font-medium text-[#64748B] mb-3 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Sign in with email link
            </p>
            {magicLinkSent ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
                <p className="text-[13px] text-emerald-700 font-medium">Check your email</p>
                <p className="text-[11px] text-emerald-600 mt-0.5">
                  We sent a sign-in link to <span className="font-medium">{magicLinkEmail}</span>
                </p>
              </div>
            ) : (
              <form onSubmit={handleMagicLink} className="flex gap-2">
                <input
                  type="email"
                  placeholder="you@clinic.com"
                  value={magicLinkEmail}
                  onChange={(e) => setMagicLinkEmail(e.target.value)}
                  required
                  disabled={magicLinkLoading}
                  className="flex-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={magicLinkLoading}
                  className="shrink-0 rounded-lg bg-[#0F172A] text-white px-3 py-2 text-[13px] font-medium hover:bg-[#1E293B] disabled:opacity-50 transition-colors"
                >
                  {magicLinkLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    'Send link'
                  )}
                </button>
              </form>
            )}
            {magicLinkError && (
              <p className="text-[11px] text-red-500 mt-2">{magicLinkError}</p>
            )}
          </div>

          {/* Below-card footer */}
          <div className="mt-10 space-y-4">
            <p className="text-center text-[13px] text-[#94A3B8]">
              Don&apos;t have access?{' '}
              <a
                href="https://servifylabs.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2563EB] hover:underline font-medium"
              >
                Contact sales
              </a>
            </p>

            {/* Powered by */}
            <div className="flex items-center justify-center gap-2">
              <ServifyLogo size="sm" />
              <span className="text-[12px] text-[#C9CDD5]">Powered by Servify</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
