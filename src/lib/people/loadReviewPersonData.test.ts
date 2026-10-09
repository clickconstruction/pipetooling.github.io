import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseError } from '../../utils/errorHandling'
import { EMPTY_CARD_CHARGE_EXCLUSIONS } from '../jobs/cardChargeAllocationFilter'
import { laborJobSubCost } from '../jobs/subLaborCost'
import type { PayConfigRow } from '../../types/peoplePayConfig'

/**
 * The per-person panel's one read. The rules it composes (the earned rule and
 * the hours share, the sheet costing, the card rule, sheet → person matching)
 * have their own suites; this pins the composition over a hand-built week:
 * what each read asks for, each row's money, the person's share of each job,
 * who put labor on a job, the paid-only switch, and that a failed read throws.
 *
 * The mock applies the filters each query carries to the tables below, so a
 * period read and a lifetime read of the same table see different rows.
 */
type Step = { method: string; args: unknown[] }
type Query = { kind: 'from' | 'rpc'; name: string; rpcArgs?: Record<string, unknown>; steps: Step[] }
type Row = Record<string, unknown>
const queries: Query[] = []
let tables: Record<string, Row[]> = {}
let rpcs: Record<string, (args: Record<string, unknown> | undefined) => Row[]> = {}
let failOn: string | null = null

function rowsFor(q: Query): Row[] {
  let rows = q.kind === 'rpc' ? (rpcs[q.name]?.(q.rpcArgs) ?? []) : (tables[q.name] ?? [])
  for (const s of q.steps) {
    const [col, a, b] = s.args as [string, unknown, unknown]
    if (typeof col !== 'string' || col.includes('.')) continue
    if (s.method === 'eq') rows = rows.filter((r) => r[col] === a)
    else if (s.method === 'gte') rows = rows.filter((r) => r[col] != null && String(r[col]) >= String(a))
    else if (s.method === 'lte') rows = rows.filter((r) => r[col] != null && String(r[col]) <= String(a))
    else if (s.method === 'lt') rows = rows.filter((r) => r[col] != null && String(r[col]) < String(a))
    else if (s.method === 'in') rows = rows.filter((r) => (a as unknown[]).includes(r[col]))
    else if (s.method === 'is' && a === null) rows = rows.filter((r) => r[col] == null)
    else if (s.method === 'not' && a === 'is' && b === null) rows = rows.filter((r) => r[col] != null)
  }
  const range = q.steps.find((s) => s.method === 'range')?.args as [number, number] | undefined
  return range ? rows.slice(range[0], range[1] + 1) : rows
}

function chain(q: Query): unknown {
  queries.push(q)
  const p: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') {
          return (resolve: (v: { data: unknown; error: { message: string } | null }) => void) =>
            resolve(failOn === q.name ? { data: null, error: { message: 'permission denied' } } : { data: rowsFor(q), error: null })
        }
        return (...a: unknown[]) => {
          q.steps.push({ method: String(prop), args: a })
          return p
        }
      },
    },
  )
  return p
}

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => chain({ kind: 'from', name: table, steps: [] }),
    rpc: (name: string, rpcArgs?: Record<string, unknown>) => chain({ kind: 'rpc', name, rpcArgs, steps: [] }),
  },
}))
const officeJobId = vi.fn<() => Promise<string | null>>()
vi.mock('../overheadOfficeJobSettings', () => ({
  fetchOverheadOfficeJobLedgerIdFromAppSettings: () => officeJobId(),
}))
const cardExclusions = vi.fn()
vi.mock('../jobs/loadCardChargeExclusions', () => ({ loadCardChargeExclusions: (ids: unknown) => cardExclusions(ids) }))

import { loadReviewPersonData, type ReviewPersonDataInput } from './loadReviewPersonData'

const START = '2026-09-01'
const END = '2026-09-07'
const MILE = 0.7
const MINUTES = 0.02

const payConfig = {
  Al: { person_name: 'Al', person_id: 'p-al', hourly_wage: 30, is_salary: false, record_hours_but_salary: false },
  Bo: { person_name: 'Bo', person_id: 'p-bo', hourly_wage: 20, is_salary: false, record_hours_but_salary: false },
} as Record<string, PayConfigRow>

const input = (over: Partial<ReviewPersonDataInput> = {}): ReviewPersonDataInput => ({
  personName: 'Al',
  start: START,
  end: END,
  onlyPaidJobs: false,
  payConfig,
  people: [{ id: 'p-al', name: 'Al' }],
  users: [{ id: 'u-al', name: ' Al ' }],
  ...over,
})

