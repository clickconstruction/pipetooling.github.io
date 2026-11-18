import { describe, expect, it } from 'vitest'
import {
  canEditRecordedHours,
  effectiveHoursForCost,
  effectiveHoursForDisplay,
  formatDayHours,
  SALARIED_DEFAULT_WEEK,
  salariedFlatDayHours,
  salariedUniformDayHours,
  salariedWeekHours,
  salariedWeekOf,
  salariedWeekWords,
  salariedWeeklyPay,
  wageForWeeklyPay,
} from './salariedEffectiveHours'

const HOURLY = { is_salary: false, record_hours_but_salary: false }
const SALARIED = { is_salary: true, record_hours_but_salary: false }
const SALARIED_RECORDING = { is_salary: true, record_hours_but_salary: true }

describe('salariedFlatDayHours', () => {
  it('credits 8 hours Monday through Friday', () => {
    // 2026-07-06 is a Monday
    expect(salariedFlatDayHours('2026-07-06')).toBe(8)
    expect(salariedFlatDayHours('2026-07-07')).toBe(8)
    expect(salariedFlatDayHours('2026-07-08')).toBe(8)
    expect(salariedFlatDayHours('2026-07-09')).toBe(8)
    expect(salariedFlatDayHours('2026-07-10')).toBe(8)
  })

  it('credits 0 hours on weekends', () => {
    expect(salariedFlatDayHours('2026-07-04')).toBe(0) // Saturday
    expect(salariedFlatDayHours('2026-07-05')).toBe(0) // Sunday
  })

  it('is stable across DST transition dates (noon anchor)', () => {
    expect(salariedFlatDayHours('2026-03-08')).toBe(0) // Sunday, US spring-forward
    expect(salariedFlatDayHours('2026-03-09')).toBe(8) // Monday after
    expect(salariedFlatDayHours('2026-11-01')).toBe(0) // Sunday, US fall-back
    expect(salariedFlatDayHours('2026-11-02')).toBe(8) // Monday after
  })
})

describe('effectiveHoursForCost', () => {
  it('hourly people cost their recorded hours', () => {
    expect(effectiveHoursForCost(HOURLY, '2026-07-06', 6.5)).toBe(6.5)
    expect(effectiveHoursForCost(undefined, '2026-07-06', 6.5)).toBe(6.5)
  })

  it('salaried people cost flat 8/0 regardless of recorded hours', () => {
    expect(effectiveHoursForCost(SALARIED, '2026-07-06', 3)).toBe(8)
    expect(effectiveHoursForCost(SALARIED, '2026-07-04', 3)).toBe(0)
  })

  it('record_hours_but_salary does NOT change costing — still flat 8/0', () => {
    expect(effectiveHoursForCost(SALARIED_RECORDING, '2026-07-06', 3)).toBe(8)
    expect(effectiveHoursForCost(SALARIED_RECORDING, '2026-07-04', 11)).toBe(0)
  })
})

describe('effectiveHoursForDisplay', () => {
  it('hourly people display their recorded hours', () => {
    expect(effectiveHoursForDisplay(HOURLY, '2026-07-06', 6.5)).toBe(6.5)
    expect(effectiveHoursForDisplay(undefined, '2026-07-06', 0)).toBe(0)
  })

  it('plain salaried people display flat 8/0', () => {
    expect(effectiveHoursForDisplay(SALARIED, '2026-07-06', 3)).toBe(8)
    expect(effectiveHoursForDisplay(SALARIED, '2026-07-05', 3)).toBe(0)
  })

  it('record_hours_but_salary people display their recorded hours, including weekends and zero', () => {
    expect(effectiveHoursForDisplay(SALARIED_RECORDING, '2026-07-06', 3)).toBe(3)
    expect(effectiveHoursForDisplay(SALARIED_RECORDING, '2026-07-04', 11)).toBe(11)
    expect(effectiveHoursForDisplay(SALARIED_RECORDING, '2026-07-06', 0)).toBe(0)
  })
})

describe('canEditRecordedHours', () => {
  it('hourly people (and missing config) can edit', () => {
    expect(canEditRecordedHours(HOURLY)).toBe(true)
    expect(canEditRecordedHours(undefined)).toBe(true)
  })

  it('plain salaried people cannot edit', () => {
    expect(canEditRecordedHours(SALARIED)).toBe(false)
  })

  it('salaried people with record_hours_but_salary can edit', () => {
    expect(canEditRecordedHours(SALARIED_RECORDING)).toBe(true)
  })
})

