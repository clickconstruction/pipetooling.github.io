import { describe, expect, it } from 'vitest'
import { derivePersonTeamSummary } from './derivePersonTeamSummary'
import type { TeamLedgerRow, TeamReviewUnion } from './teamReviewTypes'
import type { PayConfigRow } from '../../types/peoplePayConfig'

function makeUnion(partial: Partial<TeamReviewUnion>): TeamReviewUnion {
  return {
    periodLaborRows: [],
    periodCrewRows: [],
    periodCrewBidRows: [],
    periodHoursRows: [],
    mileageCost: 0.7,
    timePerMile: 0.02,
    jobsById: new Map(),
    bidsById: new Map(),
    jobIdByHcp: new Map(),
    laborItemsByJobId: new Map(),
    laborCostByHcp: new Map(),
    teamLaborCostByJobId: new Map(),
    partsCostByJobId: new Map(),
    invoiceAmountByJob: {},
    billedMaterialsByJobId: new Map(),
    hoursMap: {},
    crewByDatePerson: {},
    overheadHoursByPerson: {},
    overheadHoursByPersonByDate: {},
    overheadSessionsByPerson: {},
    officeJobLedgerId: null,
    ...partial,
  }
}

function makeLedgerRow(partial: Partial<TeamLedgerRow> & { id: string }): TeamLedgerRow {
  return {
    hcp_number: '',
    job_name: '',
    job_address: '',
    revenue: null,
    pct_complete: null,
    service_type_id: null,
    ...partial,
  }
}

function hourlyPayConfig(name: string, wage: number): Record<string, PayConfigRow> {
  return {
    [name]: {
      person_name: name,
      hourly_wage: wage,
      is_salary: false,
      show_in_hours: true,
      show_in_cost_matrix: true,
      record_hours_but_salary: false,
    },
  }
}

