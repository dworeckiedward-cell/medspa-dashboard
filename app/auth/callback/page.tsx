'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

// ── Auth callback ──────────────────────────────────────────────────────────
// Handles OAuth redirect (code exchange) and magic link (hash tokens).
// After session is established, resolves tenant count to decide redirect target:
//   0 tenants   → /dashboard (will show "no workspace" screen)
//   1 tenant    → /dashboard (auto-resolved by resolveTenantAccess)
//   2+ tenants  → /dashboard/select-tenant

function parseHash(hash: string) {
  const h = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(h)
  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
  }
}

async function resolvePostLoginRedirect(supabase: ReturnType<typeof getSupabaseBrowserClient>): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return '/dashboard'

    // Check how many tenants this user has access to
    const { data: memberships } = await supabase
      .from('user_tenants')
      .select('client_id')
      .eq('user_id', user.id)

    const count = memberships?.length ?? 0

    if (count === 0) return '/dashboard'
    if (count === 1) return '/dashboard'
    return '/dashboard/select-tenant'
  } catch {
    // If user_tenants doesn't exist or query fails, fall back to dashboard
    return '/dashboard'
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
          const target = await resolvePostLoginRedirect(supabase)
          router.replace(target)
          return
        }

        const { access_token, refresh_token } = parseHash(window.location.hash)
        if (access_token && refresh_token) {
          const { error: err } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          })
          if (err) throw err
          const target = await resolvePostLoginRedirect(supabase)
          router.replace(target)
          return
        }

        // No code or tokens — redirect to login
        router.replace('/login')
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[auth/callback] Error:', err)
        }
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
