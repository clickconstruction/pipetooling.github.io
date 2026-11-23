import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { sentenceParts } from '../valuesInPlace'
import type { AvailableHoursAnswer } from './utilization'
import type { Segment, WeekDays } from './weekAvailability'
import {
  formatHours,
  formatWorkingClock,
  halfDay,
  paidWeekOf,
  parseWorkingWeek,
  setRowInForce,
  usualWorkingDay,
  withWorkingDays,
  workingChangeSentence,
  workingDayForClock,
  workingClockChoices,
  workingDayProblem,
  workingDaysCountWords,
  workingDaysLabel,
  workingHoursComing,
  workingHoursHistory,
  workingHoursInForce,
  workingHoursLines,
  workingHoursMovePay,
  workingHoursSentences,
  workingHoursStarts,
  workingLineHoursWords,
  workingRangesWords,
  workingWeekFromPaidWeek,
  workingWeekHours,
  workingWeekLineWords,
  workingWeekProblem,
} from './workingHours'

const day = (...segs: Segment[]): Segment[] => segs
/** Monday to Friday on the same ranges, the weekend off. */
const weekdays = (...segs: Segment[]): WeekDays => [[], segs, segs, segs, segs, segs, []]
const SIX_TO_NOON = weekdays([360, 720])
const HALF_WEDNESDAY: WeekDays = [[], day([420, 900]), day([420, 900]), day([420, 660]), day([420, 900]), day([420, 900]), []]
const plain = (s: string) => sentenceParts(s).map((p) => (typeof p === 'string' ? p : p.text)).join('')

describe('the shape of a week', () => {
  it('takes the weeks the database takes', () => {
    expect(workingWeekProblem(SIX_TO_NOON)).toBeNull()
    expect(workingWeekProblem(weekdays([420, 690], [720, 930]))).toBeNull()
    expect(workingWeekProblem([[], [], [], [], [], [], []])).toBeNull()
    expect(workingWeekProblem([day([480, 1440]), [], [], [], [], [], []])).toBeNull()
  })

  it('says why a day cannot be kept, naming the day', () => {
    expect(workingWeekProblem(weekdays([365, 720]))).toBe('Monday has a time off the quarter hour.')
    expect(workingWeekProblem(weekdays([720, 360]))).toBe('Monday ends before it starts.')
    expect(workingWeekProblem(weekdays([360, 360]))).toBe('Monday ends before it starts.')
    expect(workingWeekProblem(weekdays([1380, 1455]))).toBe('Monday runs outside the day.')
    expect(workingWeekProblem(weekdays([360, 420], [480, 540], [600, 660]))).toBe('Monday holds two ranges at most.')
    expect(workingWeekProblem(weekdays([360, 720], [720, 900]))).toBe('Monday needs a break between its two ranges.')
    expect(workingWeekProblem(weekdays([720, 900], [360, 600]))).toBe('Monday needs a break between its two ranges.')
    expect(workingWeekProblem([[], [], [], [], [], day([0, 600], [615, 1440]), []])).toBe('Friday is over 16 hours.')
    expect(workingDayProblem([[360.5, 720]])).toBe('A day has a time off the quarter hour.')
  })

  it('holds a week to seven days and 80 hours', () => {
    expect(workingWeekProblem([[], [], [], [], [], []])).toBe('A week is seven days.')
    const twelves: WeekDays = Array.from({ length: 7 }, () => day([360, 1080]))
    expect(workingWeekProblem(twelves)).toBe('A week holds no more than 80 hours. This one is 84.')
  })

  it('reads a stored week whole or not at all', () => {
    expect(parseWorkingWeek([[], [[360, 720]], [], [], [], [], []])).toEqual([[], [[360, 720]], [], [], [], [], []])
    expect(parseWorkingWeek(null)).toBeNull()
    expect(parseWorkingWeek([[], [[360, 720]]])).toBeNull()
    expect(parseWorkingWeek([[], [['06:00', '12:00']], [], [], [], [], []])).toBeNull()
    expect(parseWorkingWeek([[], [[365, 720]], [], [], [], [], []])).toBeNull()
  })

  it('every sentence it says is plain words', () => {
    for (const s of ['Monday has a time off the quarter hour.', 'Monday needs a break between its two ranges.', 'A week holds no more than 80 hours. This one is 84.']) expect(plainWordsFailures(s)).toEqual([])
  })
})

