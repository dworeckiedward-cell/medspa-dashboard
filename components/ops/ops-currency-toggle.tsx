'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { cn } from '@/lib/utils'

// ── Context ─────────────────────────────────────────────────────────────────
interface CurrencyCtx {
  currency: 'USD' | 'PLN'
  /** Multiplier: 1 for USD, live rate for PLN */
  rate: number
  toggle: () => void
}

const CurrencyContext = createContext<CurrencyCtx>({
  currency: 'USD',
  rate: 1,
  toggle: () => {},
})

export function useOpsCurrency() {
  return useContext(CurrencyContext)
}

// ── Provider ────────────────────────────────────────────────────────────────
export function OpsCurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<'USD' | 'PLN'>('USD')
  const [plnRate, setPlnRate] = useState<number | null>(null)

  useEffect(() => {
    // Fetch live USD→PLN rate once
    fetch('https://api.exchangerate-host.com/latest?base=USD&symbols=PLN')
      .then((r) => r.json())
      .then((data) => {
        const rate = data?.rates?.PLN ?? data?.conversion_rates?.PLN
        if (typeof rate === 'number' && rate > 0) {
          setPlnRate(rate)
        }
      })
      .catch(() => {
        // Fallback rate if API fails
        setPlnRate(4.05)
      })
  }, [])

  const rate = currency === 'PLN' && plnRate ? plnRate : 1

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        rate,
        toggle: () => setCurrency((c) => (c === 'USD' ? 'PLN' : 'USD')),
      }}
    >
      {children}
    </CurrencyContext.Provider>
  )
}

// ── Toggle button ───────────────────────────────────────────────────────────
export function OpsCurrencyToggle() {
  const { currency, toggle } = useOpsCurrency()

  return (
    <button
      onClick={toggle}
      className={cn(
        'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
        'border border-[var(--brand-border)] bg-[var(--brand-surface)] hover:bg-[var(--brand-border)]',
        'text-[var(--brand-text)]',
      )}
      title={`Switch to ${currency === 'USD' ? 'PLN' : 'USD'}`}
    >
      <span className={cn(
        'transition-opacity',
        currency === 'USD' ? 'opacity-100' : 'opacity-40',
      )}>$</span>
      <span className="text-[var(--brand-muted)]">/</span>
      <span className={cn(
        'transition-opacity',
        currency === 'PLN' ? 'opacity-100' : 'opacity-40',
      )}>zł</span>
    </button>
  )
}