describe('derivePersonTeamSummary', () => {
  it('excludes sub-labor rows that map (via jobIdByHcp) to the configured office job', () => {
    const union = makeUnion({
      officeJobLedgerId: 'office-job-id',
      periodLaborRows: [
        { id: 'lr-off', job_date: '2026-01-01', address: 'a', job_number: 'OFF1', labor_rate: 10, distance_miles: 0, assigned_to_name: 'Alice' },
        { id: 'lr-j1', job_date: '2026-01-01', address: 'b', job_number: 'J1', labor_rate: 10, distance_miles: 0, assigned_to_name: 'Alice' },
      ],
      laborItemsByJobId: new Map([
        ['lr-off', [{ count: 1, hrs_per_unit: 5, is_fixed: true }]],
        ['lr-j1', [{ count: 1, hrs_per_unit: 4, is_fixed: true }]],
      ]),
      jobIdByHcp: new Map([
        ['off1', 'office-job-id'],
        ['j1', 'job-1'],
      ]),
      jobsById: new Map([
        ['office-job-id', makeLedgerRow({ id: 'office-job-id', hcp_number: 'OFF1', revenue: 1000, pct_complete: 100 })],
        ['job-1', makeLedgerRow({ id: 'job-1', hcp_number: 'J1', job_name: 'Real Job', revenue: 1000, pct_complete: 100 })],
      ]),
    })

    const row = derivePersonTeamSummary(union, 'Alice', hourlyPayConfig('Alice', 50), false, ['2026-01-01'])

    // The office row is filtered out: only J1 contributes a sub-labor row,
    // and the office job never appears in the revenue allocation.
    expect(row.hoursBreakdown.subLaborRows).toEqual([
      { hcp: 'J1', date: '2026-01-01', hours: 4 },
    ])
    expect(row.grossBreakdown.jobs.map((j) => j.jobId)).not.toContain('office-job-id')
    expect(row.grossBreakdown.jobs.map((j) => j.hcp)).toEqual(['J1'])
  })

  it('allocates revenue by the cost-based ratio costInPeriod / totalLaborOnJob', () => {
    const union = makeUnion({
      periodLaborRows: [
        { id: 'lr1', job_date: '2026-02-01', address: 'x', job_number: 'JX', labor_rate: 10, distance_miles: 0, assigned_to_name: 'Bob' },
      ],
      // 2 units * 1 hr/unit = 2 hrs; laborCost = 2 * $10 = $20 -> costInPeriod
      laborItemsByJobId: new Map([
        ['lr1', [{ count: 2, hrs_per_unit: 1, is_fixed: false }]],
      ]),
      jobIdByHcp: new Map([['jx', 'job-X']]),
      jobsById: new Map([
        ['job-X', makeLedgerRow({ id: 'job-X', hcp_number: 'JX', revenue: 1000, pct_complete: 50 })],
      ]),
      // totalLaborOnJob = laborCostByHcp ($80) + teamLaborCostByJobId ($20) = $100
      laborCostByHcp: new Map([['jx', 80]]),
      teamLaborCostByJobId: new Map([['job-X', 20]]),
    })

    const row = derivePersonTeamSummary(union, 'Bob', hourlyPayConfig('Bob', 50), false, ['2026-02-01'])

    // valueCreated = 1000 * 50% = 500; partsCost = 0
    // revenueBeforeOverhead = 500 - 0 - 100 = 400
    // ratio = costInPeriod / totalLaborOnJob = 20 / 100 = 0.2
    const job = row.grossBreakdown.jobs[0]
    expect(job).toBeDefined()
    if (!job) throw new Error('expected one allocated job')
    expect(job.costInPeriod).toBe(20)
    expect(job.totalLaborOnJob).toBe(100)
    expect(job.ratio).toBeCloseTo(0.2, 10)
    expect(job.valueCreated).toBe(500)
    expect(job.allocatedRevenue).toBeCloseTo(100, 10) // 500 * 0.2
    expect(row.gross).toBeCloseTo(100, 10)
    expect(row.profit).toBeCloseTo(80, 10) // 400 * 0.2
  })

  it('onlyPaidJobs restricts labor rows to HCPs present in jobIdByHcp', () => {
    const base = {
      periodLaborRows: [
        { id: 'p', job_date: '2026-03-01', address: 'p', job_number: 'PAID', labor_rate: 10, distance_miles: 0, assigned_to_name: 'Carol' },
        { id: 'u', job_date: '2026-03-01', address: 'u', job_number: 'UNPAID', labor_rate: 10, distance_miles: 0, assigned_to_name: 'Carol' },
      ],
      laborItemsByJobId: new Map([
        ['p', [{ count: 1, hrs_per_unit: 3, is_fixed: true }]],
        ['u', [{ count: 1, hrs_per_unit: 7, is_fixed: true }]],
      ]),
      jobIdByHcp: new Map([['paid', 'job-paid']]),
      jobsById: new Map([
        ['job-paid', makeLedgerRow({ id: 'job-paid', hcp_number: 'PAID', revenue: 0, pct_complete: 100 })],
      ]),
    }

    const onlyPaid = derivePersonTeamSummary(
      makeUnion(base),
      'Carol',
      hourlyPayConfig('Carol', 50),
      true,
      ['2026-03-01'],
    )
    expect(onlyPaid.hoursBreakdown.subLaborRows.map((r) => r.hcp)).toEqual(['PAID'])
    expect(onlyPaid.hoursBreakdown.totals.subLabor).toBe(3)

    const allJobs = derivePersonTeamSummary(
      makeUnion(base),
      'Carol',
      hourlyPayConfig('Carol', 50),
      false,
      ['2026-03-01'],
    )
    expect(allJobs.hoursBreakdown.subLaborRows.map((r) => r.hcp).sort()).toEqual(['PAID', 'UNPAID'])
    expect(allJobs.hoursBreakdown.totals.subLabor).toBe(10)
  })

  it('crew allocations carry per-day Value Created (cost-share, null pct → 100%), reconciling with Gross', () => {
    const union = makeUnion({
      periodCrewRows: [
        { work_date: '2026-04-01', person_name: 'Dan', job_assignments: [{ job_id: 'job-C', pct: 100 }] },
      ],
      crewByDatePerson: {
        '2026-04-01:Dan': { job_assignments: [{ job_id: 'job-C', pct: 100 }] },
      },
      hoursMap: { 'Dan:2026-04-01': 8 },
      jobsById: new Map([
        // pct_complete null -> treated as 100% (matches the Gross column).
        ['job-C', makeLedgerRow({ id: 'job-C', hcp_number: 'JC', job_name: 'Job C', revenue: 1000, pct_complete: null })],
      ]),
      // Total lifetime labor on the job = $800. Dan's day cost = 8h × $50 = $400 (half).
      teamLaborCostByJobId: new Map([['job-C', 800]]),
    })

    const row = derivePersonTeamSummary(union, 'Dan', hourlyPayConfig('Dan', 50), false, ['2026-04-01'])

    const alloc = row.hoursBreakdown.dailyRows[0]?.crewAllocations[0]
    expect(alloc).toBeDefined()
    if (!alloc) throw new Error('expected one crew allocation')
    // valueCreated (1000, null→100%) × (dayCost 400 / totalLabor 800) = 500
    expect(alloc.valueCreated).toBeCloseTo(500, 6)
    // Per-day Value Created reconciles with the Gross Revenue column.
    expect(row.gross).toBeCloseTo(500, 6)
  })
})
