import { describe, expect, it } from 'vitest'
import {
  EMPTY_SALARIED_PAYROLL_WINDOW,
  isWeekendYmd,
  salariedDayCredit,
  salariedDayCreditReasonLabel,
  salariedHoursForDay,
  type SalariedPayrollWindow,
} from './salariedPayrollDays'

// 2026-07-13 is a Monday; 2026-07-18 Saturday; 2026-07-19 Sunday.
const MON = '2026-07-13'
const TUE = '2026-07-14'
const WED = '2026-07-15'
const SAT = '2026-07-18'
const SUN = '2026-07-19'

function windowWith(partial: Partial<SalariedPayrollWindow>): SalariedPayrollWindow {
  return { ...EMPTY_SALARIED_PAYROLL_WINDOW, ...partial }
}

describe('isWeekendYmd', () => {
  it('is false Mon–Fri, true Sat/Sun', () => {
    expect(isWeekendYmd(MON)).toBe(false)
    expect(isWeekendYmd('2026-07-17')).toBe(false)
    expect(isWeekendYmd(SAT)).toBe(true)
    expect(isWeekendYmd(SUN)).toBe(true)
  })
})

describe('salariedDayCredit — flat rule with no adjustments', () => {
  it('credits 8 on a weekday', () => {
    expect(salariedDayCredit(MON, EMPTY_SALARIED_PAYROLL_WINDOW)).toEqual({ hours: 8, reason: 'workday' })
  })
  it('credits 0 on weekends', () => {
    expect(salariedDayCredit(SAT, EMPTY_SALARIED_PAYROLL_WINDOW)).toEqual({ hours: 0, reason: 'weekend' })
    expect(salariedDayCredit(SUN, EMPTY_SALARIED_PAYROLL_WINDOW)).toEqual({ hours: 0, reason: 'weekend' })
  })
})

describe('salariedDayCredit — time off', () => {
  it('unpaid time off zeroes a weekday (inclusive bounds)', () => {
    const w = windowWith({ timeOff: [{ start_date: MON, end_date: TUE, kind: 'unpaid' }] })
    expect(salariedDayCredit(MON, w)).toEqual({ hours: 0, reason: 'unpaid_time_off' })
    expect(salariedDayCredit(TUE, w)).toEqual({ hours: 0, reason: 'unpaid_time_off' })
    expect(salariedDayCredit(WED, w)).toEqual({ hours: 8, reason: 'workday' })
  })
  it('paid time off keeps the 8 h', () => {
    const w = windowWith({ timeOff: [{ start_date: MON, end_date: MON, kind: 'paid' }] })
    expect(salariedDayCredit(MON, w)).toEqual({ hours: 8, reason: 'paid_time_off' })
  })
  it('weekend stays 0 even under paid time off', () => {
    const w = windowWith({ timeOff: [{ start_date: MON, end_date: SUN, kind: 'paid' }] })
    expect(salariedDayCredit(SAT, w)).toEqual({ hours: 0, reason: 'weekend' })
  })
  it('unpaid wins when paid and unpaid ranges overlap', () => {
    const w = windowWith({
      timeOff: [
        { start_date: MON, end_date: WED, kind: 'paid' },
        { start_date: TUE, end_date: TUE, kind: 'unpaid' },
      ],
    })
    expect(salariedDayCredit(MON, w)).toEqual({ hours: 8, reason: 'paid_time_off' })
    expect(salariedDayCredit(TUE, w)).toEqual({ hours: 0, reason: 'unpaid_time_off' })
  })
})

describe('salariedDayCredit — employment window', () => {
  it('no credit before start or after end (inclusive window)', () => {
    const w = windowWith({ employmentStart: TUE, employmentEnd: WED })
    expect(salariedDayCredit(MON, w)).toEqual({ hours: 0, reason: 'before_start' })
    expect(salariedDayCredit(TUE, w)).toEqual({ hours: 8, reason: 'workday' })
    expect(salariedDayCredit(WED, w)).toEqual({ hours: 8, reason: 'workday' })
    expect(salariedDayCredit('2026-07-16', w)).toEqual({ hours: 0, reason: 'after_end' })
  })
  it('null bounds do not clamp', () => {
    const w = windowWith({ employmentStart: null, employmentEnd: null })
    expect(salariedHoursForDay(MON, w)).toBe(8)
  })
  it('employment clamp beats paid time off', () => {
    const w = windowWith({
      employmentEnd: MON,
      timeOff: [{ start_date: TUE, end_date: TUE, kind: 'paid' }],
    })
    expect(salariedDayCredit(TUE, w)).toEqual({ hours: 0, reason: 'after_end' })
  })
})

describe('salariedDayCreditReasonLabel', () => {
  it('labels the annotation-worthy reasons and stays quiet for plain days', () => {
    expect(salariedDayCreditReasonLabel('unpaid_time_off')).toBe('unpaid time off')
    expect(salariedDayCreditReasonLabel('paid_time_off')).toBe('paid time off')
    expect(salariedDayCreditReasonLabel('before_start')).toBe('before employment start')
    expect(salariedDayCreditReasonLabel('after_end')).toBe('after employment end')
    expect(salariedDayCreditReasonLabel('workday')).toBeNull()
    expect(salariedDayCreditReasonLabel('weekend')).toBeNull()
  })
})
