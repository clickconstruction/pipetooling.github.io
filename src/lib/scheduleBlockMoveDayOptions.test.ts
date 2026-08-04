import { describe, expect, it } from 'vitest'
import {
  SCHEDULE_MOVE_DAY_BACK_COUNT,
  scheduleMoveDayHint,
  scheduleMoveDayOptions,
  scheduleMoveDaySaveLabel,
} from './scheduleBlockMoveDayOptions'

describe('scheduleMoveDayOptions', () => {
  it('returns the block day plus three days back, oldest first', () => {
    const opts = scheduleMoveDayOptions('2026-08-03')
    expect(opts.map((o) => o.dateKey)).toEqual([
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
    ])
    expect(opts.map((o) => o.deltaDays)).toEqual([-3, -2, -1, 0])
  })

  it('marks only the block own day as current', () => {
    const opts = scheduleMoveDayOptions('2026-08-03')
    expect(opts.filter((o) => o.isCurrent).map((o) => o.dateKey)).toEqual(['2026-08-03'])
  })

  it('labels chips with short weekday and month day', () => {
    const [first] = scheduleMoveDayOptions('2026-08-03')
    expect(first?.weekdayShort).toBe('Fri')
    expect(first?.monthDayShort).toBe('Jul 31')
    expect(first?.longLabel).toBe('Friday, July 31, 2026')
  })

  it('crosses a month boundary', () => {
    expect(scheduleMoveDayOptions('2026-03-02').map((o) => o.dateKey)).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ])
  })

  it('crosses a year boundary', () => {
    expect(scheduleMoveDayOptions('2026-01-02').map((o) => o.dateKey)).toEqual([
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
    ])
  })

  it('handles a leap day', () => {
    expect(scheduleMoveDayOptions('2028-03-01').map((o) => o.dateKey)).toEqual([
      '2028-02-27',
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ])
  })

  it('spans a DST forward transition without dropping or repeating a day', () => {
    // US DST begins 2026-03-08; Chicago civil dates must still advance by one.
    expect(scheduleMoveDayOptions('2026-03-09').map((o) => o.dateKey)).toEqual([
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
    ])
  })

  it('spans a DST back transition without dropping or repeating a day', () => {
    // US DST ends 2026-11-01.
    expect(scheduleMoveDayOptions('2026-11-02').map((o) => o.dateKey)).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ])
  })

  it('honours a custom back count', () => {
    expect(scheduleMoveDayOptions('2026-08-03', 1).map((o) => o.dateKey)).toEqual([
      '2026-08-02',
      '2026-08-03',
    ])
  })

  it('returns just the current day for a zero or negative back count', () => {
    expect(scheduleMoveDayOptions('2026-08-03', 0).map((o) => o.dateKey)).toEqual(['2026-08-03'])
    expect(scheduleMoveDayOptions('2026-08-03', -5).map((o) => o.dateKey)).toEqual(['2026-08-03'])
  })

  it('returns nothing for an unparseable date key', () => {
    expect(scheduleMoveDayOptions('')).toEqual([])
    expect(scheduleMoveDayOptions('not-a-date')).toEqual([])
    expect(scheduleMoveDayOptions('2026-8-3')).toEqual([])
  })

  it('defaults to three days back', () => {
    expect(SCHEDULE_MOVE_DAY_BACK_COUNT).toBe(3)
    expect(scheduleMoveDayOptions('2026-08-03')).toHaveLength(SCHEDULE_MOVE_DAY_BACK_COUNT + 1)
  })
})

describe('scheduleMoveDayHint', () => {
  it('is null while the block sits on its original day', () => {
    expect(scheduleMoveDayHint('2026-08-03', '2026-08-03')).toBeNull()
  })

  it('ignores surrounding whitespace when comparing', () => {
    expect(scheduleMoveDayHint(' 2026-08-03 ', '2026-08-03')).toBeNull()
  })

  it('names the target day once it differs', () => {
    expect(scheduleMoveDayHint('2026-08-03', '2026-08-02')).toBe('Moving to Sunday, August 2, 2026')
  })

  it('works for a forward move too', () => {
    expect(scheduleMoveDayHint('2026-08-03', '2026-08-05')).toBe(
      'Moving to Wednesday, August 5, 2026',
    )
  })

  it('is null for an empty or unparseable selection', () => {
    expect(scheduleMoveDayHint('2026-08-03', '')).toBeNull()
    expect(scheduleMoveDayHint('2026-08-03', 'nope')).toBeNull()
  })
})

describe('scheduleMoveDaySaveLabel', () => {
  it('stays "Save changes" on the original day', () => {
    expect(scheduleMoveDaySaveLabel('2026-08-03', '2026-08-03')).toBe('Save changes')
  })

  it('becomes "Move and save" once the day changes', () => {
    expect(scheduleMoveDaySaveLabel('2026-08-03', '2026-07-31')).toBe('Move and save')
  })
})
