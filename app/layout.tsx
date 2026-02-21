import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import { getTenantBySlug, getTenantByCustomDomain } from '@/lib/tenant/get-tenant-config'
import type { Client } from '@/types/database'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'MedSpa Dashboard',
  description: 'AI Receptionist Performance Dashboard',
}

/**
 * Root Layout — Server Component.
 *
 * 1. Reads the tenant slug injected by middleware (x-tenant-slug header)
 * 2. Fetches the full tenant config from Supabase
 * 3. Injects CSS variables into :root for white-label branding
 *
 * Changing a tenant's brand_color in Supabase → instant rebrand on next request.
 * Zero code changes required.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = headers()
  const tenantSlug = headersList.get('x-tenant-slug') ?? ''
  const host = headersList.get('host') ?? ''

  let tenant: Client | null = null

  if (tenantSlug) {
    tenant = await getTenantBySlug(tenantSlug)
  }

  // Fallback: custom domain resolution (e.g. portal.luxeclinic.com)
  if (!tenant && host) {
    tenant = await getTenantByCustomDomain(host.split(':')[0])
  }

  const brandColor = tenant?.brand_color ?? '#2563EB'
  const accentColor = tenant?.accent_color ?? '#8B5CF6'
  // Tenant default used only as fallback when user has no localStorage preference.
  const tenantDefaultDark = (tenant?.theme_mode ?? 'light') !== 'light'

  // Inject brand vars in a single <style> block so the .dark selector wins over
  // :root when the dark class is present (same specificity → later wins).
  // primary/accent are constant across themes; structural palette switches.
  const themeCSS =
    `:root{--brand-primary:${brandColor};--brand-accent:${accentColor};` +
    `--brand-bg:#F8FAFC;--brand-surface:#FFFFFF;--brand-border:#E4E4E7;` +
    `--brand-text:#0A0A0B;--brand-muted:#6B7280}` +
    `.dark{--brand-bg:#0A0A0F;--brand-surface:#12121A;--brand-border:#1E1E2E;` +
    `--brand-text:#E2E8F0;--brand-muted:#64748B}`

  // Blocking script: runs before React hydration to apply dark class immediately.
  // Prevents a flash when user's localStorage preference differs from tenant default.
  const themeScript =
    `(function(){try{var s=localStorage.getItem('dashboard-theme'),` +
    `p=window.matchMedia('(prefers-color-scheme: dark)').matches,` +
    `d=s==='dark'||(s==='system'&&p)||(!s&&${tenantDefaultDark});` +
    `if(d)document.documentElement.classList.add('dark');}catch(e){}})();`

  return (
    // suppressHydrationWarning: the blocking script above may add 'dark' to <html>
    // before React hydrates — React would otherwise warn about the class mismatch.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Tenant CSS variables — both light (:root) and dark (.dark) in one block */}
        <style dangerouslySetInnerHTML={{ __html: themeCSS }} />
        {/* Apply stored theme preference before first paint — no FOUC */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${inter.variable} font-sans bg-[var(--brand-bg)] text-[var(--brand-text)] antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
