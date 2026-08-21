import { describe, expect, it } from 'vitest'
import { EMPTY_SALARIED_PAYROLL_WINDOW } from './salariedPayrollDays'
import { scanWeeksBefore, unreportedPayrollWeeks } from './unreportedPayrollWeeks'

describe('scanWeeksBefore', () => {
  it('returns Sun–Sat weeks before the period, newest first', () => {
    // 2026-08-09 is a Sunday.
    expect(scanWeeksBefore('2026-08-09', 2)).toEqual([
      { weekStart: '2026-08-02', weekEnd: '2026-08-08' },
      { weekStart: '2026-07-26', weekEnd: '2026-08-01' },
    ])
  })

  it('anchors a mid-week period start to its own week', () => {
    // 2026-08-12 is a Wednesday — the first scan week is still Aug 2–8.
    expect(scanWeeksBefore('2026-08-12', 1)).toEqual([{ weekStart: '2026-08-02', weekEnd: '2026-08-08' }])
  })

  it('handles zero weeks and bad dates', () => {
    expect(scanWeeksBefore('2026-08-09', 0)).toEqual([])
    expect(scanWeeksBefore('garbage', 3)).toEqual([])
  })
})

describe('unreportedPayrollWeeks', () => {
  const weeks = [
    { weekStart: '2026-08-02', weekEnd: '2026-08-08' },
    { weekStart: '2026-07-26', weekEnd: '2026-08-01' },
  ]
  const payConfig = {
    Bryan: { hourly_wage: 35, is_salary: false },
    Darren: { hourly_wage: 12.5, is_salary: false },
    Sal: { hourly_wage: 20, is_salary: true },
  }

  it('lists hourly person-weeks with hours and no overlapping stub, newest week first, people A→Z', () => {
    const rows = unreportedPayrollWeeks({
      weeks,
      peopleNames: ['Darren', 'Bryan'],
      hoursRows: [
        { person_name: 'Bryan', work_date: '2026-08-03', hours: 6 },
        { person_name: 'Bryan', work_date: '2026-08-04', hours: 4 },
        { person_name: 'Darren', work_date: '2026-07-27', hours: 5 },
      ],
      payConfig,
      salaryWindows: {},
      stubs: [],
    })
    expect(rows).toEqual([
      { personName: 'Bryan', weekStart: '2026-08-02', weekEnd: '2026-08-08', hours: 10, estGross: 350 },
      { personName: 'Darren', weekStart: '2026-07-26', weekEnd: '2026-08-01', hours: 5, estGross: 62.5 },
    ])
  })

  it('excludes weeks any stub overlaps, using the Draft Payroll overlap predicate', () => {
    const rows = unreportedPayrollWeeks({
      weeks,
      peopleNames: ['Bryan'],
      hoursRows: [
        { person_name: 'Bryan', work_date: '2026-08-03', hours: 6 },
        { person_name: 'Bryan', work_date: '2026-07-27', hours: 5 },
      ],
      payConfig,
      salaryWindows: {},
      // Stub straddles the Aug 2–8 week boundary — still covers it.
      stubs: [{ person_name: 'Bryan', period_start: '2026-08-06', period_end: '2026-08-12' }],
    })
    expect(rows).toEqual([
      { personName: 'Bryan', weekStart: '2026-07-26', weekEnd: '2026-08-01', hours: 5, estGross: 175 },
    ])
  })

  it('salaried people get flat weekday credit from their window, not people_hours', () => {
    const rows = unreportedPayrollWeeks({
      weeks: [{ weekStart: '2026-08-02', weekEnd: '2026-08-08' }],
      peopleNames: ['Sal'],
      hoursRows: [],
      payConfig,
      salaryWindows: { Sal: EMPTY_SALARIED_PAYROLL_WINDOW },
      stubs: [],
    })
    // 5 weekdays × 8h = 40h × $20.
    expect(rows).toEqual([
      { personName: 'Sal', weekStart: '2026-08-02', weekEnd: '2026-08-08', hours: 40, estGross: 800 },
    ])
  })

  it('drops sub-half-minute sliver weeks that would display as 0.00 h', () => {
    const rows = unreportedPayrollWeeks({
      weeks: [{ weekStart: '2026-08-02', weekEnd: '2026-08-08' }],
      peopleNames: ['Bryan'],
      hoursRows: [{ person_name: 'Bryan', work_date: '2026-08-03', hours: 0.004 }],
      payConfig,
      salaryWindows: {},
      stubs: [],
    })
    expect(rows).toEqual([])
  })

  it('drops zero-hour person-weeks and people without config still count hours at $0', () => {
    const rows = unreportedPayrollWeeks({
      weeks: [{ weekStart: '2026-08-02', weekEnd: '2026-08-08' }],
      peopleNames: ['Bryan', 'Ghost'],
      hoursRows: [{ person_name: 'Ghost', work_date: '2026-08-03', hours: 3 }],
      payConfig,
      salaryWindows: {},
      stubs: [],
    })
    expect(rows).toEqual([
      { personName: 'Ghost', weekStart: '2026-08-02', weekEnd: '2026-08-08', hours: 3, estGross: 0 },
    ])
  })
})
