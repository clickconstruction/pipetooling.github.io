import { describe, expect, it } from 'vitest'
import { clampCompletenessPct, completenessMarkedLine } from './jobCompleteness'

describe('clampCompletenessPct', () => {
  it('passes through integers in range', () => {
    expect(clampCompletenessPct(0)).toBe(0)
    expect(clampCompletenessPct(55)).toBe(55)
    expect(clampCompletenessPct(100)).toBe(100)
  })

  it('clamps out-of-range values', () => {
    expect(clampCompletenessPct(-10)).toBe(0)
    expect(clampCompletenessPct(140)).toBe(100)
  })

  it('rounds fractions and parses numeric strings', () => {
    expect(clampCompletenessPct(66.6)).toBe(67)
    expect(clampCompletenessPct('80')).toBe(80)
    expect(clampCompletenessPct(' 25 ')).toBe(25)
  })

  it('returns null for unparseable input', () => {
    expect(clampCompletenessPct(null)).toBeNull()
    expect(clampCompletenessPct(undefined)).toBeNull()
    expect(clampCompletenessPct('')).toBeNull()
    expect(clampCompletenessPct('abc')).toBeNull()
    expect(clampCompletenessPct(Number.NaN)).toBeNull()
  })
})

describe('completenessMarkedLine', () => {
  it('shows name and date when both known', () => {
    const line = completenessMarkedLine('Roberto', '2026-07-13T12:00:00Z')
    expect(line).toMatch(/^Marked by Roberto · /)
  })

  it('falls back to name-only or date-only', () => {
    expect(completenessMarkedLine('Roberto', null)).toBe('Marked by Roberto')
    expect(completenessMarkedLine(null, '2026-07-13T12:00:00Z')).toMatch(/^Marked /)
    expect(completenessMarkedLine('  ', 'not-a-date')).toBeNull()
    expect(completenessMarkedLine(null, null)).toBeNull()
  })
})