describe('the hours', () => {
  it('adds a week up in quarter hours, a break left out', () => {
    expect(workingWeekHours(SIX_TO_NOON)).toBe(30)
    expect(workingWeekHours(weekdays([420, 690], [720, 930]))).toBe(40)
    expect(workingWeekHours([[], day([360, 615]), [], [], [], [], []])).toBe(4.25)
    expect(formatHours(4.25)).toBe('4.25')
    expect(formatHours(30)).toBe('30')
  })

  it('works out the seven numbers pay keeps, Sunday first', () => {
    expect(paidWeekOf(SIX_TO_NOON)).toEqual([0, 6, 6, 6, 6, 6, 0])
    expect(paidWeekOf(HALF_WEDNESDAY)).toEqual([0, 8, 8, 4, 8, 8, 0])
    expect(paidWeekOf(weekdays([420, 690], [720, 930]))).toEqual([0, 8, 8, 8, 8, 8, 0])
  })

  it('knows when a salaried person’s pay moves: a length changes, not a time', () => {
    expect(workingHoursMovePay(SIX_TO_NOON, [0, 6, 6, 6, 6, 6, 0])).toBe(false)
    expect(workingHoursMovePay(weekdays([420, 780]), [0, 6, 6, 6, 6, 6, 0])).toBe(false)
    expect(workingHoursMovePay(HALF_WEDNESDAY, [0, 8, 8, 8, 8, 8, 0])).toBe(true)
    expect(workingHoursMovePay(SIX_TO_NOON, ['0', '6', '6', '6', '6', '6', '0'] as unknown as number[])).toBe(false)
  })

  it('starts a person on a set week from the start alone, so pay cannot move', () => {
    const made = workingWeekFromPaidWeek([0, 6, 6, 6, 6, 6, 0], 360)
    expect(made).toEqual(SIX_TO_NOON)
    expect(workingHoursMovePay(made!, [0, 6, 6, 6, 6, 6, 0])).toBe(false)
    expect(workingWeekFromPaidWeek([0, 8, 8, 8, 8, 4.25, 0], 420)![5]).toEqual([[420, 675]])
    expect(workingWeekFromPaidWeek([0, 8, 8, 8, 8, 8, 0], 1020)).toBeNull()
  })
})

