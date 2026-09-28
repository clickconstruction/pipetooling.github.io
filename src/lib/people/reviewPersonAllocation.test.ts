import { describe, expect, it } from 'vitest'
import { EMPTY_CARD_CHARGE_EXCLUSIONS } from '../jobs/cardChargeAllocationFilter'
import { laborJobSubCost } from '../jobs/subLaborCost'
import type { PayConfigRow } from '../../types/peoplePayConfig'
import {
  buildReviewPersonAllocation,
  reviewPersonJobScope,
  type ReviewCrewDayRow,
  type ReviewLedgerJobRow,
  type ReviewPersonRows,
  type ReviewSheetItemRow,
  type ReviewSheetRow,
} from './reviewPersonAllocation'

const START = '2026-09-01'
const END = '2026-09-07'

const payConfig = {
  Al: { person_name: 'Al', person_id: 'p-al', hourly_wage: 30, is_salary: false, record_hours_but_salary: false },
  Bo: { person_name: 'Bo', person_id: 'p-bo', hourly_wage: 20, is_salary: false, record_hours_but_salary: false },
} as Record<string, PayConfigRow>

const sheet = (over: Partial<ReviewSheetRow>): ReviewSheetRow => ({
  id: 'sheet',
  job_date: '2026-09-03',
  address: '1 Main',
  job_number: '101',
  job_ledger_id: 'job-1',
  labor_rate: 40,
  distance_miles: 0,
  assigned_to_name: 'Al',
  ...over,
})
const item = (over: Partial<ReviewSheetItemRow>): ReviewSheetItemRow => ({
  job_id: 'sheet',
  count: 1,
  hrs_per_unit: 1,
  is_fixed: false,
  labor_rate: null,
  direct_labor_amount: null,
  ...over,
})
const crewDay = (person: string, day: string, assignments: Array<{ job_id: string; pct: number }>): ReviewCrewDayRow => ({
  work_date: day,
  person_name: person,
  person_id: payConfig[person]?.person_id ?? null,
  job_assignments: assignments as ReviewCrewDayRow['job_assignments'],
})
const job = (over: Partial<ReviewLedgerJobRow>): ReviewLedgerJobRow => ({
  id: 'job-1',
  hcp_number: '101',
  click_number: '',
  job_name: 'Main St',
  job_address: '1 Main',
  revenue: 1000,
  pct_complete: null,
  service_type_id: null,
  status: null,
  ...over,
})

/** Nothing read; a test fills in what it is about. */
const rows = (over: Partial<ReviewPersonRows> = {}): ReviewPersonRows => ({
  personName: 'Al',
  start: START,
  end: END,
  onlyPaidJobs: false,
  payConfig,
  officeJobLedgerId: null,
  junctionJobIds: new Set(),
  allLaborRowsForCostAllTime: [],
  crewRows: [],
  allCrewRowsForCostAllTime: [],
  hoursRows: [],
  allReports: [],
  taskInstances: [],
  outstandingInstances: [],
  settingsRows: [],
  tallyParts: [],
  allHoursRows: [],
  allHoursRowsAllTime: [],
  laborItems: [],
  crewJobsLedger: [],
  invoiceRows: [],
  materialRows: [],
  cardAllocRows: [],
  cardExclusions: EMPTY_CARD_CHARGE_EXCLUSIONS,
  allLaborRows: [],
  allCrewRows: [],
  allHoursRows2: [],
  allLaborItems: [],
  ...over,
})

/** One crew day of `hours` on job-1 for Al, read the same in every window. */
function oneCrewDay(hours: number, pct: number, others: Array<{ person: string; day: string; hours: number; pct: number }> = []) {
  const mine = crewDay('Al', '2026-09-02', [{ job_id: 'job-1', pct }])
  const theirs = others.map((o) => crewDay(o.person, o.day, [{ job_id: 'job-1', pct: o.pct }]))
  const all = [mine, ...theirs]
  const allHours = [{ person_name: 'Al', work_date: '2026-09-02', hours }, ...others.map((o) => ({ person_name: o.person, work_date: o.day, hours: o.hours }))]
  return {
    crewRows: all.filter((r) => r.work_date >= START && r.work_date <= END),
    allCrewRowsForCostAllTime: all,
    allCrewRows: all,
    hoursRows: [{ work_date: '2026-09-02', hours }],
    allHoursRows: allHours.filter((h) => h.work_date >= START && h.work_date <= END),
    allHoursRowsAllTime: allHours,
    allHoursRows2: allHours,
  }
}

