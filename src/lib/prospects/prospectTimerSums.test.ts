import { describe, expect, it } from 'vitest'
import { myTimeWindows, sumTimerSeconds, sumTimerSecondsByProspect } from './prospectTimerSums'

describe('sumTimerSeconds', () => {
  it('adds the seconds of every row', () => {
    expect(sumTimerSeconds([{ timer_seconds: 30 }, { timer_seconds: 45 }, { timer_seconds: 0 }])).toBe(75)
  })
  it('no rows is no time', () => {
    expect(sumTimerSeconds([])).toBe(0)
  })
  it('a row with no seconds adds nothing', () => {
    expect(sumTimerSeconds([{ timer_seconds: 30 }, { timer_seconds: null }])).toBe(30)
  })
})

describe('sumTimerSecondsByProspect', () => {
  it('adds per prospect', () => {
    expect(
      sumTimerSecondsByProspect([
        { prospect_id: 'a', timer_seconds: 30 },
        { prospect_id: 'b', timer_seconds: 5 },
        { prospect_id: 'a', timer_seconds: 12 },
      ]),
    ).toEqual({ a: 42, b: 5 })
  })
  it('leaves out a row with no prospect, and counts a row with no seconds as zero', () => {
    expect(
      sumTimerSecondsByProspect([
        { prospect_id: null, timer_seconds: 30 },
        { prospect_id: 'a', timer_seconds: null },
      ]),
    ).toEqual({ a: 0 })
  })
  it('no rows is an empty map', () => {
    expect(sumTimerSecondsByProspect([])).toEqual({})
  })
})

describe('myTimeWindows', () => {
  const now = new Date(2026, 9, 16, 14, 30, 15, 250)
  const w = myTimeWindows(now)

  it('today runs from its first millisecond to its last, in the reader zone', () => {
    expect(w.startOfToday).toEqual(new Date(2026, 9, 16, 0, 0, 0, 0))
    expect(w.endOfToday).toEqual(new Date(2026, 9, 16, 23, 59, 59, 999))
  })
  it('yesterday starts a day before today starts', () => {
    expect(w.startOfYesterday).toEqual(new Date(2026, 9, 15, 0, 0, 0, 0))
  })
  it('the last seven days run back from this moment, not from a midnight', () => {
    expect(w.sevenDaysAgo).toEqual(new Date(2026, 9, 9, 14, 30, 15, 250))
  })
  it('crosses a month and a year without slipping', () => {
    const first = myTimeWindows(new Date(2026, 0, 1, 8, 0, 0, 0))
    expect(first.startOfYesterday).toEqual(new Date(2025, 11, 31, 0, 0, 0, 0))
    expect(first.sevenDaysAgo).toEqual(new Date(2025, 11, 25, 8, 0, 0, 0))
  })
  it('does not move the moment it was given', () => {
    expect(now).toEqual(new Date(2026, 9, 16, 14, 30, 15, 250))
  })
})
