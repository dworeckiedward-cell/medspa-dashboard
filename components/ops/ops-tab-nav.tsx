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
    <nav className="border-b border-[#1e1e2e] bg-[#0a0a0f]/80 backdrop-blur-sm">
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
                    ? 'text-[#818cf8]'
                    : 'text-[#71717a] hover:text-[#f0f0f5]',
                )}
              >
                <Icon
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    isActive ? 'text-[#6366f1]' : 'text-[#71717a] group-hover:text-[#f0f0f5]',
                  )}
                />
                {label}
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-t-full bg-[#6366f1]" />
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
