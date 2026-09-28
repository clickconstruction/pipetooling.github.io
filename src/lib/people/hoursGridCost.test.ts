import { describe, expect, it, vi } from 'vitest'
import { hoursGridDayCost, recordedHoursLookup, sortPeopleByTotalDesc } from './hoursGridCost'

// 2026-09-21 is a Monday, 2026-09-26 a Saturday.
describe('hoursGridDayCost', () => {
  it('is the wage times the hours recorded for an hourly person', () => {
    expect(hoursGridDayCost({ hourly_wage: 30 }, '2026-09-21', 6.5)).toBe(195)
    expect(hoursGridDayCost({ hourly_wage: 30 }, '2026-09-26', 4)).toBe(120)
  })

  it('is eight hours on a weekday and nothing on a weekend for a salaried person, whatever was recorded', () => {
    expect(hoursGridDayCost({ hourly_wage: 40, is_salary: true }, '2026-09-21', 11)).toBe(320)
    expect(hoursGridDayCost({ hourly_wage: 40, is_salary: true }, '2026-09-26', 11)).toBe(0)
    expect(hoursGridDayCost({ hourly_wage: 40, is_salary: true, record_hours_but_salary: true }, '2026-09-21', 3)).toBe(320)
  })

  it('is nothing with no wage on file or no pay row', () => {
    expect(hoursGridDayCost({ hourly_wage: null }, '2026-09-21', 8)).toBe(0)
    expect(hoursGridDayCost(undefined, '2026-09-21', 8)).toBe(0)
  })
})

describe('recordedHoursLookup', () => {
  const rows = [
    { person_name: 'Alex', work_date: '2026-09-21', hours: 8 },
    { person_name: 'Alex', work_date: '2026-09-22', hours: 6 },
    { person_name: 'Sam', work_date: '2026-09-21', hours: null },
    { person_name: 'Alex', work_date: '2026-09-21', hours: 99 },
  ]

  it('finds a person\'s day, and is zero for a day with no row', () => {
    const hoursFor = recordedHoursLookup(rows)
    expect(hoursFor('Alex', '2026-09-22')).toBe(6)
    expect(hoursFor('Alex', '2026-09-23')).toBe(0)
    expect(hoursFor('Jo', '2026-09-21')).toBe(0)
  })

  it('takes the first row for a day, and reads a blank as zero', () => {
    const hoursFor = recordedHoursLookup(rows)
    expect(hoursFor('Alex', '2026-09-21')).toBe(8)
    expect(hoursFor('Sam', '2026-09-21')).toBe(0)
  })
})

describe('sortPeopleByTotalDesc', () => {
  const totals: Record<string, number> = { Alex: 500, Sam: 900, Jo: 500, Zed: 0 }

  it('puts the highest total first and keeps the given order on a tie', () => {
    expect(sortPeopleByTotalDesc(['Alex', 'Sam', 'Jo', 'Zed'], (p) => totals[p] ?? 0)).toEqual(['Sam', 'Alex', 'Jo', 'Zed'])
    expect(sortPeopleByTotalDesc(['Jo', 'Zed', 'Alex'], (p) => totals[p] ?? 0)).toEqual(['Jo', 'Alex', 'Zed'])
  })

  it('works each total out once, and leaves the list it was handed as it was', () => {
    const totalFor = vi.fn((p: string) => totals[p] ?? 0)
    const people = ['Alex', 'Sam', 'Jo', 'Zed']
    sortPeopleByTotalDesc(people, totalFor)
    expect(totalFor).toHaveBeenCalledTimes(4)
    expect(people).toEqual(['Alex', 'Sam', 'Jo', 'Zed'])
  })
})
