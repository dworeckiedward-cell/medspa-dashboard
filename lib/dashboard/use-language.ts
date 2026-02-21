'use client'

import { useEffect, useState } from 'react'
import {
  DICT,
  DEFAULT_LANG,
  LANG_STORAGE_KEY,
  type LangKey,
  type TranslationDict,
} from './i18n'

/**
 * Hook for reading and changing the dashboard interface language.
 *
 * Language is stored in localStorage under LANG_STORAGE_KEY.
 * Before hydration, always returns English so SSR and first render match.
 * Falls back to English for any missing translation key (TypeScript union typing
 * makes missing keys a compile error anyway).
 */
export function useLanguage() {
  const [lang, setLangState] = useState<LangKey>(DEFAULT_LANG)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY)
      if (stored && stored in DICT) {
        setLangState(stored as LangKey)
      }
    } catch {
      // localStorage blocked — stay on English default
    }
    setMounted(true)
  }, [])

  function setLang(key: LangKey) {
    setLangState(key)
    try {
      localStorage.setItem(LANG_STORAGE_KEY, key)
    } catch {
      // localStorage blocked — preference not persisted
    }
  }

  // Before mount return English so server and first-render output match
  const t: TranslationDict = mounted ? DICT[lang] : DICT[DEFAULT_LANG]

  return { lang, setLang, t, mounted }
}
