import { describe, expect, it } from 'vitest'
import { appTzWallTimeMs } from '../../utils/dateUtils'
import {
  DEFAULT_WEEK,
  describeSegments,
  describeWeek,
  describeWeekShort,
  emptyWeek,
  formatClockShort,
  normalizeSegments,
  outsideMinutes,
  paintRect,
  parseWeekDays,
  PAINT_SLOTS,
  segmentsFromSlots,
  setDayRange,
  slotsFromSegments,
  toggleDay,
  typicalDay,
  weekHours,
  type WeekDays,
} from './weekAvailability'

const h = (hours: number, minutes = 0) => hours * 60 + minutes

describe('normalizeSegments', () => {
  it('sorts, merges touching ranges and drops empty or backwards ones', () => {
    expect(normalizeSegments([[h(13), h(15)], [h(7), h(11)], [h(11), h(13)], [h(16), h(16)], [h(18), h(17)]])).toEqual([[h(7), h(15)]])
  })
})

describe('slots', () => {
  it('round-trips a day through the painter cells', () => {
    const day = [[h(7), h(15)], [h(16), h(18, 30)]] as const
    const slots = slotsFromSegments(day.map(([s, e]) => [s, e]))
    expect(slots).toHaveLength(PAINT_SLOTS)
    expect(segmentsFromSlots(slots)).toEqual([[h(7), h(15)], [h(16), h(18, 30)]])
  })

  it('paints a rectangle across days and erases one off Friday at 3', () => {
    let days: WeekDays = emptyWeek()
    // Monday 7 AM (slot 4) to Friday 3:30 PM (slot 20, the half hour starting 3 PM) painted in one sweep.
    days = paintRect(days, { day: 1, slot: 4 }, { day: 5, slot: 20 }, true)
    expect(days[1]).toEqual([[h(7), h(15, 30)]])
    expect(days[5]).toEqual([[h(7), h(15, 30)]])
    expect(days[0]).toEqual([])
    // Friday: off at 3. Erase the 3:00 cell.
    days = paintRect(days, { day: 5, slot: 20 }, { day: 5, slot: 20 }, false)
    expect(days[5]).toEqual([[h(7), h(15)]])
    expect(weekHours(days)).toBe(42)
  })
})

describe('days', () => {
  it('toggles a day off and back to the typical day', () => {
    const off = toggleDay(DEFAULT_WEEK, 5)
    expect(off[5]).toEqual([])
    const back = toggleDay(off, 5)
    expect(back[5]).toEqual([[h(7), h(15)]])
    expect(typicalDay(emptyWeek())).toEqual([[h(7), h(15)]])
  })

  it('sets one day to a typed range', () => {
    expect(setDayRange(DEFAULT_WEEK, 5, h(7), h(15))[5]).toEqual([[h(7), h(15)]])
    expect(weekHours(setDayRange(DEFAULT_WEEK, 6, h(8), h(12)))).toBe(44)
  })

  it('parses the stored JSON shape and refuses the rest', () => {
    expect(parseWeekDays(JSON.parse(JSON.stringify(DEFAULT_WEEK)))).toEqual(DEFAULT_WEEK)
    expect(parseWeekDays([[], []])).toBeNull()
    expect(parseWeekDays([[['7', 900]], [], [], [], [], [], []])).toBeNull()
  })
})

describe('words', () => {
  it('writes the clock short', () => {
    expect(formatClockShort(h(7))).toBe('7a')
    expect(formatClockShort(h(15, 30))).toBe('3:30p')
    expect(formatClockShort(h(12))).toBe('12p')
    expect(formatClockShort(0)).toBe('12a')
    expect(describeSegments([[h(7), h(11)], [h(13), h(15)]])).toBe('7a–11a, 1p–3p')
    expect(describeSegments([])).toBe('off')
  })

  it('reads the week as runs of like days, Monday first, then the days off', () => {
    expect(describeWeek(DEFAULT_WEEK)).toBe('Mon–Fri 7a–3p. Off Sat and Sun.')
    const friShort = setDayRange(DEFAULT_WEEK, 5, h(7), h(15))
    const longer = setDayRange(friShort, 1, h(7), h(15, 30))
    const days = [1, 2, 3, 4].reduce((d, dow) => setDayRange(d, dow, h(7), h(15, 30)), longer)
    expect(describeWeek(days)).toBe('Mon–Thu 7a–3:30p, Fri 7a–3p. Off Sat and Sun.')
    expect(describeWeek(emptyWeek())).toBe('No hours drawn yet.')
    expect(describeWeek(setDayRange(DEFAULT_WEEK, 6, h(8), h(12)))).toBe('Mon–Fri 7a–3p, Sat 8a–12p. Off Sun.')
    expect(describeWeekShort(days)).toBe('Mon–Thu 7a–3:30p, Fri 7a–3p')
    expect(describeWeekShort(emptyWeek())).toBe('No hours drawn yet')
  })
})

describe('outsideMinutes', () => {
  const ymd = '2026-11-06' // a Friday
  it('counts the minutes past the drawn end and before the drawn start', () => {
    const inMs = appTzWallTimeMs(ymd, 6, 30)
    const outMs = appTzWallTimeMs(ymd, 17, 0)
    expect(outsideMinutes({ ymd, inMs, outMs, segs: [[h(7), h(15)]] })).toBe(150)
  })
  it('counts nothing inside the drawing and everything on a day with nothing drawn', () => {
    const inMs = appTzWallTimeMs(ymd, 8, 0)
    const outMs = appTzWallTimeMs(ymd, 12, 0)
    expect(outsideMinutes({ ymd, inMs, outMs, segs: [[h(7), h(15)]] })).toBe(0)
    expect(outsideMinutes({ ymd, inMs, outMs, segs: [] })).toBe(240)
  })
  it('handles a split day and a range that runs to midnight', () => {
    const inMs = appTzWallTimeMs(ymd, 10, 0)
    const outMs = appTzWallTimeMs(ymd, 14, 0)
    expect(outsideMinutes({ ymd, inMs, outMs, segs: [[h(7), h(11)], [h(13), h(15)]] })).toBe(120)
    expect(outsideMinutes({ ymd, inMs: appTzWallTimeMs(ymd, 22, 0), outMs: appTzWallTimeMs(ymd, 23, 30), segs: [[h(20), h(24)]] })).toBe(0)
  })
})