describe('the set week in force', () => {
  const row = (over: Partial<AvailableHoursAnswer>): AvailableHoursAnswer => ({ user_id: 'u-1', hours_per_week: 30, days: SIX_TO_NOON, effective_from: '2026-11-22', set_by: 'u-office', set_at: '2026-11-23T10:00:00Z', kind: 'set', ...over })

  it('holds from its Sunday, and never reaches back before it', () => {
    const rows = [row({})]
    expect(workingHoursInForce(rows, '2026-11-22')).toEqual(SIX_TO_NOON)
    expect(workingHoursInForce(rows, '2026-12-25')).toEqual(SIX_TO_NOON)
    expect(workingHoursInForce(rows, '2026-11-21')).toBeNull()
  })

  it('takes the newest row of a Sunday, and an answer is never one', () => {
    const later = weekdays([420, 780])
    const rows = [row({}), row({ days: later, set_at: '2026-11-24T09:00:00Z' }), row({ kind: 'answer', days: null, set_at: '2026-11-25T09:00:00Z' }), row({ kind: undefined, effective_from: '2026-11-22', set_at: '2026-11-26T09:00:00Z' })]
    expect(setRowInForce(rows, '2026-11-25')?.set_at).toBe('2026-11-24T09:00:00Z')
    expect(workingHoursInForce(rows, '2026-11-25')).toEqual(later)
  })

  it('reads hours taken off as none, from that Sunday on', () => {
    const rows = [row({}), row({ days: null, hours_per_week: 0, effective_from: '2026-11-29', set_at: '2026-11-27T09:00:00Z' })]
    expect(workingHoursInForce(rows, '2026-11-28')).toEqual(SIX_TO_NOON)
    expect(workingHoursInForce(rows, '2026-11-29')).toBeNull()
    expect(setRowInForce(rows, '2026-11-29')?.days).toBeNull()
  })

  it('says when the hours are about to change, and keeps every save', () => {
    const next = row({ days: weekdays([420, 780]), effective_from: '2026-11-29', set_at: '2026-11-24T09:00:00Z' })
    const rows = [row({}), next]
    expect(workingHoursComing(rows, '2026-11-25')).toBe(next)
    expect(workingHoursComing(rows, '2026-11-29')).toBeNull()
    expect(workingHoursHistory([...rows, row({ kind: 'answer' })]).map((r) => r.effective_from)).toEqual(['2026-11-29', '2026-11-22'])
  })

  it('lets the newest save in force hold, over an older save for a later Sunday', () => {
    // Next week was saved first. Then this week was changed: that newer save holds next week too.
    const nextWeek = row({ days: weekdays([420, 780]), effective_from: '2026-11-29', set_at: '2026-11-23T11:00:00Z' })
    const thisWeek = row({ days: weekdays([360, 615]), set_at: '2026-11-24T09:00:00Z' })
    const rows = [row({}), nextWeek, thisWeek]
    expect(workingHoursInForce(rows, '2026-11-25')).toEqual(weekdays([360, 615]))
    expect(workingHoursInForce(rows, '2026-12-02')).toEqual(weekdays([360, 615]))
    expect(workingHoursComing(rows, '2026-11-25')).toBeNull()
    // Saved the other way round, next week does take over.
    const later = row({ days: weekdays([420, 780]), effective_from: '2026-11-29', set_at: '2026-11-25T09:00:00Z' })
    expect(workingHoursInForce([...rows, later], '2026-11-28')).toEqual(weekdays([360, 615]))
    expect(workingHoursInForce([...rows, later], '2026-11-29')).toEqual(weekdays([420, 780]))
    expect(workingHoursComing([...rows, later], '2026-11-25')).toBe(later)
  })

  it('reaches the clock from the day after a save, so a running session is never moved', () => {
    // Saved Wednesday Nov 25 at 9:00 AM Central, for the Sunday of Nov 22.
    const before = row({ set_at: '2026-11-21T18:00:00Z' })
    const midWeek = row({ days: weekdays([420, 780]), set_at: '2026-11-25T15:00:00Z' })
    expect(workingDayForClock([before, midWeek], '2026-11-25')).toEqual([[360, 720]])
    expect(workingDayForClock([before, midWeek], '2026-11-26')).toEqual([[420, 780]])
    expect(workingDayForClock([before, midWeek], '2026-11-28')).toEqual([])
    expect(workingDayForClock([midWeek], '2026-11-25')).toBeNull()
    expect(workingDayForClock([before], '2026-11-21')).toBeNull()
    expect(workingDayForClock([before, row({ days: null, set_at: '2026-11-23T18:00:00Z' })], '2026-11-25')).toBeNull()
  })

  it('names the two Sundays hours may start on', () => {
    expect(workingHoursStarts('2026-11-25')).toEqual({ thisWeek: '2026-11-22', nextWeek: '2026-11-29' })
    expect(workingHoursStarts('2026-11-22')).toEqual({ thisWeek: '2026-11-22', nextWeek: '2026-11-29' })
  })
})

describe('the lines', () => {
  it('puts days that share their hours on one line, wherever they fall', () => {
    expect(workingHoursLines(SIX_TO_NOON).map((l) => [workingDaysLabel(l.days), workingRangesWords(l.segs), workingLineHoursWords(l)])).toEqual([
      ['Mon to Fri', '6:00 AM to 12:00 PM', '6 h a day'],
      ['Sat, Sun', 'Off', '0 h'],
    ])
    expect(workingHoursLines(HALF_WEDNESDAY).map((l) => [workingDaysLabel(l.days), workingRangesWords(l.segs), workingLineHoursWords(l)])).toEqual([
      ['Mon, Tue, Thu, Fri', '7:00 AM to 3:00 PM', '8 h a day'],
      ['Wed', '7:00 AM to 11:00 AM', '4 h'],
      ['Sat, Sun', 'Off', '0 h'],
    ])
  })

  it('labels a run of three or more as a range', () => {
    expect(workingDaysLabel([1, 2, 3, 4, 5])).toBe('Mon to Fri')
    expect(workingDaysLabel([1, 2])).toBe('Mon, Tue')
    expect(workingDaysLabel([1, 2, 3, 5])).toBe('Mon to Wed, Fri')
    expect(workingDaysLabel([5, 6, 0])).toBe('Fri to Sun')
    expect(workingDaysLabel([3])).toBe('Wed')
  })

  it('says a lunch, a week on one line and how many days', () => {
    expect(workingRangesWords([[420, 690], [720, 930]])).toBe('7:00 AM to 11:30 AM, then 12:00 PM to 3:30 PM')
    expect(workingWeekLineWords(SIX_TO_NOON)).toBe('6:00 AM to 12:00 PM Mon to Fri')
    expect(workingWeekLineWords(HALF_WEDNESDAY)).toBe('7:00 AM to 3:00 PM Mon, Tue, Thu, Fri. 7:00 AM to 11:00 AM Wed')
    expect(workingWeekLineWords([[], [], [], [], [], [], []])).toBe('no working days')
    expect(workingDaysCountWords(SIX_TO_NOON)).toBe('five days')
    expect(workingDaysCountWords([[], day([360, 720]), [], [], [], [], []])).toBe('one day')
  })

  it('prints the clock, midnight at either end included', () => {
    expect(formatWorkingClock(360)).toBe('6:00 AM')
    expect(formatWorkingClock(720)).toBe('12:00 PM')
    expect(formatWorkingClock(615)).toBe('10:15 AM')
    expect(formatWorkingClock(0)).toBe('12:00 AM')
    expect(formatWorkingClock(1440)).toBe('12:00 AM')
    expect(workingClockChoices('start')[0]).toEqual({ value: '0', label: '12:00 AM' })
    expect(workingClockChoices('start')).toHaveLength(96)
    expect(workingClockChoices('end')[0]).toEqual({ value: '15', label: '12:15 AM' })
    expect(workingClockChoices('end')[95]).toEqual({ value: '1440', label: '12:00 AM' })
  })
})

