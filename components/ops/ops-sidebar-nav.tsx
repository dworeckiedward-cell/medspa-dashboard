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

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'clients', label: 'All Clients', icon: Users },
  { id: 'usage', label: 'Usage Watchlist', icon: Activity },
  { id: 'financials', label: 'Financial Overview', icon: DollarSign },
  { id: 'alerts', label: 'Alerts Console', icon: AlertTriangle },
  { id: 'support', label: 'Support Requests', icon: Headphones },
  { id: 'partners', label: 'Partner Console', icon: Handshake },
] as const

export function OpsSidebarNav() {
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
    <nav className="hidden lg:block w-48 shrink-0">
      <div className="sticky top-20 space-y-0.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => scrollTo(id)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors text-left',
              activeId === id
                ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-surface)]',
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
          </button>
        ))}
      </div>
    </nav>
  )
}