describe('reviewPersonJobScope', () => {
  const scope = (over: Partial<Parameters<typeof reviewPersonJobScope>[0]> = {}) =>
    reviewPersonJobScope({
      personName: 'Al',
      start: START,
      end: END,
      officeJobLedgerId: null,
      junctionJobIds: new Set(),
      allLaborRowsForCostAllTime: [],
      crewRows: [],
      ...over,
    })

  it('finds the person’s sheets by the junction first, then by a name in the list', () => {
    const s = scope({
      junctionJobIds: new Set(['by-junction']),
      allLaborRowsForCostAllTime: [
        sheet({ id: 'by-junction', assigned_to_name: 'Somebody Else' }),
        sheet({ id: 'by-name', assigned_to_name: 'Sub Co | Al' }),
        sheet({ id: 'not-theirs', assigned_to_name: 'Alan' }),
      ],
    })
    expect(s.personLaborRowsAllTime.map((r) => r.id)).toEqual(['by-junction', 'by-name'])
  })

  it('keeps the period’s sheets to its two ends, and a sheet with no date out of it', () => {
    const s = scope({
      allLaborRowsForCostAllTime: [
        sheet({ id: 'first-day', job_date: START }),
        sheet({ id: 'last-day', job_date: END }),
        sheet({ id: 'day-before', job_date: '2026-08-31' }),
        sheet({ id: 'day-after', job_date: '2026-09-08' }),
        sheet({ id: 'undated', job_date: null }),
      ],
    })
    expect(s.laborRows.map((r) => r.id)).toEqual(['first-day', 'last-day'])
    expect(s.personLaborRowsAllTime).toHaveLength(5)
  })

  it('takes the person’s crew assignments, the office job left out', () => {
    const s = scope({
      officeJobLedgerId: 'office-1',
      crewRows: [
        crewDay('Al', '2026-09-02', [{ job_id: 'job-1', pct: 60 }, { job_id: 'office-1', pct: 40 }]),
        crewDay('Al', '2026-09-03', [{ job_id: 'job-1', pct: 100 }]),
        crewDay('Bo', '2026-09-02', [{ job_id: 'job-9', pct: 100 }]),
      ],
    })
    expect([...s.crewJobIds]).toEqual(['job-1'])
    expect(s.crewJobsWithLead).toEqual([
      { work_date: '2026-09-02', job_id: 'job-1', pct: 60 },
      { work_date: '2026-09-03', job_id: 'job-1', pct: 100 },
    ])
  })

  it('reads a crew day with no assignment list as none', () => {
    const broken = { ...crewDay('Al', '2026-09-02', []), job_assignments: null as unknown as ReviewCrewDayRow['job_assignments'] }
    expect(scope({ crewRows: [broken] }).crewJobsWithLead).toEqual([])
  })

  it('names each job once: crew jobs first, then the sheets’ links, a sheet with no link adding none', () => {
    const s = scope({
      allLaborRowsForCostAllTime: [
        sheet({ id: 'a', job_ledger_id: 'job-2' }),
        sheet({ id: 'b', job_ledger_id: 'job-1', job_date: '2025-01-01' }),
        sheet({ id: 'c', job_ledger_id: null }),
        sheet({ id: 'd', job_ledger_id: 'job-2' }),
      ],
      crewRows: [crewDay('Al', '2026-09-02', [{ job_id: 'job-1', pct: 100 }])],
    })
    expect(s.laborLinkIds).toEqual(['job-2', 'job-1'])
    expect(s.allJobIds).toEqual(['job-1', 'job-2'])
  })
})