describe('a salaried week of the person\'s own shape', () => {
  // 2026-07-05 is a Sunday, 2026-07-06 a Monday, 2026-07-10 a Friday, 2026-07-11 a Saturday.
  const SIX = [0, 6, 6, 6, 6, 6, 0]
  const SHORT_FRIDAY = [0, 8, 8, 8, 8, 4, 0]
  const FOUR_TENS = [0, 10, 10, 10, 10, 0, 0]
  const TUE_TO_SAT = [0, 0, 8, 8, 8, 8, 8]

  it('reads the pay row\'s week, numbers or their text', () => {
    expect(salariedWeekOf({ salaried_week_hours: SIX })).toEqual(SIX)
    expect(salariedWeekOf({ salaried_week_hours: ['0.00', '7.50', '7.50', '7.50', '7.50', '4.00', '0.00'] })).toEqual([0, 7.5, 7.5, 7.5, 7.5, 4, 0])
  })

  it('a week that is missing or malformed reads as the default whole, never patched day by day', () => {
    for (const bad of [undefined, null, [], [0, 8, 8, 8, 8, 8], [0, 8, 8, 8, 8, 8, 0, 0], [0, 8, null, 8, 8, 8, 0], [0, 8, 'x', 8, 8, 8, 0], [0, 8, -1, 8, 8, 8, 0], [0, 8, 17, 8, 8, 8, 0], '0,8,8,8,8,8,0', 8]) {
      expect(salariedWeekOf({ salaried_week_hours: bad })).toEqual(SALARIED_DEFAULT_WEEK)
    }
    expect(salariedWeekOf({})).toEqual(SALARIED_DEFAULT_WEEK)
    expect(salariedWeekOf(undefined)).toEqual(SALARIED_DEFAULT_WEEK)
    expect(salariedWeekOf(null)).toEqual(SALARIED_DEFAULT_WEEK)
  })

  it('the flat day is that weekday\'s hours, and a Saturday pays when the week says so', () => {
    expect(salariedFlatDayHours('2026-07-06', SIX)).toBe(6)
    expect(salariedFlatDayHours('2026-07-11', SIX)).toBe(0)
    expect(salariedFlatDayHours('2026-07-10', SHORT_FRIDAY)).toBe(4)
    expect(salariedFlatDayHours('2026-07-10', FOUR_TENS)).toBe(0)
    expect(salariedFlatDayHours('2026-07-11', TUE_TO_SAT)).toBe(8)
    expect(salariedFlatDayHours('2026-07-06', TUE_TO_SAT)).toBe(0)
    expect(salariedFlatDayHours('2026-07-05', TUE_TO_SAT)).toBe(0)
    // No week given: the rule as it was.
    expect(salariedFlatDayHours('2026-07-06')).toBe(8)
    expect(salariedFlatDayHours('2026-07-11')).toBe(0)
  })

  it('cost and display read the week from the pay row', () => {
    const six = { is_salary: true, record_hours_but_salary: false, salaried_week_hours: SIX }
    expect(effectiveHoursForCost(six, '2026-07-06', 9.5)).toBe(6)
    expect(effectiveHoursForCost(six, '2026-07-11', 9.5)).toBe(0)
    expect(effectiveHoursForDisplay(six, '2026-07-06', 9.5)).toBe(6)
    // Recording real hours still shows them, and still costs the flat day.
    const sixRecording = { ...six, record_hours_but_salary: true }
    expect(effectiveHoursForDisplay(sixRecording, '2026-07-06', 5.25)).toBe(5.25)
    expect(effectiveHoursForCost(sixRecording, '2026-07-06', 5.25)).toBe(6)
    // An hourly row's week means nothing.
    expect(effectiveHoursForCost({ is_salary: false, salaried_week_hours: SIX }, '2026-07-06', 9.5)).toBe(9.5)
  })

  it('a week adds up, and the wage and the weekly pay turn into each other', () => {
    expect(salariedWeekHours(SIX)).toBe(30)
    expect(salariedWeekHours(SHORT_FRIDAY)).toBe(36)
    expect(salariedWeekHours()).toBe(40)
    expect(salariedWeeklyPay(10, SIX)).toBe(300)
    expect(salariedWeeklyPay(7.5)).toBe(300)
    expect(wageForWeeklyPay(300, SIX)).toBe(10)
    expect(wageForWeeklyPay(300)).toBe(7.5)
    expect(wageForWeeklyPay(1000, SHORT_FRIDAY)).toBe(27.78)
    expect(wageForWeeklyPay(0, SIX)).toBeNull()
    expect(wageForWeeklyPay(300, [0, 0, 0, 0, 0, 0, 0])).toBeNull()
  })

  it('knows when every paid day is the same length', () => {
    expect(salariedUniformDayHours(SIX)).toBe(6)
    expect(salariedUniformDayHours(FOUR_TENS)).toBe(10)
    expect(salariedUniformDayHours(SHORT_FRIDAY)).toBeNull()
    expect(salariedUniformDayHours([0, 0, 0, 0, 0, 0, 0])).toBeNull()
  })

  it('says a week in words, days that share their hours together, Monday first', () => {
    expect(salariedWeekWords()).toBe('8 h Mon to Fri')
    expect(salariedWeekWords(SIX)).toBe('6 h Mon to Fri')
    expect(salariedWeekWords(SHORT_FRIDAY)).toBe('8 h Mon to Thu, 4 h Fri')
    expect(salariedWeekWords(FOUR_TENS)).toBe('10 h Mon to Thu')
    expect(salariedWeekWords(TUE_TO_SAT)).toBe('8 h Tue to Sat')
    expect(salariedWeekWords([8, 0, 0, 0, 0, 0, 8])).toBe('8 h Sat to Sun')
    expect(salariedWeekWords([0, 8, 0, 8, 0, 8, 0])).toBe('8 h Mon, 8 h Wed, 8 h Fri')
    expect(salariedWeekWords([0, 7.5, 7.5, 0, 0, 0, 0])).toBe('7.5 h Mon to Tue')
    expect(salariedWeekWords([0, 0, 0, 0, 0, 0, 0])).toBe('no paid days')
  })

  it('writes hours without trailing zeros', () => {
    expect(formatDayHours(8)).toBe('8')
    expect(formatDayHours(7.5)).toBe('7.5')
    expect(formatDayHours(6.25)).toBe('6.25')
  })
})
