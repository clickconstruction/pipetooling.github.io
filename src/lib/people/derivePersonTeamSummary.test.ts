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
    cardChargesByJobId: new Map(),
    tagChargesByJobId: new Map(),
    costLineTags: [],
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
      record_hours_but_salary: false,
    },
  }
}

describe('derivePersonTeamSummary', () => {
  it("splits a multi-assignee sheet's hours and cost evenly across its assignees", () => {
    // Before v2.1736 the bare equality on the delimited column matched NO
    // person, so this sheet vanished from every row of the Team Summary.
    const union = makeUnion({
      periodLaborRows: [
        { id: 'lr-multi', job_date: '2026-04-01', address: 'm', job_number: 'JM', labor_rate: 10, distance_miles: 0, assigned_to_name: 'Alice | Bob' },
      ],
      laborItemsByJobId: new Map([
        ['lr-multi', [{ count: 1, hrs_per_unit: 6, is_fixed: true }]],
      ]),
      jobIdByHcp: new Map([['jm', 'job-M']]),
      jobsById: new Map([
        ['job-M', makeLedgerRow({ id: 'job-M', hcp_number: 'JM', revenue: 1000, pct_complete: 100 })],
      ]),
      laborCostByHcp: new Map([['jm', 60]]),
    })

    const alice = derivePersonTeamSummary(union, 'Alice', hourlyPayConfig('Alice', 50), false, ['2026-04-01'])
    const bob = derivePersonTeamSummary(union, 'Bob', hourlyPayConfig('Bob', 50), false, ['2026-04-01'])
    const carol = derivePersonTeamSummary(union, 'Carol', hourlyPayConfig('Carol', 50), false, ['2026-04-01'])

    // 6 hrs * $10 = $60 sheet cost, split 50/50 — each half appears once.
    expect(alice.hoursBreakdown.subLaborRows).toEqual([{ hcp: 'JM', date: '2026-04-01', hours: 3 }])
    expect(bob.hoursBreakdown.subLaborRows).toEqual([{ hcp: 'JM', date: '2026-04-01', hours: 3 }])
    expect(carol.hoursBreakdown.subLaborRows).toEqual([])
    const aliceJob = alice.grossBreakdown.jobs[0]
    const bobJob = bob.grossBreakdown.jobs[0]
    expect(aliceJob?.costInPeriod).toBeCloseTo(30, 10)
    expect(bobJob?.costInPeriod).toBeCloseTo(30, 10)
    // The two halves reassemble the whole sheet: allocated revenue sums to
    // the full-cost allocation (ratio 60/60 = 1 -> valueCreated 1000).
    expect(alice.gross + bob.gross).toBeCloseTo(1000, 10)
  })

  it('keeps single-assignee sheets at full weight (share 1 — answer-preserving)', () => {
    const union = makeUnion({
      periodLaborRows: [
        { id: 'lr-one', job_date: '2026-04-02', address: 's', job_number: 'JS', labor_rate: 10, distance_miles: 0, assigned_to_name: 'Alice' },
      ],
      laborItemsByJobId: new Map([['lr-one', [{ count: 1, hrs_per_unit: 4, is_fixed: true }]]]),
      jobIdByHcp: new Map([['js', 'job-S']]),
      jobsById: new Map([['job-S', makeLedgerRow({ id: 'job-S', hcp_number: 'JS', revenue: 500, pct_complete: 100 })]]),
    })
    const row = derivePersonTeamSummary(union, 'Alice', hourlyPayConfig('Alice', 50), false, ['2026-04-02'])
    expect(row.hoursBreakdown.subLaborRows).toEqual([{ hcp: 'JS', date: '2026-04-02', hours: 4 }])
    expect(row.grossBreakdown.jobs[0]?.costInPeriod).toBe(40)
  })

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

describe('derivePersonTeamSummary — v2.2683 cost inputs', () => {
  it('prices sub-labor sheets like the Jobs page: per-line rate overrides and direct $ lines count', () => {
    const union = makeUnion({
      periodLaborRows: [
        { id: 's', job_date: '2026-03-01', address: 'a', job_number: 'J1', labor_rate: 60, distance_miles: 0, assigned_to_name: 'Eve' },
      ],
      laborItemsByJobId: new Map([
        [
          's',
          [
            { count: 2, hrs_per_unit: 3, is_fixed: false }, // 6 h × $60 = 360
            { count: 1, hrs_per_unit: 2, is_fixed: false, labor_rate: 90 }, // 2 h × $90 = 180
            { count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: 900 }, // flat 900
          ],
        ],
      ]),
      jobIdByHcp: new Map([['j1', 'job-1']]),
      jobsById: new Map([['job-1', makeLedgerRow({ id: 'job-1', hcp_number: 'J1', revenue: 10000, pct_complete: 100 })]]),
      // Lifetime labor on the job = this sheet alone, costed the same way.
      laborCostByHcp: new Map([['j1', 1440]]),
    })
    const row = derivePersonTeamSummary(union, 'Eve', hourlyPayConfig('Eve', 50), false, ['2026-03-01'])
    // Cost 1440 ÷ lifetime 1440 → the whole job's value created is Eve's.
    expect(row.gross).toBeCloseTo(10000)
    expect(row.grossBreakdown.jobs[0]?.costInPeriod).toBeCloseTo(1440)
    // Hours are still hours: 6 + 2 + 0.
    expect(row.hoursBreakdown.totals.subLabor).toBeCloseTo(8)
  })

  it('prices office/bid hours at the office rate for dual-rate people, and at the field wage otherwise', () => {
    const union = makeUnion({
      overheadHoursByPerson: { Fay: { office: 10, bid: 2 }, Gus: { office: 10, bid: 2 } },
    })
    const dual: Record<string, PayConfigRow> = {
      Fay: { person_name: 'Fay', hourly_wage: 40, office_hourly_wage: 25, is_salary: false, record_hours_but_salary: false },
      Gus: { person_name: 'Gus', hourly_wage: 40, office_hourly_wage: 25, is_salary: true, record_hours_but_salary: false },
    }
    const fay = derivePersonTeamSummary(union, 'Fay', dual, false, ['2026-03-02'])
    expect(fay.overheadWage).toBe(25)
    expect(fay.overheadLaborCost).toBeCloseTo(-(12 * 25))
    // Salaried people never use the dual rate (payroll's gate), even with an office rate on file.
    const gus = derivePersonTeamSummary(union, 'Gus', dual, false, ['2026-03-02'])
    expect(gus.overheadWage).toBe(40)
    expect(gus.overheadLaborCost).toBeCloseTo(-(12 * 40))
  })
})

describe('derivePersonTeamSummary — v2.2687 hour basis under "only paid in full"', () => {
  it('keeps total and field hours on the period basis and reports hours on paid jobs separately', () => {
    const union = makeUnion({
      periodLaborRows: [
        { id: 'p', job_date: '2026-03-02', address: 'p', job_number: 'PAID', labor_rate: 10, distance_miles: 0, assigned_to_name: 'Hal' },
        { id: 'u', job_date: '2026-03-02', address: 'u', job_number: 'UNPAID', labor_rate: 10, distance_miles: 0, assigned_to_name: 'Hal' },
      ],
      laborItemsByJobId: new Map([
        ['p', [{ count: 1, hrs_per_unit: 3, is_fixed: true }]],
        ['u', [{ count: 1, hrs_per_unit: 7, is_fixed: true }]],
      ]),
      jobIdByHcp: new Map([['paid', 'job-paid']]),
      jobsById: new Map([['job-paid', makeLedgerRow({ id: 'job-paid', hcp_number: 'PAID', revenue: 0, pct_complete: 100 })]]),
      periodHoursRows: [{ person_name: 'Hal', work_date: '2026-03-02', hours: 12 }],
      overheadHoursByPerson: { Hal: { office: 2, bid: 0 } },
    })
    const paidOnly = derivePersonTeamSummary(union, 'Hal', hourlyPayConfig('Hal', 50), true, ['2026-03-02'])
    const all = derivePersonTeamSummary(union, 'Hal', hourlyPayConfig('Hal', 50), false, ['2026-03-02'])
    // Same denominators either way: 12 clocked hours, 10 of them field.
    expect(paidOnly.totalHours).toBe(12)
    expect(all.totalHours).toBe(12)
    expect(paidOnly.fieldHours).toBe(10)
    expect(all.fieldHours).toBe(10)
    // The toggle only narrows which jobs count; hours on paid jobs are reported, not substituted.
    expect(paidOnly.hoursBreakdown.totals.onPaidJobs).toBe(3)
    expect(all.hoursBreakdown.totals.onPaidJobs).toBeUndefined()
    expect(paidOnly.hoursBreakdown.totals.totalHours).toBe(12)
  })
})