describe('buildReviewPersonAllocation — the earned rule on a crew day', () => {
  const earned = (j: Partial<ReviewLedgerJobRow>) =>
    buildReviewPersonAllocation(rows({ ...oneCrewDay(8, 100), crewJobsLedger: [job(j)] })).crewJobs[0]!

  it('a finished job earns the whole contract, whatever % is set', () => {
    for (const status of ['ready_to_bill', 'billed', 'paid']) {
      expect(earned({ status, pct_complete: 10 })).toMatchObject({ pctComplete: 100, valueCreated: 1000 })
    }
  })

  it('a set % earns that %, capped at the contract', () => {
    expect(earned({ status: 'working', pct_complete: 25 })).toMatchObject({ pctComplete: 25, valueCreated: 250 })
    expect(earned({ status: 'working', pct_complete: 140 })).toMatchObject({ pctComplete: 100, valueCreated: 1000 })
  })

  it('nothing set earns half', () => {
    expect(earned({ status: 'working', pct_complete: null })).toMatchObject({ pctComplete: 50, valueCreated: 500 })
    expect(earned({ status: null, pct_complete: 0 })).toMatchObject({ pctComplete: 50, valueCreated: 500 })
  })

  it('a job with no contract earns nothing and still carries its costs', () => {
    const row = earned({ revenue: null, status: 'billed' })
    expect(row).toMatchObject({ totalBill: 0, valueCreated: 0, revenueBeforeOverhead: -(8 * 30) })
  })

  it('a job the ledger did not return is a row with dashes and no money', () => {
    const row = buildReviewPersonAllocation(rows({ ...oneCrewDay(8, 100) })).crewJobs[0]!
    expect(row).toMatchObject({ job_name: '—', job_address: '—', hcp_number: '—', totalBill: 0, valueCreated: 0 })
  })
})

describe('buildReviewPersonAllocation — the person’s share', () => {
  it('is their period hours over the job’s lifetime hours, every person counted', () => {
    const d = buildReviewPersonAllocation(
      rows({
        ...oneCrewDay(8, 50, [
          { person: 'Bo', day: '2026-09-02', hours: 8, pct: 100 },
          { person: 'Al', day: '2026-08-20', hours: 4, pct: 100 },
        ]),
        crewJobsLedger: [job({ status: 'billed' })],
      }),
    )
    const row = d.crewJobs[0]!
    expect(row.hours).toBe(4)
    expect(row.totalJobHours).toBe(4 + 8 + 4)
    expect(row.userTotalHoursOnJob).toBe(4 + 4)
    const labor = 4 * 30 + 8 * 20 + 4 * 30
    expect(row.totalLaborOnJob).toBe(labor)
    expect(row.allocatedTotalBill).toBeCloseTo(1000 * (4 / 16), 10)
    expect(row.userTotalContributionToBill).toBeCloseTo(1000 * (8 / 16), 10)
    expect(d.allocatedRevenue).toBeCloseTo(1000 * (4 / 16), 10)
    expect(d.allocatedProfit).toBeCloseTo((1000 - labor) * (4 / 16), 10)
  })

  it('adds up a job worked on several days of the period', () => {
    const days = [crewDay('Al', '2026-09-02', [{ job_id: 'job-1', pct: 100 }]), crewDay('Al', '2026-09-03', [{ job_id: 'job-1', pct: 50 }])]
    const hours = [
      { person_name: 'Al', work_date: '2026-09-02', hours: 8 },
      { person_name: 'Al', work_date: '2026-09-03', hours: 6 },
    ]
    const d = buildReviewPersonAllocation(
      rows({ crewRows: days, allCrewRowsForCostAllTime: days, allCrewRows: days, allHoursRows: hours, allHoursRowsAllTime: hours, allHoursRows2: hours, crewJobsLedger: [job({ status: 'paid' })] }),
    )
    expect(d.crewJobs.map((j) => j.hours)).toEqual([8, 3])
    // The person is the only one on the job: all of it is theirs.
    expect(d.allocatedRevenue).toBeCloseTo(1000, 10)
    expect(d.crewJobs[0]!.allocatedTotalBill + d.crewJobs[1]!.allocatedTotalBill).toBeCloseTo(1000, 10)
  })

  it('with hours in the period and none on record for the job, credits the whole job', () => {
    const d = buildReviewPersonAllocation(
      rows({ ...oneCrewDay(8, 100), allCrewRows: [], allHoursRows2: [], crewJobsLedger: [job({ status: 'billed' })] }),
    )
    expect(d.crewJobs[0]!.totalJobHours).toBe(0)
    expect(d.allocatedRevenue).toBe(1000)
  })

  it('is nothing on a day with no hours on record', () => {
    const d = buildReviewPersonAllocation(rows({ ...oneCrewDay(8, 100), allHoursRows: [], crewJobsLedger: [job({ status: 'billed' })] }))
    expect(d.crewJobs[0]!).toMatchObject({ hours: 0, laborCost: 0, allocatedTotalBill: 0 })
    expect(d.allocatedRevenue).toBe(0)
  })

  it('prices crew time by the pay config row found by person id before name', () => {
    const renamed = [{ ...crewDay('Al', '2026-09-02', [{ job_id: 'job-1', pct: 100 }]), person_name: 'Al Renamed', person_id: 'p-al' }]
    const hours = [{ person_name: 'Al Renamed', work_date: '2026-09-02', hours: 8 }]
    const d = buildReviewPersonAllocation(
      rows({ personName: 'Bo', allCrewRowsForCostAllTime: renamed, allHoursRowsAllTime: hours }),
    )
    expect(d.laborByJobAndPerson['job-1']).toEqual([{ personName: 'Al Renamed', hours: 8, laborCost: 240, subLaborCost: 0, crewLaborCost: 240 }])
  })
})