const ledger: Row[] = [
  { id: 'job-1', hcp_number: '101', click_number: 'C-101', job_name: 'Main St', job_address: '1 Main', revenue: 1000, pct_complete: 40, service_type_id: 'st-1' },
  { id: 'job-2', hcp_number: '102', click_number: '', job_name: 'Oak Ave', job_address: '2 Oak', revenue: 500, pct_complete: null, service_type_id: null },
]
// Al's own sheet on job-2, with a drive; someone else's sheet on job-1, before the period.
const ownSheet = { id: 'sheet-1', job_date: '2026-09-03', address: '2 Oak', job_number: '102', job_ledger_id: 'job-2', labor_rate: 40, distance_miles: 10, assigned_to_name: 'Al | Sub Co' }
const otherSheet = { id: 'sheet-2', job_date: '2026-08-25', address: '1 Main', job_number: '101', job_ledger_id: 'job-1', labor_rate: 50, distance_miles: 0, assigned_to_name: 'Sub Co' }
const ownItems = [{ job_id: 'sheet-1', count: 2, hrs_per_unit: 1.5, is_fixed: false, labor_rate: null, direct_labor_amount: null }]
const otherItems = [{ job_id: 'sheet-2', count: 9, hrs_per_unit: 2, is_fixed: true, labor_rate: null, direct_labor_amount: null }]

function week(): Record<string, Row[]> {
  return {
    people_labor_job_assignees: [],
    people_labor_jobs: [ownSheet, otherSheet],
    people_labor_job_items: [...ownItems, ...otherItems],
    people_crew_jobs: [
      // In the period: half of Al's day on job-1, half in the office; all of Bo's day on job-1.
      { work_date: '2026-09-02', person_name: 'Al', person_id: 'p-al', job_assignments: [{ job_id: 'job-1', pct: 50 }, { job_id: 'office-1', pct: 50 }] },
      { work_date: '2026-09-02', person_name: 'Bo', person_id: 'p-bo', job_assignments: [{ job_id: 'job-1', pct: 100 }] },
      // Before the period: Al on job-1.
      { work_date: '2026-08-20', person_name: 'Al', person_id: 'p-al', job_assignments: [{ job_id: 'job-1', pct: 100 }] },
    ],
    people_hours: [
      { person_name: 'Al', work_date: '2026-09-02', hours: 8 },
      { person_name: 'Bo', work_date: '2026-09-02', hours: 8 },
      { person_name: 'Al', work_date: '2026-08-20', hours: 4 },
    ],
    app_settings: [],
    jobs_ledger: [
      { id: 'job-1', status: 'working' },
      { id: 'job-2', status: 'billed' },
    ],
    jobs_ledger_materials: [{ job_id: 'job-1', amount: 50 }],
    mercury_transaction_job_allocations: [{ job_id: 'job-1', amount: -20, mercury_transaction_id: 'tx-1' }],
    checklist_instances: [
      { id: 't-done', checklist_item_id: 'ci-1', scheduled_date: '2026-09-02', completed_at: '2026-09-02T20:00:00Z', checklist_items: { title: 'Sweep the shop', links: ['https://x'] } },
      { id: 't-late', checklist_item_id: 'ci-2', scheduled_date: '2026-09-05', completed_at: null, checklist_items: { title: 'Stock the van', links: null } },
      { id: 't-undated', checklist_item_id: 'ci-3', scheduled_date: '', completed_at: null, checklist_items: null },
      { id: 't-early', checklist_item_id: 'ci-4', scheduled_date: '2026-08-30', completed_at: null, checklist_items: { title: 'Call the inspector' } },
    ],
  }
}

function weekRpcs(): typeof rpcs {
  const byIds = (rows: Row[]) => (args: Record<string, unknown> | undefined) => rows.filter((r) => ((args?.p_job_ids ?? []) as string[]).includes(r.id as string))
  return {
    get_jobs_ledger_by_ids: byIds(ledger),
    get_jobs_ledger_by_ids_paid_only: byIds(ledger.filter((j) => j.id === 'job-2')),
    get_invoice_amounts_for_jobs: () => [{ job_id: 'job-1', invoice_amount: 100 }],
    list_tally_parts_with_po: () => [{ job_id: 'job-1', part_id: 'part-1', price_at_time: 10, fixture_cost: null, quantity: 3 }],
    list_reports_with_job_info: () => [
      { id: 'r-in', template_name: 'Daily', job_display_name: 'Main St', created_at: '2026-09-01T06:00:00Z', created_by_name: ' Al ' },
      // 11 pm the evening before, company time.
      { id: 'r-before', template_name: 'Daily', job_display_name: 'Main St', created_at: '2026-09-01T04:00:00Z', created_by_name: 'Al' },
      { id: 'r-other', template_name: 'Daily', job_display_name: 'Main St', created_at: '2026-09-02T15:00:00Z', created_by_name: 'Bo' },
    ],
  }
}

