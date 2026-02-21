'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

// ── Auth callback ──────────────────────────────────────────────────────────
// Handles OAuth redirect (code exchange) and magic link (hash tokens).
// Shows a branded loading state while processing.

function parseHash(hash: string) {
  const h = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(h)
  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
  }
}

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const supabase = getSupabaseBrowserClient()
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')

        if (code) {
          const { error: err } = await supabase.auth.exchangeCodeForSession(code)
          if (err) throw err
          router.replace('/dashboard?tenant=luxe')
          return
        }

        const { access_token, refresh_token } = parseHash(window.location.hash)
        if (access_token && refresh_token) {
          const { error: err } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          })
          if (err) throw err
          router.replace('/dashboard?tenant=luxe')
          return
        }

        // No code or tokens — redirect to login
        router.replace('/login')
      } catch {
        setError('Authentication failed. Redirecting to login…')
        setTimeout(() => router.replace('/login'), 2000)
      }
    })()
  }, [router])

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--brand-bg)]">
      <div className="flex flex-col items-center gap-5 text-center">
        {/* Logo */}
        <div className="auth-pulse">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-primary)]/10 border border-[var(--brand-border)]">
            <Sparkles className="h-7 w-7 text-[var(--brand-primary)]" />
          </div>
        </div>

        {/* Status text */}
        {error ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--brand-text)]">Signing you in…</p>
            <p className="text-xs text-[var(--brand-muted)]">
              Setting up your dashboard
            </p>
          </div>
        )}

        {/* Progress dots */}
        {!error && (
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-[var(--brand-primary)]"
                style={{
                  animation: 'auth-pulse 1.4s ease-in-out infinite',
                  animationDelay: `${i * 200}ms`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
