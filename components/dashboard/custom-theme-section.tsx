'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, RotateCcw, AlertTriangle } from 'lucide-react'
import { HexColorPicker } from 'react-colorful'
import { cn } from '@/lib/utils'
import {
  useCustomTheme,
  isValidHex,
  hasLowContrast,
  type ThemeColorField,
} from '@/lib/dashboard/custom-theme'

// ── Field metadata ───────────────────────────────────────────────────────────

interface FieldConfig {
  field: ThemeColorField
  label: string
  helper: string
}

const FIELDS: FieldConfig[] = [
  { field: 'background', label: 'Background', helper: 'Page & shell background' },
  { field: 'surface', label: 'Surface / Card', helper: 'Cards, panels, inputs' },
  { field: 'text', label: 'Text', helper: 'Primary body text color' },
  { field: 'accent', label: 'Accent / Primary', helper: 'Buttons, links, highlights' },
]

// ── Color Field Row ──────────────────────────────────────────────────────────

function ColorFieldRow({
  config,
  value,
  lastUsed,
  onChange,
}: {
  config: FieldConfig
  value: string
  lastUsed: string[]
  onChange: (hex: string) => void
}) {
  const [inputValue, setInputValue] = useState(value)
  const [pickerOpen, setPickerOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const isValid = isValidHex(inputValue)

  // Close picker on outside click or Escape
  useEffect(() => {
    if (!pickerOpen) return
    function onPointerDown(e: PointerEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPickerOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [pickerOpen])

  function handleInputChange(raw: string) {
    let hex = raw
    if (hex && !hex.startsWith('#')) hex = '#' + hex
    hex = hex.slice(0, 7)
    setInputValue(hex)
    if (isValidHex(hex)) {
      onChange(hex)
    }
  }

  function handlePickerChange(hex: string) {
    setInputValue(hex)
    onChange(hex)
  }

  // Sync external value changes (e.g. preset reset)
  if (isValidHex(value) && value !== inputValue && isValidHex(inputValue)) {
    if (value.toLowerCase() !== inputValue.toLowerCase()) {
      setInputValue(value)
    }
  }

  return (
    <div className="flex items-start gap-3 py-3 border-b border-[var(--brand-border)]/50 last:border-0">
      {/* Label + helper */}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--brand-text)]">{config.label}</p>
        <p className="text-[10px] text-[var(--brand-muted)] mt-0.5">{config.helper}</p>

        {/* Last used swatches */}
        {lastUsed.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            <span className="text-[9px] text-[var(--brand-muted)] mr-0.5">Recent:</span>
            {lastUsed.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => handlePickerChange(hex)}
                className="h-4 w-4 rounded-full border border-black/10 hover:scale-110 transition-transform focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--user-accent)]"
                style={{ background: hex }}
                title={hex}
              />
            ))}
          </div>
        )}
      </div>

      {/* Swatch trigger + popover + hex input */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Swatch — opens react-colorful popover */}
        <div ref={popoverRef} className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            className="h-7 w-7 rounded-lg border border-black/10 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent)] focus-visible:ring-offset-1"
            style={{ background: isValid ? inputValue : value }}
            aria-label={`Pick ${config.label} color`}
          />
          {pickerOpen && (
            <div className="absolute right-0 top-9 z-50 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3 shadow-xl">
              <HexColorPicker
                color={isValid ? inputValue : value}
                onChange={handlePickerChange}
              />
              <p className="mt-2 text-center text-[10px] font-mono text-[var(--brand-muted)]">
                {isValid ? inputValue.toUpperCase() : value.toUpperCase()}
              </p>
            </div>
          )}
        </div>

        {/* HEX input */}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="#000000"
          maxLength={7}
          className={cn(
            'w-[76px] rounded-md border px-2 py-1 text-xs font-mono',
            'bg-[var(--brand-bg)] text-[var(--brand-text)] placeholder:text-[var(--brand-muted)]',
            'focus:outline-none focus:ring-1 focus:ring-[var(--user-accent)]',
            isValid || !inputValue
              ? 'border-[var(--brand-border)]'
              : 'border-rose-400',
          )}
          aria-label={`${config.label} hex value`}
        />
      </div>
    </div>
  )
}

// ── Custom Theme Section ─────────────────────────────────────────────────────

interface CustomThemeSectionProps {
  tenantSlug?: string
}

export function CustomThemeSection({ tenantSlug }: CustomThemeSectionProps) {
  const {
    theme,
    lastUsed,
    mounted,
    setField,
    setEnabled,
    resetToPreset,
    clearCustom,
  } = useCustomTheme(tenantSlug)

  const [expanded, setExpanded] = useState(theme.enabled)

  // Contrast warning: text vs background
  const lowContrast = mounted && hasLowContrast(theme.text, theme.background)

  if (!mounted) {
    return (
      <div className="h-12 rounded-lg bg-[var(--brand-border)]/30 animate-pulse" />
    )
  }

  return (
    <div className="border-t border-[var(--brand-border)] pt-5 mt-5">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full group"
        aria-expanded={expanded}
      >
        <div>
          <p className="text-sm font-medium text-[var(--brand-text)] text-left">
            Custom Theme
            <span className="text-[10px] font-normal text-[var(--brand-muted)] ml-1.5">Advanced</span>
          </p>
          <p className="text-[10px] text-[var(--brand-muted)] mt-0.5 text-left">
            Override dashboard colors with your own palette
          </p>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-[var(--brand-muted)] transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded && (
        <div className="mt-4 space-y-1">
          {/* Enable toggle */}
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-[var(--brand-border)]/50">
            <div>
              <p className="text-xs font-medium text-[var(--brand-text)]">Enable custom colors</p>
              <p className="text-[10px] text-[var(--brand-muted)]">
                Overrides Light/Dark preset colors
              </p>
            </div>
            <button
              role="switch"
              aria-checked={theme.enabled}
              onClick={() => setEnabled(!theme.enabled)}
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
                'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-[var(--user-accent)] focus-visible:ring-offset-2',
              )}
              style={{ background: theme.enabled ? 'var(--user-accent)' : 'var(--brand-border)' }}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0',
                  'transition-transform duration-200',
                  theme.enabled ? 'translate-x-4' : 'translate-x-0',
                )}
              />
            </button>
          </div>

          {/* Contrast warning */}
          {lowContrast && theme.enabled && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Low contrast between text and background. Text may be hard to read.
              </p>
            </div>
          )}

          {/* Color fields */}
          {FIELDS.map((config) => (
            <ColorFieldRow
              key={config.field}
              config={config}
              value={theme[config.field]}
              lastUsed={lastUsed[config.field]}
              onChange={(hex) => setField(config.field, hex)}
            />
          ))}

          {/* Preset reset buttons */}
          <div className="flex items-center gap-2 pt-3">
            <button
              type="button"
              onClick={() => resetToPreset('light')}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--brand-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-text)]/20 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Light preset
            </button>
            <button
              type="button"
              onClick={() => resetToPreset('dark')}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--brand-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:border-[var(--brand-text)]/20 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Dark preset
            </button>
            <button
              type="button"
              onClick={clearCustom}
              className="ml-auto text-[11px] font-medium text-rose-500 hover:text-rose-600 transition-colors"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