describe('buildReviewPersonAllocation — a sheet', () => {
  const withSheet = (s: Partial<ReviewSheetRow>, items: ReviewSheetItemRow[], over: Partial<ReviewPersonRows> = {}) => {
    const theSheet = sheet(s)
    return buildReviewPersonAllocation(
      rows({
        allLaborRowsForCostAllTime: [theSheet],
        laborItems: items,
        allLaborRows: [{ id: theSheet.id, job_number: theSheet.job_number, job_ledger_id: theSheet.job_ledger_id, job_date: theSheet.job_date }],
        allLaborItems: items,
        crewJobsLedger: [job({ status: 'billed' })],
        ...over,
      }),
    )
  }

  it('counts a line’s hours by count, a fixed line’s once', () => {
    const items = [item({ count: 3, hrs_per_unit: 1.5 }), item({ count: 9, hrs_per_unit: 2, is_fixed: true })]
    const row = withSheet({}, items).laborJobs[0]!
    expect(row.hours).toBe(3 * 1.5 + 2)
    expect(row.hoursInfo).toBe('6.50 (2 items)')
    expect(row.laborCost).toBe(laborJobSubCost({ labor_rate: 40, items, distance_miles: 0 }, 0.7, 0.02))
  })

  it('shows a dash for a sheet with no lines', () => {
    expect(withSheet({}, []).laborJobs[0]!).toMatchObject({ hours: 0, hoursInfo: '—' })
  })

  it('prices the drive by the mile and the time at the sheet’s rate, by the mile alone with no rate', () => {
    expect(withSheet({ distance_miles: 10 }, []).laborJobs[0]!.driveCost).toBeCloseTo(10 * 0.7 + 10 * 0.02 * 40, 10)
    expect(withSheet({ distance_miles: 10, labor_rate: null }, []).laborJobs[0]!.driveCost).toBeCloseTo(10 * 0.7, 10)
    expect(withSheet({ distance_miles: 0 }, []).laborJobs[0]!.driveCost).toBe(0)
  })

  it('reads the drive settings when they are set', () => {
    const d = withSheet({ distance_miles: 10 }, [], {
      settingsRows: [
        { key: 'drive_mileage_cost', value_num: 1 },
        { key: 'drive_time_per_mile', value_num: 0.05 },
      ],
    })
    expect(d.laborJobs[0]!.driveCost).toBeCloseTo(10 * 1 + 10 * 0.05 * 40, 10)
  })

  it('is a cost on the job and never a share of its revenue', () => {
    const d = withSheet({}, [item({ count: 2, hrs_per_unit: 2 })])
    expect(d.laborJobs[0]!).toMatchObject({ allocatedTotalBill: 0, allocatedRevenueBeforeOverhead: 0, allocatedPartsCost: 0 })
    expect(d.allocatedRevenue).toBe(0)
    expect(d.allocatedProfit).toBe(0)
  })

  it('“Subs” on a row is sub labor by others: the person’s own sheets come off', () => {
    const mine = sheet({ id: 'mine', assigned_to_name: 'Al' })
    const theirs = sheet({ id: 'theirs', assigned_to_name: 'Sub Co', job_date: '2026-08-01' })
    const items = [item({ job_id: 'mine', count: 2 }), item({ job_id: 'theirs', count: 5 })]
    const d = buildReviewPersonAllocation(
      rows({ allLaborRowsForCostAllTime: [mine, theirs], laborItems: items, crewJobsLedger: [job({})] }),
    )
    const mineCost = laborJobSubCost({ labor_rate: 40, items: [items[0]!], distance_miles: 0 }, 0.7, 0.02)
    const theirsCost = laborJobSubCost({ labor_rate: 40, items: [items[1]!], distance_miles: 0 }, 0.7, 0.02)
    expect(d.laborJobs).toHaveLength(1)
    expect(d.laborJobs[0]!.totalLaborOnJob).toBe(mineCost + theirsCost)
    expect(d.laborJobs[0]!.subLaborCost).toBe(theirsCost)
    expect(d.laborJobs[0]!.userTotalLaborOnJob).toBe(mineCost)
  })

  it('a sheet on the office job is overhead, not a row', () => {
    expect(withSheet({ job_ledger_id: 'office-1' }, [], { officeJobLedgerId: 'office-1' }).laborJobs).toEqual([])
  })

  it('a sheet with no link stays, with no job behind it — and leaves under paid in full only', () => {
    const open = withSheet({ job_ledger_id: null }, [item({})])
    expect(open.laborJobs[0]!).toMatchObject({ job_id: null, job_name: '—', partsCost: 0, totalBill: 0, totalLaborOnJob: 0 })
    expect(withSheet({ job_ledger_id: null }, [item({})], { onlyPaidJobs: true }).laborJobs).toEqual([])
  })
})

