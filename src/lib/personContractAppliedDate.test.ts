import { describe, expect, it } from 'vitest'
import { formatAppliedVersionPlainDate, isoToPlainDateInAppTz } from './personContractAppliedDate'

describe('formatAppliedVersionPlainDate', () => {
  it('formats a plain date without timezone shifting', () => {
    expect(formatAppliedVersionPlainDate('2026-04-20')).toBe('Apr 20, 2026')
    expect(formatAppliedVersionPlainDate('2026-01-01')).toBe('Jan 1, 2026')
    expect(formatAppliedVersionPlainDate('2025-12-31')).toBe('Dec 31, 2025')
  })

  it('returns null for empty or invalid input', () => {
    expect(formatAppliedVersionPlainDate(null)).toBeNull()
    expect(formatAppliedVersionPlainDate(undefined)).toBeNull()
    expect(formatAppliedVersionPlainDate('')).toBeNull()
    expect(formatAppliedVersionPlainDate('  ')).toBeNull()
    expect(formatAppliedVersionPlainDate('not-a-date')).toBeNull()
    expect(formatAppliedVersionPlainDate('2026-13-01')).toBeNull()
    expect(formatAppliedVersionPlainDate('2026-00-10')).toBeNull()
    expect(formatAppliedVersionPlainDate('2026-04-32')).toBeNull()
    expect(formatAppliedVersionPlainDate('2026-04-20T10:00:00Z')).toBeNull()
  })

  it('trims surrounding whitespace', () => {
    expect(formatAppliedVersionPlainDate(' 2026-04-20 ')).toBe('Apr 20, 2026')
  })
})

describe('isoToPlainDateInAppTz', () => {
  it('converts an ISO timestamp to the calendar day in the app timezone', () => {
    expect(isoToPlainDateInAppTz('2026-04-20T18:00:00Z')).toBe('2026-04-20')
  })

  it('rolls a UTC-early-morning instant back to the previous Chicago day', () => {
    expect(isoToPlainDateInAppTz('2026-04-21T03:30:00Z')).toBe('2026-04-20')
  })

  it('returns null for missing or invalid input', () => {
    expect(isoToPlainDateInAppTz(null)).toBeNull()
    expect(isoToPlainDateInAppTz(undefined)).toBeNull()
    expect(isoToPlainDateInAppTz('garbage')).toBeNull()
  })
})