const has = (q: Query, method: string, ...args: unknown[]) =>
  q.steps.some((s) => s.method === method && JSON.stringify(s.args) === JSON.stringify(args))
const fromQueries = (table: string) => queries.filter((q) => q.kind === 'from' && q.name === table)
const rpcQueries = (name: string) => queries.filter((q) => q.kind === 'rpc' && q.name === name)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-10T18:00:00Z'))
  queries.length = 0
  tables = week()
  rpcs = weekRpcs()
  failOn = null
  officeJobId.mockReset().mockResolvedValue('office-1')
  cardExclusions.mockReset().mockResolvedValue(EMPTY_CARD_CHARGE_EXCLUSIONS)
})

afterEach(() => {
  vi.useRealTimers()
})

// What the week works out to, by hand.
const ownSheetCost = () => laborJobSubCost({ labor_rate: 40, items: ownItems, distance_miles: 10 }, MILE, MINUTES)
const otherSheetCost = () => laborJobSubCost({ labor_rate: 50, items: otherItems, distance_miles: 0 }, MILE, MINUTES)
const JOB1_PARTS = 3 * 10 + 100 + 50 + 20 // tally + invoices + billed materials + a card purchase
const JOB1_CREW_LABOR = 4 * 30 + 8 * 20 + 4 * 30 // Al in the period, Bo, Al before it
const JOB1_LIFETIME_HOURS = 4 + 8 + 4 + 2 // the three crew days + the other sheet's fixed 2 h
const JOB1_VALUE = 1000 * 0.4

describe('loadReviewPersonData — what it asks for', () => {
  it('reads the person’s period, and the lifetime from two years before today', async () => {
    await loadReviewPersonData(input())
    const hours = fromQueries('people_hours')
    expect(hours.some((q) => has(q, 'eq', 'person_name', 'Al') && has(q, 'gte', 'work_date', START) && has(q, 'lte', 'work_date', END))).toBe(true)
    expect(hours.some((q) => has(q, 'gte', 'work_date', '2024-09-10') && !q.steps.some((s) => s.method === 'lte'))).toBe(true)
    // The share denominators: two years before the period to a year after it.
    expect(hours.some((q) => has(q, 'gte', 'work_date', '2024-09-01') && has(q, 'lte', 'work_date', '2027-09-07'))).toBe(true)
  })

  it('looks the person’s sheets up by person id, and their tasks by user id', async () => {
    await loadReviewPersonData(input())
    expect(has(fromQueries('people_labor_job_assignees')[0]!, 'eq', 'person_id', 'p-al')).toBe(true)
    const tasks = fromQueries('checklist_instances')
    expect(tasks).toHaveLength(2)
    for (const q of tasks) expect(has(q, 'eq', 'checklist_instance_assignees.user_id', 'u-al')).toBe(true)
  })

  it('falls back to the pay config’s person id, and asks for no tasks without a user', async () => {
    await loadReviewPersonData(input({ people: [], users: [] }))
    expect(has(fromQueries('people_labor_job_assignees')[0]!, 'eq', 'person_id', 'p-al')).toBe(true)
    expect(fromQueries('checklist_instances')).toHaveLength(0)
  })

  it('asks the ledger for the jobs the person touched, through the paid-only RPC when told to', async () => {
    await loadReviewPersonData(input())
    expect(rpcQueries('get_jobs_ledger_by_ids')[0]!.rpcArgs).toEqual({ p_job_ids: ['job-1', 'job-2'] })
    expect(rpcQueries('get_jobs_ledger_by_ids_paid_only')).toHaveLength(0)
    queries.length = 0
    await loadReviewPersonData(input({ onlyPaidJobs: true }))
    expect(rpcQueries('get_jobs_ledger_by_ids_paid_only')).toHaveLength(1)
    expect(rpcQueries('get_jobs_ledger_by_ids')).toHaveLength(0)
  })
})