describe('buildReviewPersonAllocation — parts', () => {
  const parts = (over: Partial<ReviewPersonRows>) =>
    buildReviewPersonAllocation(rows({ ...oneCrewDay(8, 100), crewJobsLedger: [job({})], ...over })).crewJobs[0]!.partsCost

  it('is tally parts + invoices + billed materials + card charges', () => {
    expect(
      parts({
        tallyParts: [
          { job_id: 'job-1', part_id: 'p', price_at_time: 10, fixture_cost: 99, quantity: 3 },
          { job_id: 'job-1', part_id: null, price_at_time: 99, fixture_cost: 25, quantity: 2 },
          { job_id: 'job-9', part_id: 'p', price_at_time: 1000, fixture_cost: null, quantity: 1 },
        ],
        invoiceRows: [{ job_id: 'job-1', invoice_amount: 100 }],
        materialRows: [
          { job_id: 'job-1', amount: 50 },
          { job_id: 'job-1', amount: 5 },
        ],
        cardAllocRows: [{ job_id: 'job-1', amount: -20, mercury_transaction_id: 'tx-1' }],
      }),
    ).toBe(3 * 10 + 2 * 25 + 100 + 55 + 20)
  })

  it('a refund on the card comes off', () => {
    expect(
      parts({
        cardAllocRows: [
          { job_id: 'job-1', amount: -60, mercury_transaction_id: 'tx-1' },
          { job_id: 'job-1', amount: 15, mercury_transaction_id: 'tx-2' },
        ],
      }),
    ).toBe(45)
  })

  it('an Internal Transfer is not a part, and an invoice-linked charge is counted once', () => {
    expect(
      parts({
        cardAllocRows: [
          { job_id: 'job-1', amount: -60, mercury_transaction_id: 'tx-transfer' },
          { job_id: 'job-1', amount: -40, mercury_transaction_id: 'tx-invoiced' },
          { job_id: 'job-1', amount: -7, mercury_transaction_id: 'tx-plain' },
        ],
        cardExclusions: { bucketByTxId: new Map([['tx-transfer', 'internal_transfer']]), invoiceLinkedTxIds: new Set(['tx-invoiced']) },
      }),
    ).toBe(7)
  })

  it('reads a missing price or amount as nothing', () => {
    expect(
      parts({
        tallyParts: [{ job_id: 'job-1', part_id: 'p', price_at_time: null, fixture_cost: null, quantity: 3 }],
        invoiceRows: [{ job_id: 'job-1', invoice_amount: null }],
      }),
    ).toBe(0)
  })
})

