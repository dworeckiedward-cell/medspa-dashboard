import { describe, it, expect } from 'vitest'
import { safeCompare } from '../timing-safe'

describe('safeCompare', () => {
  it('returns true for identical strings', () => {
    expect(safeCompare('secret123', 'secret123')).toBe(true)
  })

  it('returns false for different strings of same length', () => {
    expect(safeCompare('secret123', 'secret456')).toBe(false)
  })

  it('returns false for different-length strings', () => {
    expect(safeCompare('short', 'longer-string')).toBe(false)
  })

  it('returns false when first argument is null', () => {
    expect(safeCompare(null, 'secret')).toBe(false)
  })

  it('returns false when second argument is null', () => {
    expect(safeCompare('secret', null)).toBe(false)
  })

  it('returns false when first argument is undefined', () => {
    expect(safeCompare(undefined, 'secret')).toBe(false)
  })

  it('returns false when second argument is undefined', () => {
    expect(safeCompare('secret', undefined)).toBe(false)
  })

  it('returns false when both arguments are empty strings', () => {
    expect(safeCompare('', '')).toBe(false)
  })

  it('returns false when first argument is empty', () => {
    expect(safeCompare('', 'secret')).toBe(false)
  })

  it('handles unicode strings correctly', () => {
    expect(safeCompare('résumé', 'résumé')).toBe(true)
    expect(safeCompare('résumé', 'resume')).toBe(false)
  })
})
