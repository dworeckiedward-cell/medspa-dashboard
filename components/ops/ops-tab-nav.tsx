'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  DollarSign,
  Headphones,
} from 'lucide-react'

const TABS = [
  { href: '/ops/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/ops/clients', label: 'Clients', icon: Users },
  { href: '/ops/alerts', label: 'Alerts', icon: AlertTriangle },
  { href: '/ops/financials', label: 'Financials', icon: DollarSign },
  { href: '/ops/support', label: 'Support', icon: Headphones },
] as const

export function OpsTabNav() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-[var(--brand-border)] bg-[var(--brand-bg)]/80 backdrop-blur-sm">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 overflow-x-auto scrollbar-none -mb-px">
          {TABS.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href || (href !== '/ops/overview' && pathname.startsWith(href + '/'))
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'group relative flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150',
                  isActive
                    ? 'text-[var(--brand-primary)]'
                    : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
                )}
              >
                <Icon
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    isActive ? 'text-[var(--brand-primary)]' : 'text-[var(--brand-muted)] group-hover:text-[var(--brand-text)]',
                  )}
                />
                {label}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-t-full bg-[var(--brand-primary)]" />
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