describe('buildReviewPersonAllocation — reports and tasks', () => {
  it('keeps the person’s reports inside the company-calendar period', () => {
    const report = (id: string, created_at: string, created_by_name: string) => ({ id, template_name: 'Daily', job_display_name: 'Main St', created_at, created_by_name })
    const d = buildReviewPersonAllocation(
      rows({
        allReports: [
          report('first-minute', '2026-09-01T05:00:00Z', 'Al'),
          report('evening-before', '2026-09-01T04:59:59Z', 'Al'),
          report('last-evening', '2026-09-08T04:30:00Z', ' Al '),
          report('morning-after', '2026-09-08T05:00:01Z', 'Al'),
          report('someone-else', '2026-09-03T15:00:00Z', 'Bo'),
        ],
      }),
    )
    expect(d.reports.map((r) => r.id)).toEqual(['first-minute', 'last-evening'])
    expect(d.reports[0]).toEqual({ id: 'first-minute', template_name: 'Daily', job_display_name: 'Main St', created_at: '2026-09-01T05:00:00Z' })
  })

  it('orders outstanding tasks by date, an undated one last, a missing item as Untitled', () => {
    const task = (id: string, scheduled_date: string, title: string | null) => ({
      id,
      checklist_item_id: `ci-${id}`,
      scheduled_date,
      completed_at: null,
      checklist_items: title == null ? null : { title, links: null },
    })
    const d = buildReviewPersonAllocation(
      rows({ outstandingInstances: [task('late', '2026-09-05', 'Stock the van'), task('undated', ' ', null), task('early', '2026-08-30', 'Call the inspector')] }),
    )
    expect(d.outstandingTasks.map((t) => [t.id, t.title, t.checklist_item_id])).toEqual([
      ['early', 'Call the inspector', 'ci-early'],
      ['late', 'Stock the van', 'ci-late'],
      ['undated', 'Untitled', 'ci-undated'],
    ])
  })
})

describe('buildReviewPersonAllocation — nothing read', () => {
  it('is an empty panel', () => {
    expect(buildReviewPersonAllocation(rows())).toEqual({
      laborJobs: [],
      crewJobs: [],
      allocatedRevenue: 0,
      allocatedProfit: 0,
      hours: [],
      reports: [],
      tasks: [],
      outstandingTasks: [],
      laborByJobAndPerson: {},
    })
  })

  it('does not change the rows it is handed', () => {
    const input = rows({ ...oneCrewDay(8, 100), crewJobsLedger: [job({ status: 'billed' })], allLaborRowsForCostAllTime: [sheet({})], laborItems: [item({})] })
    const before = JSON.stringify(input, (_k, v) => (v instanceof Set ? [...v] : v instanceof Map ? [...v] : v))
    buildReviewPersonAllocation(input)
    expect(JSON.stringify(input, (_k, v) => (v instanceof Set ? [...v] : v instanceof Map ? [...v] : v))).toBe(before)
  })
})
