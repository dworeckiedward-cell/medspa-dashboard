'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Phone,
  Settings,
  Menu,
  X,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildDashboardHref } from '@/lib/dashboard/link'
import type { Client } from '@/types/database'

interface SidebarProps {
  tenant: Client
}

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Call Logs', href: '/dashboard#calls', icon: Phone },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function Sidebar({ tenant }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  const logoLetter = tenant.name.charAt(0).toUpperCase()

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo + Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[var(--brand-border)]">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white font-bold text-sm"
          style={{ background: 'var(--brand-primary)' }}
        >
          {tenant.logo_url ? (
            <Image
              src={tenant.logo_url}
              alt={tenant.name}
              width={36}
              height={36}
              className="rounded-lg object-cover"
            />
          ) : (
            logoLetter
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-[var(--brand-text)] truncate leading-tight">
            {tenant.name}
          </p>
          <p className="text-xs text-[var(--brand-muted)] leading-tight mt-0.5">
            AI Receptionist
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon
          // Strip hash fragment before comparing against pathname
          // (usePathname() never includes hash)
          const hrefPath = item.href.split('#')[0]
          const isActive =
            pathname === hrefPath ||
            (hrefPath !== '/dashboard' && pathname.startsWith(hrefPath))
          return (
            <Link
              key={item.label}
              href={buildDashboardHref(item.href, tenant.slug)}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-[var(--brand-primary)]/15 text-[var(--brand-primary)]'
                  : 'text-[var(--brand-muted)] hover:bg-[var(--brand-primary)]/10 hover:text-[var(--brand-text)]',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--brand-border)] px-5 py-4">
        <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity duration-200">
          <Sparkles className="h-3.5 w-3.5 text-[var(--brand-accent)]" />
          <span className="text-xs text-[var(--brand-muted)]">Powered by Servify</span>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-[var(--brand-border)] bg-[var(--brand-surface)] transition-colors duration-200">
        <SidebarContent />
      </aside>

      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 rounded-md p-2 text-[var(--brand-muted)] hover:text-[var(--brand-text)] bg-[var(--brand-surface)] border border-[var(--brand-border)] shadow-sm"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed left-0 top-0 z-50 h-full w-60 flex flex-col border-r border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-xl">
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  )
}
