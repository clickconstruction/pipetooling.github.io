import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  EMPTY_SALARIED_PAYROLL_WINDOW,
  fetchSalariedPayrollWindows,
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

describe('salariedDayCredit — a person who left and came back (v2.6526)', () => {
  const stints = [
    { start_date: '2024-03-04', end_date: '2026-07-14' },
    { start_date: '2026-07-16', end_date: null },
  ]
  // The pair is the current stint, so without the stints the first stint's Monday would clamp to zero.
  const w = windowWith({ employmentStart: '2026-07-16', employmentEnd: null, stints })

  it('a day in the first stint still pays', () => {
    expect(salariedDayCredit(MON, w)).toEqual({ hours: 8, reason: 'workday' })
    expect(salariedDayCredit(MON, windowWith({ employmentStart: '2026-07-16', employmentEnd: null }))).toEqual({ hours: 0, reason: 'before_start' })
  })

  it('a day in the gap does not, and a day before the first start is before the start', () => {
    expect(salariedDayCredit(WED, w)).toEqual({ hours: 0, reason: 'after_end' })
    expect(salariedDayCredit('2024-03-01', w)).toEqual({ hours: 0, reason: 'before_start' })
    expect(salariedDayCredit('2026-07-17', w)).toEqual({ hours: 8, reason: 'workday' })
  })

  it('one stint leaves the pair as the clamp', () => {
    expect(salariedDayCredit(MON, windowWith({ employmentStart: '2026-07-16', employmentEnd: null, stints: [stints[1]!] }))).toEqual({ hours: 0, reason: 'before_start' })
  })
})

describe('a salaried week of the person\'s own shape', () => {
  const SIX = [0, 6, 6, 6, 6, 6, 0]
  const FRI = '2026-07-17'

  it('a workday and a paid day off pay that day\'s hours; unpaid and outside the window still pay 0', () => {
    const six = windowWith({ week: SIX })
    expect(salariedDayCredit(MON, six)).toEqual({ hours: 6, reason: 'workday' })
    expect(salariedDayCredit(SAT, six)).toEqual({ hours: 0, reason: 'weekend' })
    expect(salariedDayCredit(TUE, windowWith({ week: SIX, timeOff: [{ start_date: TUE, end_date: TUE, kind: 'paid' }] }))).toEqual({ hours: 6, reason: 'paid_time_off' })
    expect(salariedDayCredit(TUE, windowWith({ week: SIX, timeOff: [{ start_date: TUE, end_date: TUE, kind: 'unpaid' }] }))).toEqual({ hours: 0, reason: 'unpaid_time_off' })
    expect(salariedDayCredit(MON, windowWith({ week: SIX, employmentStart: WED }))).toEqual({ hours: 0, reason: 'before_start' })
  })

  it('each day pays its own hours: a short Friday, and a weekday the week leaves out', () => {
    const shortFriday = windowWith({ week: [0, 8, 8, 8, 8, 4, 0] })
    expect(salariedDayCredit(MON, shortFriday)).toEqual({ hours: 8, reason: 'workday' })
    expect(salariedDayCredit(FRI, shortFriday)).toEqual({ hours: 4, reason: 'workday' })
    const fourTens = windowWith({ week: [0, 10, 10, 10, 10, 0, 0] })
    expect(salariedDayCredit(MON, fourTens)).toEqual({ hours: 10, reason: 'workday' })
    expect(salariedDayCredit(FRI, fourTens)).toEqual({ hours: 0, reason: 'day_off' })
    expect(salariedDayCreditReasonLabel('day_off')).toBe('not a paid day in their week')
  })

  it('a Saturday pays when the week says so, and a paid day off on a day off pays nothing', () => {
    const tueToSat = windowWith({ week: [0, 0, 8, 8, 8, 8, 8] })
    expect(salariedDayCredit(SAT, tueToSat)).toEqual({ hours: 8, reason: 'workday' })
    expect(salariedDayCredit(SUN, tueToSat)).toEqual({ hours: 0, reason: 'weekend' })
    expect(salariedDayCredit(MON, windowWith({ week: [0, 0, 8, 8, 8, 8, 8], timeOff: [{ start_date: MON, end_date: MON, kind: 'paid' }] }))).toEqual({ hours: 0, reason: 'day_off' })
  })

  it('a window with no week pays 8 on a weekday and 0 on a weekend', () => {
    expect(salariedHoursForDay(MON, EMPTY_SALARIED_PAYROLL_WINDOW)).toBe(8)
    expect(salariedHoursForDay(SAT, EMPTY_SALARIED_PAYROLL_WINDOW)).toBe(0)
  })

  /** A client that answers each table from a list, whatever the filters, and can fail one table. */
  function clientWith(tables: Record<string, unknown[]>, failing?: string): SupabaseClient {
    const from = (table: string) => {
      const answer = failing === table ? { data: null, error: { message: `${table} refused`, code: '42501' } } : { data: tables[table] ?? [], error: null }
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'in', 'lte', 'gte', 'eq']) q[m] = () => q
      q.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(answer).then(resolve, reject)
      return q
    }
    return { from } as unknown as SupabaseClient
  }

  it('the fetch puts each person\'s week on their window, and the default where the pay row has none', async () => {
    const windows = await fetchSalariedPayrollWindows(
      clientWith({
        users: [{ id: 'u1', name: 'Rosa Sample' }],
        people: [{ id: 'p1', name: 'Rosa Sample', start_date: '2026-07-01', end_date: null, archived_at: null }],
        people_pay_config: [
          { person_name: 'Rosa Sample', salaried_week_hours: SIX },
          { person_name: 'Ana Sample', salaried_week_hours: null },
        ],
        employment_stints: [],
        user_time_off: [],
      }),
      ['Rosa Sample', 'Ana Sample', 'No Row Sample'],
      MON,
      SUN,
    )
    expect(windows['Rosa Sample']?.week).toEqual(SIX)
    expect(windows['Rosa Sample']?.employmentStart).toBe('2026-07-01')
    expect(windows['Ana Sample']?.week).toEqual([0, 8, 8, 8, 8, 8, 0])
    expect(windows['No Row Sample']?.week).toBeUndefined()
    expect(salariedHoursForDay(MON, windows['Rosa Sample']!)).toBe(6)
    expect(salariedHoursForDay(MON, windows['No Row Sample']!)).toBe(8)
  })

  it('a pay row that cannot be read is thrown, never read as the default', async () => {
    await expect(
      fetchSalariedPayrollWindows(clientWith({ users: [], people: [] }, 'people_pay_config'), ['Rosa Sample'], MON, SUN),
    ).rejects.toThrow()
  })
})
