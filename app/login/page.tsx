'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, ArrowRight, Loader2, ChevronLeft, ShieldCheck, Lock, Activity } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { ServifyLogo } from '@/components/branding/servify-logo'

// ── Login page ──────────────────────────────────────────────────────────────
// Premium split-screen layout:
//  Left  → dark branding panel (near-black) with social proof metrics
//  Right → clean white form panel with email/password

// ── Social proof metrics shown on left panel ────────────────────────────────


export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)

  // Read ?error= from the URL (set by auth/callback after allowlist rejection)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('error')
    if (code === 'not_allowed') {
      setError('Access not enabled for this Google account. Contact support.')
    } else if (code === 'auth_failed') {
      setError('Authentication failed. Please try again.')
    }
  }, [])

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

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault()
    setForgotError(null)
    setForgotLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error: err } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: 'https://app.servifylabs.com/auth/reset-password',
      })
      if (err) {
        setForgotError(err.message)
      } else {
        setForgotSent(true)
      }
    } catch {
      setForgotError('Failed to send reset link. Please try again.')
    } finally {
      setForgotLoading(false)
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
                <ServifyLogo size="xl" className="h-12 w-12" />
              </div>
            </div>
          </div>

          {/* Center — tagline + social proof */}
          <div className="space-y-10 max-w-lg">
            <div className="space-y-4">
              <h1 className="text-[40px] xl:text-[48px] font-bold tracking-[-0.035em] text-white leading-tight">
                Never miss a
                <br />
                patient call again.
              </h1>
              <p className="text-[15px] text-white/50 leading-relaxed max-w-sm">
                Your AI receptionist answers 24/7, qualifies leads, and sends booking links — while you focus on care.
              </p>
            </div>

          </div>

          {/* Bottom — trust signals */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-white/30">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="text-[11px] tracking-wide">HIPAA-aligned</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-2 text-white/30">
              <Lock className="h-3.5 w-3.5" />
              <span className="text-[11px] tracking-wide">End-to-end encrypted</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-2 text-white/30">
              <Activity className="h-3.5 w-3.5" />
              <span className="text-[11px] tracking-wide">99.9% uptime SLA</span>
            </div>
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
              Sign in to your practice dashboard
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
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#0F172A] placeholder:text-[#94A3B8] transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50"
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
                  onClick={() => { setShowForgotPassword(true); setForgotSent(false); setForgotError(null) }}
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
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 pr-11 text-[14px] text-[#0F172A] placeholder:text-[#94A3B8] transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50"
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

            {/* Trust bar */}
            <div className="flex items-center justify-center gap-4 pt-1">
              <span className="text-[11px] text-[#CBD5E1] flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#94A3B8]" />
                Secure access
              </span>
              <span className="text-[#E2E8F0]">·</span>
              <span className="text-[11px] text-[#CBD5E1] flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-[#94A3B8]" />
                Encrypted
              </span>
              <span className="text-[#E2E8F0]">·</span>
              <span className="text-[11px] text-[#CBD5E1] flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-[#94A3B8]" />
                99.9% uptime
              </span>
            </div>
          </form>

          {/* Forgot Password panel */}
          {showForgotPassword && (
            <div className="mt-6 rounded-xl border border-[#E5E7EB]/60 bg-[#FAFAFA] p-4">
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="text-[#94A3B8] hover:text-[#64748B] transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-[12px] font-medium text-[#64748B]">Reset your password</p>
              </div>
              {forgotSent ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
                  <p className="text-[13px] text-emerald-700 font-medium">Check your email</p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">
                    We sent a password reset link to <span className="font-medium">{forgotEmail}</span>
                  </p>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="flex gap-2">
                  <input
                    type="email"
                    placeholder="you@clinic.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    disabled={forgotLoading}
                    className="flex-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="shrink-0 rounded-lg bg-[#0F172A] text-white px-3 py-2 text-[13px] font-medium hover:bg-[#1E293B] disabled:opacity-50 transition-colors"
                  >
                    {forgotLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Send link'}
                  </button>
                </form>
              )}
              {forgotError && (
                <p className="text-[11px] text-red-500 mt-2">{forgotError}</p>
              )}
            </div>
          )}

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
