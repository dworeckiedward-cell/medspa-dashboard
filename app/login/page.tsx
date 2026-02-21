'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ── Login page ──────────────────────────────────────────────────────────────
// Premium split-screen layout:
//  Left  → brand hero with animated dot grid + value proposition
//  Right → sign-in form with email/password, loading state, error handling

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
      {/* ── Left hero panel ─────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Dot grid texture */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Gradient glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 30% 50%, rgba(37,99,235,0.15) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(139,92,246,0.1) 0%, transparent 50%)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Top — brand mark */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
              <Sparkles className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg leading-tight">Servify</p>
              <p className="text-white/50 text-xs leading-tight">AI Receptionist</p>
            </div>
          </div>

          {/* Center — value proposition */}
          <div className="space-y-6 max-w-md">
            <h1 className="text-4xl font-bold text-white leading-tight login-hero-enter">
              Your AI receptionist
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">
                never misses a call.
              </span>
            </h1>
            <p className="text-white/60 text-base leading-relaxed login-hero-enter login-hero-delay-1">
              Book more appointments, recover missed calls, and prove ROI —
              all on autopilot. Your dashboard shows every dollar earned.
            </p>

            {/* Stats row */}
            <div className="flex gap-8 login-hero-enter login-hero-delay-2">
              {[
                { value: '24/7', label: 'Availability' },
                { value: '< 3s', label: 'Response time' },
                { value: '95%', label: 'Booking rate' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-2xl font-bold text-white tabular-nums">{stat.value}</p>
                  <p className="text-white/40 text-xs mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom — testimonial */}
          <div className="login-hero-enter login-hero-delay-3">
            <blockquote className="border-l-2 border-blue-400/30 pl-4">
              <p className="text-white/70 text-sm italic leading-relaxed">
                &ldquo;We went from missing 40% of after-hours calls to booking
                every single one. The ROI paid for itself in the first week.&rdquo;
              </p>
              <footer className="mt-2 text-white/40 text-xs">
                — Dr. Sarah Mitchell, Luxe Aesthetics
              </footer>
            </blockquote>
          </div>
        </div>
      </div>

      {/* ── Right form panel ────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-[var(--brand-bg)]">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile-only brand mark */}
          <div className="lg:hidden flex items-center gap-3 justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-primary)]/10 border border-[var(--brand-border)]">
              <Sparkles className="h-5 w-5 text-[var(--brand-primary)]" />
            </div>
            <div>
              <p className="text-[var(--brand-text)] font-semibold text-lg leading-tight">Servify</p>
              <p className="text-[var(--brand-muted)] text-xs leading-tight">AI Receptionist</p>
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-[var(--brand-text)]">Welcome back</h2>
            <p className="text-sm text-[var(--brand-muted)]">
              Sign in to your dashboard to see how your AI receptionist is performing.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <label
                htmlFor="login-email"
                className="text-xs font-medium text-[var(--brand-text)]"
              >
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--brand-muted)]" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@clinic.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="pl-10 h-11"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="text-xs font-medium text-[var(--brand-text)]"
                >
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs text-[var(--brand-primary)] hover:underline"
                  tabIndex={-1}
                  onClick={() => {
                    // TODO: wire up forgot password flow
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--brand-muted)]" />
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="pl-10 pr-10 h-11"
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
              className="w-full h-11 text-sm font-semibold"
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
              <div className="w-full border-t border-[var(--brand-border)]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[var(--brand-bg)] px-3 text-xs text-[var(--brand-muted)]">
                or continue with
              </span>
            </div>
          </div>

          {/* Social login scaffold */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 text-sm border-[var(--brand-border)] text-[var(--brand-text)] hover:bg-[var(--brand-surface)]"
            disabled={loading}
            onClick={() => {
              // TODO: wire up Google OAuth via Supabase
            }}
          >
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
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

          {/* Footer */}
          <p className="text-center text-xs text-[var(--brand-muted)]">
            Don&apos;t have an account?{' '}
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
          <div className="flex items-center justify-center gap-1.5 opacity-50 hover:opacity-80 transition-opacity">
            <Sparkles className="h-3 w-3 text-[var(--brand-accent)]" />
            <span className="text-[10px] text-[var(--brand-muted)]">Powered by Servify</span>
          </div>
        </div>
      </div>
    </main>
  )
}
