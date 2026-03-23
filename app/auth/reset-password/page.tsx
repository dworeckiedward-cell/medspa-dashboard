'use client'

import { useState, type FormEvent, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, Check } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { ServifyLogo } from '@/components/branding/servify-logo'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Exchange the recovery code from the URL for a session.
  // Supabase sends ?code=xxx on password reset links.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).catch(() => {
        setError('Invalid or expired reset link. Please request a new one.')
      })
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) {
        setError(err.message)
      } else {
        setDone(true)
        setTimeout(() => router.replace('/dashboard'), 2000)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-5">
      <div className="w-full max-w-sm">
        {/* Brand mark */}
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex items-center justify-center">
            <ServifyLogo size="lg" className="h-7 w-7" />
          </div>
        </div>

        <div className="space-y-1.5 mb-8 text-center">
          <h2 className="text-[22px] font-bold tracking-[-0.03em] text-[#0F172A]">Set new password</h2>
          <p className="text-[14px] text-[#94A3B8]">Choose a strong password for your account</p>
        </div>

        {done ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
            <Check className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
            <p className="text-[14px] font-medium text-emerald-700">Password updated!</p>
            <p className="text-[12px] text-emerald-600 mt-0.5">Redirecting to dashboard…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[#0F172A]">New password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={loading}
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 pr-11 text-[14px] text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#C9CDD5] hover:text-[#6B7280] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[#0F172A]">Confirm password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Repeat your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                disabled={loading}
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-[13px] text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#2563EB] text-white font-semibold py-3 text-[14px] hover:bg-[#1D4FD7] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm shadow-[#2563EB]/20"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-[12px] text-[#94A3B8]">
          Back to{' '}
          <a href="/login" className="text-[#2563EB] hover:underline font-medium">
            sign in
          </a>
        </p>
      </div>
    </main>
  )
}
