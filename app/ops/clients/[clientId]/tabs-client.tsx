'use client'

import { useRouter, usePathname } from 'next/navigation'
import { cn, polish } from '@/lib/utils'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'branding', label: 'Branding' },
  { key: 'ai', label: 'AI Control' },
  { key: 'errors', label: 'Errors' },
] as const

interface OpsClientDetailsTabsProps {
  clientId: string
  activeTab: string
}

export function OpsClientDetailsTabs({ clientId, activeTab }: OpsClientDetailsTabsProps) {
  const router = useRouter()
  const pathname = usePathname()

  function goToTab(tab: string) {
    const base = pathname.split('?')[0]
    router.push(tab === 'overview' ? base : `${base}?tab=${tab}`)
  }

  return (
    <div className="border-b border-[var(--brand-border)] bg-[var(--brand-surface)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex">
        {TABS.map((t) => {
          const isActive = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => goToTab(t.key)}
              className={cn(
                'relative px-4 py-3 text-[13px] font-medium transition-colors duration-150',
                polish.focusRing,
                isActive
                  ? 'text-[var(--brand-primary)]'
                  : 'text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
              )}
            >
              {t.label}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-t-full bg-[var(--brand-primary)]" />
              )}
            </button>
          )
        })}
        {/* Financials links to existing page */}
        <a
          href={`/ops/clients/${clientId}/financials`}
          className="px-4 py-3 text-[13px] font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
        >
          Financials
        </a>
      </div>
    </div>
  )
}
