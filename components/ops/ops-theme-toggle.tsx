'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

type OpsTheme = 'light' | 'dark'

const LIGHT = {
  '--brand-bg': '#f8f9fb',
  '--brand-surface': '#ffffff',
  '--brand-border': '#e4e4e7',
  '--brand-text': '#18181b',
  '--brand-muted': '#71717a',
  '--brand-primary': '#6366f1',
  '--brand-accent': '#0d9488',
} as const

const DARK = {
  '--brand-bg': '#0a0a0f',
  '--brand-surface': '#12121a',
  '--brand-border': '#1e1e2e',
  '--brand-text': '#f0f0f5',
  '--brand-muted': '#71717a',
  '--brand-primary': '#6366f1',
  '--brand-accent': '#0d9488',
} as const

const ThemeContext = createContext<{ theme: OpsTheme; toggle: () => void }>({
  theme: 'light',
  toggle: () => {},
})

export function useOpsTheme() {
  return useContext(ThemeContext)
}

export function OpsThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<OpsTheme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('ops-theme') as OpsTheme | null
    if (saved === 'dark' || saved === 'light') setTheme(saved)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) localStorage.setItem('ops-theme', theme)
  }, [theme, mounted])

  const vars = theme === 'dark' ? DARK : LIGHT

  return (
    <ThemeContext.Provider value={{ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }}>
      <div
        className={theme === 'dark' ? 'dark' : ''}
        style={{
          ...Object.fromEntries(Object.entries(vars)),
          background: vars['--brand-bg'],
          minHeight: '100dvh',
          color: vars['--brand-text'],
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

export function OpsThemeToggle() {
  const { theme, toggle } = useOpsTheme()

  return (
    <button
      onClick={toggle}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
        'border border-[var(--brand-border)] bg-[var(--brand-surface)] hover:bg-[var(--brand-border)]',
        'text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
      )}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  )
}
