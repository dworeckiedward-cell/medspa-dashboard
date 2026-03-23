'use client'

/**
 * NavProgressBar — 2px brand-colored top bar that animates on route transitions.
 *
 * Detects navigation start via anchor clicks, completes when usePathname() changes.
 * No external dependencies. Works with Next.js App Router.
 */

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export function NavProgressBar() {
  const pathname = usePathname()
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const mountedRef = useRef(false)

  function clearTimers() {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  // Complete bar when pathname changes (skip initial mount)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    clearTimers()
    setWidth(100)
    const done = setTimeout(() => {
      setVisible(false)
      setWidth(0)
    }, 300)
    timersRef.current = [done]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Listen for anchor clicks to start bar
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      // Skip: external links, hash anchors, mailto, tel
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      // Start progress animation
      clearTimers()
      setVisible(true)
      setWidth(0)
      const t1 = setTimeout(() => setWidth(30), 30)
      const t2 = setTimeout(() => setWidth(60), 250)
      const t3 = setTimeout(() => setWidth(80), 700)
      timersRef.current = [t1, t2, t3]
    }

    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
        height: 2,
        width: `${width}%`,
        background: 'var(--brand-primary)',
        opacity: visible ? 1 : 0,
        pointerEvents: 'none',
        transition: [
          width === 0 ? '' : `width ${width === 100 ? '0.15s' : '0.4s'} ease`,
          'opacity 0.3s ease',
        ]
          .filter(Boolean)
          .join(', '),
      }}
    />
  )
}
