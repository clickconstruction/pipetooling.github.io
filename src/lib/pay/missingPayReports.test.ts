import { describe, expect, it } from 'vitest'
import { payStubOverlapsPeriod, peopleMissingPayReports } from './missingPayReports'

const start = '2026-09-20'
const end = '2026-09-26'
const days = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26']

function costs(byPerson: Record<string, number>) {
  // The same figure every weekday, nothing on the weekend.
  return (person: string, workDate: string) => {
    const day = new Date(workDate + 'T12:00:00').getDay()
    return day === 0 || day === 6 ? 0 : (byPerson[person] ?? 0)
  }
}

describe('payStubOverlapsPeriod', () => {
  const stub = (period_start: string, period_end: string) => ({ person_name: 'Alex', period_start, period_end })

  it('counts a report for the same week, and one that only touches an end', () => {
    expect(payStubOverlapsPeriod(stub('2026-09-20', '2026-09-26'), start, end)).toBe(true)
    expect(payStubOverlapsPeriod(stub('2026-09-13', '2026-09-20'), start, end)).toBe(true)
    expect(payStubOverlapsPeriod(stub('2026-09-26', '2026-10-03'), start, end)).toBe(true)
  })

  it('does not count the week before or the week after', () => {
    expect(payStubOverlapsPeriod(stub('2026-09-13', '2026-09-19'), start, end)).toBe(false)
    expect(payStubOverlapsPeriod(stub('2026-09-27', '2026-10-03'), start, end)).toBe(false)
  })
})

describe('peopleMissingPayReports', () => {
  it('lists everyone with pay due and no report, in the order given', () => {
    const out = peopleMissingPayReports({ people: ['Sam', 'Alex', 'Jo'], payStubs: [], start, end, days, costForPersonDate: costs({ Sam: 200, Alex: 240, Jo: 160 }) })
    expect(out).toEqual(['Sam', 'Alex', 'Jo'])
  })

  it('leaves out a person whose week comes to nothing', () => {
    // A salaried person out unpaid all week: the preview prices every day at 0.
    const out = peopleMissingPayReports({ people: ['Alex', 'Out All Week'], payStubs: [], start, end, days, costForPersonDate: costs({ Alex: 240, 'Out All Week': 0 }) })
    expect(out).toEqual(['Alex'])
  })

  it('leaves out a person who already has a report touching the period', () => {
    const payStubs = [{ person_name: 'Alex', period_start: '2026-09-20', period_end: '2026-09-26' }]
    const out = peopleMissingPayReports({ people: ['Alex', 'Sam'], payStubs, start, end, days, costForPersonDate: costs({ Alex: 240, Sam: 200 }) })
    expect(out).toEqual(['Sam'])
  })

  it('reads a report by its own person only, and only for this period', () => {
    const payStubs = [
      { person_name: 'Sam', period_start: '2026-09-20', period_end: '2026-09-26' },
      { person_name: 'Alex', period_start: '2026-09-13', period_end: '2026-09-19' },
    ]
    const out = peopleMissingPayReports({ people: ['Alex'], payStubs, start, end, days, costForPersonDate: costs({ Alex: 240 }) })
    expect(out).toEqual(['Alex'])
  })

  it('counts one paid day as pay due', () => {
    const oneDay = (person: string, workDate: string) => (person === 'Alex' && workDate === '2026-09-23' ? 120 : 0)
    expect(peopleMissingPayReports({ people: ['Alex'], payStubs: [], start, end, days, costForPersonDate: oneDay })).toEqual(['Alex'])
  })

  it('is empty with no people or no days', () => {
    expect(peopleMissingPayReports({ people: [], payStubs: [], start, end, days, costForPersonDate: costs({}) })).toEqual([])
    expect(peopleMissingPayReports({ people: ['Alex'], payStubs: [], start, end, days: [], costForPersonDate: costs({ Alex: 240 }) })).toEqual([])
  })
})
