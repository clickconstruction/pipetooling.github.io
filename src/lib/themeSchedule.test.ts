import { describe, expect, it } from 'vitest'
import {
  msUntilNextThemeBoundary,
  parseThemeOverride,
  resolveTheme,
  scheduledTheme,
} from './themeSchedule'

describe('scheduledTheme', () => {
  it('is dark from 20:00 through 3:59', () => {
    expect(scheduledTheme(20)).toBe('dark')
    expect(scheduledTheme(23)).toBe('dark')
    expect(scheduledTheme(0)).toBe('dark')
    expect(scheduledTheme(3)).toBe('dark')
  })

  it('is light from 4:00 through 19:59', () => {
    expect(scheduledTheme(4)).toBe('light')
    expect(scheduledTheme(12)).toBe('light')
    expect(scheduledTheme(19)).toBe('light')
  })
})

describe('resolveTheme', () => {
  it('follows the schedule without an override', () => {
    expect(resolveTheme(null, 12)).toBe('light')
    expect(resolveTheme(null, 22)).toBe('dark')
  })

  it('the override wins at any hour', () => {
    expect(resolveTheme('dark', 12)).toBe('dark')
    expect(resolveTheme('light', 22)).toBe('light')
  })
})

describe('parseThemeOverride', () => {
  it('accepts only the two theme names', () => {
    expect(parseThemeOverride('light')).toBe('light')
    expect(parseThemeOverride('dark')).toBe('dark')
    expect(parseThemeOverride(null)).toBe(null)
    expect(parseThemeOverride('auto')).toBe(null)
    expect(parseThemeOverride('')).toBe(null)
  })
})

describe('msUntilNextThemeBoundary', () => {
  it('targets 4:00 during the early-morning dark stretch', () => {
    const now = new Date(2026, 6, 13, 2, 30, 0)
    expect(msUntilNextThemeBoundary(now)).toBe(1.5 * 60 * 60 * 1000)
  })

  it('targets 20:00 during the day', () => {
    const now = new Date(2026, 6, 13, 19, 0, 0)
    expect(msUntilNextThemeBoundary(now)).toBe(60 * 60 * 1000)
  })

  it("targets tomorrow's 4:00 during the evening dark stretch", () => {
    const now = new Date(2026, 6, 13, 22, 0, 0)
    expect(msUntilNextThemeBoundary(now)).toBe(6 * 60 * 60 * 1000)
  })

  it('never returns zero or negative (exactly on a boundary)', () => {
    const now = new Date(2026, 6, 13, 20, 0, 0)
    expect(msUntilNextThemeBoundary(now)).toBeGreaterThan(0)
  })
})