describe('loadReviewPersonData — a hand-built week', () => {
  it('the crew day: hours by the day’s split, the job’s money, the person’s share', async () => {
    const d = await loadReviewPersonData(input())
    // The office half of the day is overhead, not a job row.
    expect(d.crewJobs).toHaveLength(1)
    const row = d.crewJobs[0]!
    const job1Labor = otherSheetCost() + JOB1_CREW_LABOR
    expect(row).toMatchObject({
      source: 'crew',
      job_id: 'job-1',
      work_date: '2026-09-02',
      hcp_number: '101',
      job_name: 'Main St',
      job_address: '1 Main',
      service_type_id: 'st-1',
      hours: 4,
      laborCost: 4 * 30,
      driveCost: 0,
      partsCost: JOB1_PARTS,
      totalBill: 1000,
      pctComplete: 40,
      valueCreated: JOB1_VALUE,
      totalLaborOnJob: job1Labor,
      revenueBeforeOverhead: JOB1_VALUE - JOB1_PARTS - job1Labor,
      // Sub labor by others: the whole of the other sheet.
      subLaborCost: otherSheetCost(),
      totalJobHours: JOB1_LIFETIME_HOURS,
      userTotalHoursOnJob: 4 + 4,
      userTotalLaborOnJob: (4 + 4) * 30,
    })
    // This row's share is its hours over the job's lifetime hours; the person's is all their hours.
    const rowShare = 4 / JOB1_LIFETIME_HOURS
    const personShare = 8 / JOB1_LIFETIME_HOURS
    expect(row.allocatedTotalBill).toBeCloseTo(JOB1_VALUE * rowShare, 10)
    expect(row.allocatedPartsCost).toBeCloseTo(JOB1_PARTS * rowShare, 10)
    expect(row.allocatedRevenueBeforeOverhead).toBeCloseTo((JOB1_VALUE - JOB1_PARTS - job1Labor) * rowShare, 10)
    expect(row.userTotalContributionToBill).toBeCloseTo(JOB1_VALUE * personShare, 10)
  })

  it('the sheet: a job cost with its drive, never a share of revenue; Al books his half of a two-name sheet', async () => {
    const d = await loadReviewPersonData(input())
    expect(d.laborJobs).toHaveLength(1)
    const row = d.laborJobs[0]!
    // 'Al | Sub Co' splits evenly (the owner's call of 2026-10-09, Team Summary's split): Al's panel
    // books half the sheet's hours, labor and drive, and Sub Co's half reads as sub labor by others.
    const half = 1 / 2
    expect(row).toMatchObject({
      source: 'labor',
      id: 'sheet-1',
      job_id: 'job-2',
      job_date: '2026-09-03',
      job_name: 'Oak Ave',
      hours: 3 * half,
      hoursInfo: '1.50 (1 items)',
      laborCost: ownSheetCost() * half,
      driveCost: (10 * MILE + 10 * MINUTES * 40) * half,
      partsCost: 0,
      // Billed, so finished: the whole contract is earned.
      totalBill: 500,
      pctComplete: 100,
      valueCreated: 500,
      totalLaborOnJob: ownSheetCost(),
      revenueBeforeOverhead: 500 - ownSheetCost(),
      // The one sheet on the job is shared: Sub Co's half is by others.
      subLaborCost: ownSheetCost() * half,
      userTotalDriveCostOnJob: (10 * MILE + 10 * MINUTES * 40) * half,
      totalDriveCostOnJob: 10 * MILE + 10 * MINUTES * 40,
      allocatedTotalBill: 0,
      allocatedRevenueBeforeOverhead: 0,
      allocatedPartsCost: 0,
      totalJobHours: 3,
      userTotalHoursOnJob: 3 * half,
      userTotalContributionToBill: 500 * half,
    })
  })

  it('the headline: earned and profit by clock hours, the sheet’s job adding nothing', async () => {
    const d = await loadReviewPersonData(input())
    const share = 4 / JOB1_LIFETIME_HOURS
    const job1Profit = JOB1_VALUE - JOB1_PARTS - (otherSheetCost() + JOB1_CREW_LABOR)
    expect(d.allocatedRevenue).toBeCloseTo(JOB1_VALUE * share, 10)
    expect(d.allocatedProfit).toBeCloseTo(job1Profit * share, 10)
  })

  it('who put labor on each job, the biggest cost first', async () => {
    const d = await loadReviewPersonData(input())
    expect(d.laborByJobAndPerson['job-1']).toEqual([
      { personName: 'Al', hours: 8, laborCost: 240, subLaborCost: 0, crewLaborCost: 240 },
      { personName: 'Bo', hours: 8, laborCost: 160, subLaborCost: 0, crewLaborCost: 160 },
      { personName: 'Sub Co', hours: 2, laborCost: 100, subLaborCost: 100, crewLaborCost: 0 },
    ])
    // A shared sheet is one contributor under the names as written.
    expect(d.laborByJobAndPerson['job-2']).toEqual([
      { personName: 'Al | Sub Co', hours: 3, laborCost: 3 * 40 + 15, subLaborCost: 3 * 40 + 15, crewLaborCost: 0 },
    ])
  })

  it('hours, reports inside the company-calendar period, and tasks', async () => {
    const d = await loadReviewPersonData(input())
    expect(d.hours).toEqual([{ work_date: '2026-09-02', hours: 8 }])
    expect(d.reports).toEqual([{ id: 'r-in', template_name: 'Daily', job_display_name: 'Main St', created_at: '2026-09-01T06:00:00Z' }])
    expect(d.tasks).toEqual([
      { id: 't-done', title: 'Sweep the shop', links: ['https://x'], scheduled_date: '2026-09-02', completed_at: '2026-09-02T20:00:00Z' },
    ])
    // Outstanding: by date, an undated one last, a missing item as Untitled.
    expect(d.outstandingTasks.map((t) => [t.id, t.title])).toEqual([
      ['t-early', 'Call the inspector'],
      ['t-late', 'Stock the van'],
      ['t-undated', 'Untitled'],
    ])
  })

  it('with no office job set, the office half of the day is a job row like any other', async () => {
    officeJobId.mockResolvedValue(null)
    const d = await loadReviewPersonData(input())
    expect(d.crewJobs.map((j) => [j.job_id, j.hours])).toEqual([
      ['job-1', 4],
      ['office-1', 4],
    ])
  })

  it('paid in full only: a job the paid-only ledger does not return leaves the panel', async () => {
    const d = await loadReviewPersonData(input({ onlyPaidJobs: true }))
    expect(d.crewJobs).toEqual([])
    expect(d.laborJobs.map((j) => j.job_id)).toEqual(['job-2'])
    expect(d.allocatedRevenue).toBe(0)
  })

  it('a person with nothing in the period', async () => {
    const d = await loadReviewPersonData(input({ personName: 'Nobody', people: [], users: [], payConfig: {} }))
    expect(d).toMatchObject({
      laborJobs: [],
      crewJobs: [],
      allocatedRevenue: 0,
      allocatedProfit: 0,
      hours: [],
      reports: [],
      tasks: [],
      outstandingTasks: [],
    })
    // The contributors are read company-wide, whoever the panel is for — every job on the
    // books in the lookback is there, crew time at $0 with no pay config to price it.
    expect(Object.keys(d.laborByJobAndPerson).sort()).toEqual(['job-1', 'job-2', 'office-1'])
    expect(d.laborByJobAndPerson['job-1']!.map((c) => [c.personName, c.laborCost])).toEqual([
      ['Sub Co', 100],
      ['Al', 0],
      ['Bo', 0],
    ])
    expect(queries.filter((q) => q.kind === 'rpc').map((q) => q.name).sort()).toEqual(['list_reports_with_job_info', 'list_tally_parts_with_po'])
  })

  it('an Internal Transfer on the card is not a part', async () => {
    cardExclusions.mockResolvedValue({ bucketByTxId: new Map([['tx-1', 'internal_transfer']]), invoiceLinkedTxIds: new Set() })
    const d = await loadReviewPersonData(input())
    expect(cardExclusions).toHaveBeenCalledWith(['tx-1'])
    expect(d.crewJobs[0]!.partsCost).toBe(JOB1_PARTS - 20)
  })
})

describe('loadReviewPersonData — a failed read', () => {
  it('throws, naming the load, when a first-wave read fails', async () => {
    failOn = 'app_settings'
    await expect(loadReviewPersonData(input())).rejects.toThrow('Failed to load review data: permission denied')
  })

  it('throws when a paged read fails, never an empty panel', async () => {
    failOn = 'people_crew_jobs'
    await expect(loadReviewPersonData(input())).rejects.toBeInstanceOf(DatabaseError)
  })

  it('carries on when only the job statuses cannot be read: nothing reads as finished', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    failOn = 'jobs_ledger'
    const d = await loadReviewPersonData(input())
    warn.mockRestore()
    // job-2 has no % set and no status now: the assumed half.
    expect(d.laborJobs[0]!.pctComplete).toBe(50)
    expect(d.laborJobs[0]!.valueCreated).toBe(250)
  })
})
