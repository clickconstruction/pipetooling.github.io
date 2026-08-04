import { describe, expect, it } from 'vitest'
import {
  SCHEDULE_MOVE_DAY_BACK_COUNT,
  SCHEDULE_MOVE_DAY_FORWARD_COUNT,
  scheduleMoveDayHint,
  scheduleMoveDayOptions,
  scheduleMoveDaySaveLabel,
} from './scheduleBlockMoveDayOptions'

describe('scheduleMoveDayOptions', () => {
  it('returns one day back through two days forward, oldest first', () => {
    const opts = scheduleMoveDayOptions('2026-08-03')
    expect(opts.map((o) => o.dateKey)).toEqual([
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
    ])
    expect(opts.map((o) => o.deltaDays)).toEqual([-1, 0, 1, 2])
  })

  it('marks only the block own day as current', () => {
    const opts = scheduleMoveDayOptions('2026-08-03')
    expect(opts.filter((o) => o.isCurrent).map((o) => o.dateKey)).toEqual(['2026-08-03'])
  })

  it('labels chips with short weekday and month day', () => {
    const opts = scheduleMoveDayOptions('2026-08-03')
    const first = opts[0]
    const last = opts[opts.length - 1]
    expect(first?.weekdayShort).toBe('Sun')
    expect(first?.monthDayShort).toBe('Aug 2')
    expect(first?.longLabel).toBe('Sunday, August 2, 2026')
    expect(last?.weekdayShort).toBe('Wed')
    expect(last?.monthDayShort).toBe('Aug 5')
  })

  it('crosses a month boundary in both directions', () => {
    expect(scheduleMoveDayOptions('2026-03-01').map((o) => o.dateKey)).toEqual([
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
    ])
    expect(scheduleMoveDayOptions('2026-07-30').map((o) => o.dateKey)).toEqual([
      '2026-07-29',
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
    ])
  })

  it('crosses a year boundary', () => {
    expect(scheduleMoveDayOptions('2026-12-31').map((o) => o.dateKey)).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ])
  })

  it('handles a leap day', () => {
    expect(scheduleMoveDayOptions('2028-02-28').map((o) => o.dateKey)).toEqual([
      '2028-02-27',
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ])
  })

  it('spans a DST forward transition without dropping or repeating a day', () => {
    // US DST begins 2026-03-08; Chicago civil dates must still advance by one.
    expect(scheduleMoveDayOptions('2026-03-08').map((o) => o.dateKey)).toEqual([
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
    ])
  })

  it('spans a DST back transition without dropping or repeating a day', () => {
    // US DST ends 2026-11-01.
    expect(scheduleMoveDayOptions('2026-11-01').map((o) => o.dateKey)).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ])
  })

  it('honours custom back and forward counts', () => {
    expect(scheduleMoveDayOptions('2026-08-03', 2, 0).map((o) => o.dateKey)).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
    ])
    expect(scheduleMoveDayOptions('2026-08-03', 0, 1).map((o) => o.dateKey)).toEqual([
      '2026-08-03',
      '2026-08-04',
    ])
  })

  it('returns just the current day for zero or negative counts', () => {
    expect(scheduleMoveDayOptions('2026-08-03', 0, 0).map((o) => o.dateKey)).toEqual(['2026-08-03'])
    expect(scheduleMoveDayOptions('2026-08-03', -5, -5).map((o) => o.dateKey)).toEqual([
      '2026-08-03',
    ])
  })

  it('returns nothing for an unparseable date key', () => {
    expect(scheduleMoveDayOptions('')).toEqual([])
    expect(scheduleMoveDayOptions('not-a-date')).toEqual([])
    expect(scheduleMoveDayOptions('2026-8-3')).toEqual([])
  })

  it('defaults to one back and two forward', () => {
    expect(SCHEDULE_MOVE_DAY_BACK_COUNT).toBe(1)
    expect(SCHEDULE_MOVE_DAY_FORWARD_COUNT).toBe(2)
    expect(scheduleMoveDayOptions('2026-08-03')).toHaveLength(
      SCHEDULE_MOVE_DAY_BACK_COUNT + 1 + SCHEDULE_MOVE_DAY_FORWARD_COUNT,
    )
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
    expect(scheduleMoveDaySaveLabel('2026-08-03', '2026-08-05')).toBe('Move and save')
  })
})
