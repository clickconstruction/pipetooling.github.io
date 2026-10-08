// @vitest-environment jsdom
/**
 * People → Review → Jobs Worked: the expanded detail row (punch list #46 row 8, v2.4909). The labor
 * sheet row and the crew-day row drew the same grid twice; one component now draws it for both.
 * These cases pin what the grid prints for one made-up job, that a crew day reads the same as a
 * labor sheet with the same numbers, the three overhead methods, the loading and no-rate states, and
 * the "User" fallback when nobody is picked.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ReviewJobExpandedDetail } from './ReviewJobExpandedDetail'
import { EMPTY_REVIEW_OVERHEAD_RATES, type ReviewOverheadRates } from '../../../lib/people/loadReviewOverheadRates'
import type { ReviewCrewJob, ReviewLaborJob } from '../../../lib/people/reviewPersonTypes'

afterEach(cleanup)

// Made-up figures, never a real job's.
const money = {
  service_type_id: null,
  hours: 8,
  laborCost: 400,
  driveCost: 40,
  partsCost: 1500,
  totalBill: 10000,
  valueCreated: 5000,
  pctComplete: 50,
  revenueBeforeOverhead: 2500,
  allocatedTotalBill: 800,
  allocatedRevenueBeforeOverhead: -12.5,
  allocatedPartsCost: 0,
  subLaborCost: 0,
  totalLaborOnJob: 3000,
  totalDriveCostOnJob: 200,
  totalJobHours: 60,
  userTotalHoursOnJob: 20,
  userTotalContributionToBill: 2000,
  userTotalContributionToRevenue: 1000,
  userTotalLaborOnJob: 1000,
  userTotalDriveCostOnJob: 100,
}
const laborJob: ReviewLaborJob = { source: 'labor', id: 'l1', job_date: '2026-10-01', address: '1 Elm St', hoursInfo: '', job_number: '101', click_number: null, job_id: 'job1', job_name: 'Elm St', ...money }
const crewJob: ReviewCrewJob = { source: 'crew', job_id: 'job1', work_date: '2026-10-01', hcp_number: '101', click_number: '', job_name: 'Elm St', job_address: '1 Elm St', ...money }
const rates: ReviewOverheadRates = { ...EMPTY_REVIEW_OVERHEAD_RATES, ratePerHour: 10, ratePerRevenueDecimal: 0.2, ratePerLaborDollar: 0.5, loading: false }

/** The grid's cells in order, each one's text. */
function cells(job: ReviewLaborJob | ReviewCrewJob, opts: { personName?: string; overheadRates?: ReviewOverheadRates } = { personName: 'Sam' }): string[] {
  const { personName, overheadRates = rates } = opts
  const { container } = render(
    <table><tbody><ReviewJobExpandedDetail job={job} personName={personName} prefixMap={{}} overheadRates={overheadRates} /></tbody></table>,
  )
  const grid = container.querySelector('td > div')!
  const out = Array.from(grid.children).map((c) => (c.textContent ?? '').trim())
  cleanup()
  return out
}
const after = (all: string[], label: string, n = 1) => all[all.indexOf(label) + n]

describe('ReviewJobExpandedDetail', () => {
  it('prints the per-hour mirrors, the chains and the rates for the person', () => {
    const c = cells(laborJob)
    expect(after(c, "Sam's Gross Revenue/hr")).toBe('$100')
    expect(after(c, "Sam's Net Revenue/hr")).toBe('$50')
    expect(after(c, "Sam's Profit/hr")).toBe('$40')
    expect(after(c, 'Job Gross Revenue (total bill)')).toBe('$10,000.00')
    expect(after(c, 'J101 Progress')).toBe('50%')
    expect(after(c, "Sam's % of Value Created")).toBe('40%')
    expect(after(c, 'Total Labor on J101')).toBe('$3,000.00 | 60.00hrs')
    expect(after(c, 'Rest of Teams Labor')).toBe('$2,000.00 | 40.00hrs')
    expect(after(c, "Sam's labor on J101 this day")).toBe('$400.00 | 8.00hrs')
    expect(after(c, "Sam's Labor Rate")).toBe('$45.00')
    expect(after(c, 'Teammates Avg Labor Rate')).toBe('$47.50')
    expect(after(c, 'Job Avg Labor Rate')).toBe('$46.67')
    expect(after(c, 'Parts:')).toBe('$1,500.00')
    expect(after(c, 'Subs:')).toBe('—')
    expect(after(c, "Sam's Net Revenue this Day")).toBe('-$12.50')
  })

  it('prints each overhead method: the overhead, then the profit after it', () => {
    const c = cells(laborJob)
    const method = (label: string) => c.slice(c.indexOf(label) + 2, c.indexOf(label) + 4)
    expect(method('A. Overhead by labor hours')).toEqual(['$600.00', '$1,900.00'])
    expect(method('B. Overhead by revenue')).toEqual(['$1,000.00', '$1,500.00'])
    expect(method('C. Overhead by direct labor cost')).toEqual(['$1,500.00', '$1,000.00'])
  })

  it('a crew day reads the same as a labor sheet with the same numbers', () => {
    expect(cells(crewJob)).toEqual(cells(laborJob))
  })

  it('a crew day with no number says Job and this job', () => {
    const c = cells({ ...crewJob, hcp_number: '—' })
    expect(c).toContain('Job Progress')
    expect(c).toContain('Total Labor on this job')
  })

  it('while the rates load the overhead cells say …, and with no rate —', () => {
    const loading = cells(laborJob, { personName: 'Sam', overheadRates: { ...EMPTY_REVIEW_OVERHEAD_RATES, loading: true } })
    expect(after(loading, "Sam's Profit/hr")).toBe('…')
    expect(loading.slice(loading.indexOf('A. Overhead by labor hours') + 2, loading.indexOf('A. Overhead by labor hours') + 4)).toEqual(['…', '…'])
    const none = cells(laborJob, { personName: 'Sam', overheadRates: EMPTY_REVIEW_OVERHEAD_RATES })
    expect(after(none, "Sam's Profit/hr")).toBe('—')
  })

  it('reads "User" when nobody is picked', () => {
    expect(cells(laborJob, {})).toContain("User's Gross Revenue/hr")
  })
})
