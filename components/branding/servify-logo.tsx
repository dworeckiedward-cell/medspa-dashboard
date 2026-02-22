'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { ServifyMark } from './servify-mark'

/**
 * ServifyLogo — primary Servify brand component.
 *
 * Uses the real PNG logo asset via Next.js <Image />.
 * Falls back to the SVG ServifyMark if the image fails to load.
 *
 * Variants:
 *  - "icon"    → logo image only
 *  - "lockup"  → logo + "Servify" wordmark + optional subtitle
 *
 * Sizes:
 *  - "sm"  → 14px icon (powered-by rows, footers)
 *  - "md"  → 20px icon (default)
 *  - "lg"  → 32px icon (hero, login panels)
 */

const LOGO_SRC = '/branding/servify-logo.png'

const SIZE_MAP = {
  sm: { px: 14, icon: 'h-3.5 w-3.5', text: 'text-xs', subtitle: 'text-[9px]' },
  md: { px: 20, icon: 'h-5 w-5', text: 'text-base', subtitle: 'text-[10px]' },
  lg: { px: 32, icon: 'h-8 w-8', text: 'text-lg', subtitle: 'text-xs' },
  xl: { px: 48, icon: 'h-12 w-12', text: 'text-xl', subtitle: 'text-sm' },
} as const

interface ServifyLogoProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** icon = image only, lockup = image + wordmark text */
  variant?: 'icon' | 'lockup'
  /** Optional subtitle below the wordmark (e.g. "AI Infrastructure") */
  subtitle?: string
  /** Class for the outer wrapper */
  className?: string
  /** Class for the wordmark text (e.g. text color) */
  textClassName?: string
  /** Class for the subtitle text */
  subtitleClassName?: string
}

export function ServifyLogo({
  size = 'md',
  variant = 'icon',
  subtitle,
  className,
  textClassName,
  subtitleClassName,
}: ServifyLogoProps) {
  const [imgError, setImgError] = useState(false)
  const s = SIZE_MAP[size]

  const iconElement = imgError ? (
    <ServifyMark
      variant={size === 'sm' ? 'inline' : 'icon'}
      className={cn(s.icon, textClassName)}
    />
  ) : (
    <Image
      src={LOGO_SRC}
      alt="Servify"
      width={s.px}
      height={s.px}
      className={cn(s.icon, 'object-contain')}
      onError={() => setImgError(true)}
      priority
    />
  )

  if (variant === 'icon') {
    return <span className={cn('inline-flex shrink-0', className)}>{iconElement}</span>
  }

  return (
    <span className={cn('inline-flex items-center gap-2.5 shrink-0', className)}>
      {iconElement}
      <span className="flex flex-col">
        <span className={cn('font-semibold leading-tight', s.text, textClassName)}>
          Servify
        </span>
        {subtitle && (
          <span className={cn('leading-tight', s.subtitle, subtitleClassName)}>
            {subtitle}
          </span>
        )}
      </span>
    </span>
  )
}
