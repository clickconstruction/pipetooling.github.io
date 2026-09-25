import { describe, expect, it } from 'vitest'
import { formatDateKey, getVisibleGridDateRange, monthAnchorForMyDay } from './calendarMonthGrid'

const month = (y: number, m: number) => new Date(y, m - 1, 1)

describe('calendarMonthGrid · getVisibleGridDateRange', () => {
  it('spans the padding weeks on both sides (Sep 2026 starts on a Tuesday, ends on a Wednesday)', () => {
    expect(getVisibleGridDateRange(month(2026, 9))).toEqual({ gridStart: '2026-08-30', gridEnd: '2026-10-03' })
  })

  it('reads the month of the anchor, not its day', () => {
    expect(getVisibleGridDateRange(new Date(2026, 9, 25))).toEqual(getVisibleGridDateRange(month(2026, 10)))
  })
})

describe('calendarMonthGrid · monthAnchorForMyDay', () => {
  it('keeps the same anchor while My Day is still a cell of the grid — padding days count', () => {
    const sep = month(2026, 9)
    expect(monthAnchorForMyDay(sep, '2026-09-25')).toBe(sep)
    expect(monthAnchorForMyDay(sep, '2026-10-03')).toBe(sep)
    expect(monthAnchorForMyDay(sep, '2026-08-30')).toBe(sep)
  })

  it('moves to My Day’s month once My Day scrubs past the grid', () => {
    expect(formatDateKey(monthAnchorForMyDay(month(2026, 9), '2026-10-04'))).toBe('2026-10-01')
    expect(formatDateKey(monthAnchorForMyDay(month(2026, 9), '2026-08-29'))).toBe('2026-08-01')
    expect(formatDateKey(monthAnchorForMyDay(month(2026, 12), '2027-01-10'))).toBe('2027-01-01')
  })

  it('would pull a month the arrows moved to back to My Day — which is why the page runs it on My Day moves only', () => {
    // The v2.3840 snap-back: My Day is today (Sep 25); the arrows go to October (grid 09-27…10-31)
    // or August (grid 07-26…09-05). Neither grid holds Sep 25, so running this after an arrow
    // press snapped both straight back to September.
    expect(formatDateKey(monthAnchorForMyDay(month(2026, 10), '2026-09-25'))).toBe('2026-09-01')
    expect(formatDateKey(monthAnchorForMyDay(month(2026, 8), '2026-09-25'))).toBe('2026-09-01')
  })
})
