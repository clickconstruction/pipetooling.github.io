import { describe, expect, it } from 'vitest'
import { buildPayStubDayRows, payStubDaysInRange, payStubTotals } from './generatePayStub'
import { EMPTY_SALARIED_PAYROLL_WINDOW } from '../salariedPayrollDays'

describe('pay report day rows', () => {
  it('lists every calendar day of the period, inclusive, and nothing for an inverted range', () => {
    expect(payStubDaysInRange('2026-09-13', '2026-09-15')).toEqual(['2026-09-13', '2026-09-14', '2026-09-15'])
    expect(payStubDaysInRange('2026-09-15', '2026-09-13')).toEqual([])
  })

  it('hourly: each day is its recorded hours at the wage; days without hours are $0 rows', () => {
    const rows = buildPayStubDayRows({
      daysInRange: ['2026-09-14', '2026-09-15'],
      hoursByDate: new Map([['2026-09-14', 8.5]]),
      wage: 20,
      officeWage: null,
      salaryWindow: null,
      splitByDate: null,
    })
    expect(rows).toEqual([
      { work_date: '2026-09-14', hours: 8.5, paid_amount: 170, rate_at_time: 20, office_hours: null, office_rate: null, job_hours: null, job_rate: null },
      { work_date: '2026-09-15', hours: 0, paid_amount: 0, rate_at_time: 20, office_hours: null, office_rate: null, job_hours: null, job_rate: null },
    ])
    expect(payStubTotals(rows)).toEqual({ hoursTotal: 8.5, grossPay: 170 })
  })

  it('salaried: the flat 8 h weekday credit, 0 on the weekend and after the employment end', () => {
    // 2026-09-18 is a Friday, 19 a Saturday, 21 a Monday.
    const rows = buildPayStubDayRows({
      daysInRange: ['2026-09-18', '2026-09-19', '2026-09-21'],
      hoursByDate: new Map(),
      wage: 30,
      officeWage: null,
      salaryWindow: { ...EMPTY_SALARIED_PAYROLL_WINDOW, employmentEnd: '2026-09-18' },
      splitByDate: null,
    })
    expect(rows.map((r) => [r.work_date, r.hours, r.paid_amount])).toEqual([
      ['2026-09-18', 8, 240],
      ['2026-09-19', 0, 0],
      ['2026-09-21', 0, 0],
    ])
  })

  it('dual rate: a split day carries both buckets and the blended rate; an unsplit day stays single-rate', () => {
    const rows = buildPayStubDayRows({
      daysInRange: ['2026-09-14', '2026-09-15'],
      hoursByDate: new Map([
        ['2026-09-14', 8],
        ['2026-09-15', 4],
      ]),
      wage: 20,
      officeWage: 25,
      salaryWindow: null,
      splitByDate: new Map([['2026-09-14', { officeHours: 2, jobHours: 6, paidAmount: 170, blendedRate: 21.25 } as never]]),
    })
    expect(rows[0]).toMatchObject({ work_date: '2026-09-14', hours: 8, paid_amount: 170, rate_at_time: 21.25, office_hours: 2, office_rate: 25, job_hours: 6, job_rate: 20 })
    expect(rows[1]).toMatchObject({ work_date: '2026-09-15', hours: 4, paid_amount: 80, rate_at_time: 20, office_hours: null })
  })
})
