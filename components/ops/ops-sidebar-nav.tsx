'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Activity,
  DollarSign,
  AlertTriangle,
  Headphones,
  Handshake,
} from 'lucide-react'
import { OpsAccountMenu } from './ops-account-menu'

// ── Types ────────────────────────────────────────────────────────────────────

interface OpsSidebarNavProps {
  /** Operator email from server-resolved access */
  email?: string | null
}

// ── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'clients', label: 'All Clients', icon: Users },
  { id: 'usage', label: 'Usage Watchlist', icon: Activity },
  { id: 'financials', label: 'Financial Overview', icon: DollarSign },
  { id: 'alerts', label: 'Alerts Console', icon: AlertTriangle },
  { id: 'support', label: 'Support Requests', icon: Headphones },
  { id: 'partners', label: 'Partner Console', icon: Handshake },
] as const

// ── Component ────────────────────────────────────────────────────────────────

export function OpsSidebarNav({ email }: OpsSidebarNavProps) {
  const [activeId, setActiveId] = useState('overview')

  useEffect(() => {
    const handleScroll = () => {
      const sections = NAV_ITEMS.map(({ id }) => ({
        id,
        el: document.getElementById(id),
      })).filter((s) => s.el !== null)

      let current = 'overview'
      for (const { id, el } of sections) {
        if (el && el.getBoundingClientRect().top <= 120) {
          current = id
        }
      }
      setActiveId(current)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  return (
    <nav className="hidden lg:flex lg:flex-col w-52 shrink-0">
      <div className="sticky top-20 flex flex-col" style={{ maxHeight: 'calc(100vh - 6rem)' }}>
        {/* Servify OS label */}
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#71717a] px-3 mb-3">
          Navigation
        </p>

        {/* Navigation items */}
        <div className="space-y-0.5 flex-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = activeId === id
            return (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className={cn(
                  'group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-all duration-150 text-left',
                  isActive
                    ? 'bg-[#6366f1]/10 text-[#818cf8]'
                    : 'text-[#71717a] hover:text-[#f0f0f5] hover:bg-white/[0.04]',
                )}
              >
                {/* Active left bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-r-full bg-[#6366f1]" />
                )}
                <Icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-[#6366f1]' : 'text-[#71717a] group-hover:text-[#f0f0f5]')} />
                {label}
              </button>
            )
          })}
        </div>

        {/* Account menu at bottom */}
        <div className="mt-4 pt-3 border-t border-[#1e1e2e]">
          <OpsAccountMenu email={email ?? null} />
        </div>
      </div>
    </nav>
  )
}