describe('the moves the field makes', () => {
  it('gives one line’s days new ranges and leaves the rest', () => {
    expect(withWorkingDays(SIX_TO_NOON, [1, 2, 3, 4, 5], [[420, 780]])).toEqual(weekdays([420, 780]))
    const wed = withWorkingDays(weekdays([420, 900]), [3], [[420, 660]])
    expect(wed).toEqual(HALF_WEDNESDAY)
    expect(withWorkingDays(wed, [3], [])[3]).toEqual([])
    expect(SIX_TO_NOON[1]).toEqual([[360, 720]])
  })

  it('halves a day on the quarter hour', () => {
    expect(halfDay([[420, 900]])).toEqual([[420, 660]])
    expect(halfDay([[360, 615]])).toEqual([[360, 495]])
    expect(halfDay([[420, 690], [720, 930]])).toEqual([[420, 660]])
    expect(halfDay([])).toEqual([])
  })

  it('finds the hours the other days share', () => {
    expect(usualWorkingDay(HALF_WEDNESDAY, [3])).toEqual([[420, 900]])
    expect(usualWorkingDay(HALF_WEDNESDAY)).toEqual([[420, 900]])
    expect(usualWorkingDay([[], day([360, 720]), [], [], [], [], []], [1])).toBeNull()
  })
})

describe('the words a person reads', () => {
  it('says one line of hours as one sentence, with its values marked', () => {
    const [s] = workingHoursSentences(SIX_TO_NOON)
    expect(plain(s!)).toBe('Your hours are 6:00 AM to 12:00 PM, Mon to Fri.')
    expect(sentenceParts(s!).filter((p) => typeof p !== 'string')).toEqual([
      { kind: 'time', text: '6:00 AM' },
      { kind: 'time', text: '12:00 PM' },
      { kind: 'days', text: 'Mon to Fri' },
    ])
  })

  it('names each line of a week that differs day to day', () => {
    expect(workingHoursSentences(HALF_WEDNESDAY).map(plain)).toEqual(['Mon, Tue, Thu, Fri: 7:00 AM to 3:00 PM.', 'Wed: 7:00 AM to 11:00 AM.'])
    expect(workingHoursSentences([[], [], [], [], [], [], []])).toEqual(['You have no working days set.'])
  })

  it('says what a change comes to before it is kept', () => {
    expect(plain(workingChangeSentence({ days: weekdays([420, 900]), dows: [3], segs: [[420, 660]] }))).toBe('Wed would be 7:00 AM to 11:00 AM, 4 h. The week would be 36 h.')
    expect(plain(workingChangeSentence({ days: SIX_TO_NOON, dows: [1, 2, 3, 4, 5], segs: [[420, 780]] }))).toBe('Mon to Fri would be 7:00 AM to 1:00 PM, 6 h a day. The week would be 30 h.')
    expect(plain(workingChangeSentence({ days: SIX_TO_NOON, dows: [5], segs: [] }))).toBe('Fri would be off. The week would be 24 h.')
    for (const s of [workingChangeSentence({ days: SIX_TO_NOON, dows: [5], segs: [[360, 615]] }), ...workingHoursSentences(HALF_WEDNESDAY), ...workingHoursSentences(SIX_TO_NOON)]) expect(plainWordsFailures(plain(s))).toEqual([])
  })
})
