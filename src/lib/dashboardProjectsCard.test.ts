import { describe, expect, it } from 'vitest'
import { daysOpen, formatDatetime, personDisplay } from './dashboardProjectsCard'

describe('formatDatetime', () => {
  it('returns "unknown" for null', () => {
    expect(formatDatetime(null)).toBe('unknown')
  })

  it('returns "unknown" for empty string', () => {
    expect(formatDatetime('')).toBe('unknown')
  })

  it('prefixes the short weekday and joins with ", " (locale-dependent body)', () => {
    const iso = '2026-07-16T15:05:00'
    const date = new Date(iso)
    const expectedWeekday = date.toLocaleDateString(undefined, { weekday: 'short' })
    const expectedDateTime = date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
    expect(formatDatetime(iso)).toBe(`${expectedWeekday}, ${expectedDateTime}`)
  })
})

describe('daysOpen', () => {
  const daysAgoIso = (n: number) => new Date(Date.now() - n * 86400000).toISOString()

  it('returns null when never started', () => {
    expect(daysOpen(null, null)).toBe(null)
  })

  it('returns null once the stage has ended, even if started', () => {
    expect(daysOpen(daysAgoIso(5), daysAgoIso(1))).toBe(null)
  })

  it('returns 0 for a stage started moments ago', () => {
    expect(daysOpen(daysAgoIso(0), null)).toBe(0)
  })

  it('floors to whole days', () => {
    expect(daysOpen(daysAgoIso(3.7), null)).toBe(3)
  })

  it('returns null for a start date in the future (negative elapsed)', () => {
    expect(daysOpen(daysAgoIso(-2), null)).toBe(null)
  })
})

describe('personDisplay', () => {
  const userNames = new Set(['jane doe', 'bob smith'])

  it('falls back for null name', () => {
    expect(personDisplay(null, userNames)).toBe('Assigned to: unknown')
  })

  it('falls back for whitespace-only name', () => {
    expect(personDisplay('   ', userNames)).toBe('Assigned to: unknown')
  })

  it('returns the trimmed name when it matches a user (case-insensitive)', () => {
    expect(personDisplay('  Jane Doe ', userNames)).toBe('Jane Doe')
  })

  it('flags names that are not users', () => {
    expect(personDisplay('Some Vendor', userNames)).toBe('Some Vendor (not a user)')
  })

  it('matches against the lowercased set, preserving original casing in output', () => {
    expect(personDisplay('BOB SMITH', userNames)).toBe('BOB SMITH')
  })
})
