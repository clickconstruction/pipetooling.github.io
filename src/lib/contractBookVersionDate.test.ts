import { describe, expect, it } from 'vitest'
import {
  bookVersionDateIsCustom,
  effectiveBookVersionLabel,
  effectiveBookVersionPlainDate,
  maxEffectiveBookVersionRow,
} from './contractBookVersionDate'

describe('effectiveBookVersionPlainDate', () => {
  it('prefers the custom book_version_date over updated_at', () => {
    expect(
      effectiveBookVersionPlainDate({ book_version_date: '2026-01-15', updated_at: '2026-04-20T18:00:00Z' }),
    ).toBe('2026-01-15')
  })

  it('falls back to the updated_at app-tz calendar day', () => {
    expect(effectiveBookVersionPlainDate({ book_version_date: null, updated_at: '2026-04-20T18:00:00Z' })).toBe(
      '2026-04-20',
    )
    expect(effectiveBookVersionPlainDate({ updated_at: '2026-04-21T03:30:00Z' })).toBe('2026-04-20')
  })

  it('returns null when the row has neither date', () => {
    expect(effectiveBookVersionPlainDate({ book_version_date: null, updated_at: null })).toBeNull()
    expect(effectiveBookVersionPlainDate(null)).toBeNull()
    expect(effectiveBookVersionPlainDate(undefined)).toBeNull()
  })

  it('ignores malformed custom dates and falls back', () => {
    expect(
      effectiveBookVersionPlainDate({ book_version_date: 'not-a-date', updated_at: '2026-04-20T18:00:00Z' }),
    ).toBe('2026-04-20')
  })
})

describe('bookVersionDateIsCustom', () => {
  it('detects a set custom date', () => {
    expect(bookVersionDateIsCustom({ book_version_date: '2026-01-15' })).toBe(true)
    expect(bookVersionDateIsCustom({ book_version_date: null })).toBe(false)
    expect(bookVersionDateIsCustom({ book_version_date: '' })).toBe(false)
    expect(bookVersionDateIsCustom(null)).toBe(false)
  })
})

describe('effectiveBookVersionLabel', () => {
  it('formats the effective date', () => {
    expect(effectiveBookVersionLabel({ book_version_date: '2026-01-15', updated_at: null })).toBe('Jan 15, 2026')
    expect(effectiveBookVersionLabel({ book_version_date: null, updated_at: '2026-04-20T18:00:00Z' })).toBe(
      'Apr 20, 2026',
    )
    expect(effectiveBookVersionLabel({ book_version_date: null, updated_at: null })).toBeNull()
  })
})

describe('maxEffectiveBookVersionRow', () => {
  it('mixes custom dates and timestamps on the plain-date axis', () => {
    const older = { id: 'a', book_version_date: null, updated_at: '2026-04-20T18:00:00Z' }
    const customNewest = { id: 'b', book_version_date: '2026-05-01', updated_at: '2026-01-01T00:00:00Z' }
    expect(maxEffectiveBookVersionRow([older, customNewest])?.id).toBe('b')
  })

  it('lets a later edit beat an earlier custom date', () => {
    const custom = { id: 'a', book_version_date: '2026-03-01', updated_at: null }
    const edited = { id: 'b', book_version_date: null, updated_at: '2026-04-20T18:00:00Z' }
    expect(maxEffectiveBookVersionRow([custom, edited])?.id).toBe('b')
  })

  it('returns null for empty input or rows without dates', () => {
    expect(maxEffectiveBookVersionRow([])).toBeNull()
    expect(maxEffectiveBookVersionRow([{ book_version_date: null, updated_at: null }])).toBeNull()
  })
})
