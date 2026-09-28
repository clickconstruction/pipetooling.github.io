import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseError } from '../../utils/errorHandling'
import { buildCategoryTagLookups, type CategoryTagRow } from '../banking/categoryTags'
import { EMPTY_CARD_CHARGE_EXCLUSIONS } from '../jobs/cardChargeAllocationFilter'
import { laborJobSubCost } from '../jobs/subLaborCost'
import type { PayConfigRow } from '../../types/peoplePayConfig'

/**
 * The Team Summary's one read. Its kernels (the card rule, the tag split, the
 * sheet costing, the overhead buckets) have their own suites; this pins the
 * composition: which windows each read asks for, the paid-only switch, what
 * the union carries for a hand-built week, the Wheels fuel exclusion through
 * the `users` parameter, and that a failed read throws.
 */
type Step = { method: string; args: unknown[] }
type Query = { kind: 'from' | 'rpc'; name: string; rpcArgs?: unknown; steps: Step[] }
type Result = { data: unknown; error: { message: string } | null }
const queries: Query[] = []
let route: (q: Query) => Result = () => ({ data: [], error: null })

function chain(q: Query): unknown {
  queries.push(q)
  const p: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') {
          return (resolve: (v: Result) => void, reject: (e: unknown) => void) => {
            try {
              resolve(route(q))
            } catch (e) {
              reject(e)
            }
          }
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
    rpc: (name: string, rpcArgs?: unknown) => chain({ kind: 'rpc', name, rpcArgs, steps: [] }),
  },
}))

const officeJobId = vi.fn<() => Promise<string | null>>()
vi.mock('../overheadOfficeJobSettings', () => ({
  fetchOverheadOfficeJobLedgerIdFromAppSettings: () => officeJobId(),
}))
const wheelsSnapshot = vi.fn()
vi.mock('./wheelsData', () => ({ loadWheelsSnapshot: (input: unknown) => wheelsSnapshot(input) }))
const cardExclusions = vi.fn()
vi.mock('../jobs/loadCardChargeExclusions', () => ({ loadCardChargeExclusions: (ids: unknown) => cardExclusions(ids) }))
const labelIdByTxId = vi.fn()
vi.mock('../banking/categoryTagsData', () => ({ fetchLabelIdByTxId: (ids: unknown) => labelIdByTxId(ids) }))
const attributions = vi.fn()
vi.mock('../fetchMercuryRelationsByTxIds', () => ({
  fetchAttributionsByMercuryTxIds: (ids: unknown, label: unknown) => attributions(ids, label),
}))

import { loadTeamReviewUnion } from './loadTeamReviewUnion'

const START = '2026-09-01'
const END = '2026-09-07'
// "Today" is 2026-09-10 on the company calendar, so the lifetime lookback opens 2024-09-10.
const LOOKBACK = '2024-09-10'
const NO_TAGS = buildCategoryTagLookups([], [])

const payConfig = {
  Al: { person_name: 'Al', person_id: 'p-al', hourly_wage: 30, is_salary: false, record_hours_but_salary: false },
} as Record<string, PayConfigRow>

const stepArgs = (q: Query, method: string) => q.steps.filter((s) => s.method === method).map((s) => s.args)
const has = (q: Query, method: string, ...args: unknown[]) =>
  stepArgs(q, method).some((a) => JSON.stringify(a) === JSON.stringify(args))
const fromQueries = (table: string) => queries.filter((q) => q.kind === 'from' && q.name === table)
const rpcQueries = (name: string) => queries.filter((q) => q.kind === 'rpc' && q.name === name)

/** Rows by table / RPC name; a function sees the query (to tell the period read from the lifetime one). */
function serve(rows: Record<string, unknown[] | ((q: Query) => unknown[])>) {
  route = (q) => {
    const r = rows[q.name]
    return { data: typeof r === 'function' ? r(q) : (r ?? []), error: null }
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-10T18:00:00Z'))
  queries.length = 0
  route = () => ({ data: [], error: null })
  officeJobId.mockReset().mockResolvedValue(null)
  wheelsSnapshot.mockReset().mockResolvedValue(null)
  cardExclusions.mockReset().mockResolvedValue(EMPTY_CARD_CHARGE_EXCLUSIONS)
  labelIdByTxId.mockReset().mockResolvedValue(new Map())
  attributions.mockReset().mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('loadTeamReviewUnion — what it asks for', () => {
  it('reads the period by its two ends and the lifetime from two years back', async () => {
    await loadTeamReviewUnion(START, END, false, payConfig, NO_TAGS, [])
    for (const [table, column] of [
      ['people_labor_jobs', 'job_date'],
      ['people_crew_jobs', 'work_date'],
      ['people_hours', 'work_date'],
    ] as const) {
      const reads = fromQueries(table)
      expect(reads).toHaveLength(2)
      const period = reads.find((q) => has(q, 'gte', column, START))
      const lifetime = reads.find((q) => has(q, 'gte', column, LOOKBACK))
      expect(period && has(period, 'lte', column, END)).toBe(true)
      expect(lifetime && stepArgs(lifetime, 'lte')).toEqual([])
    }
    const bids = fromQueries('people_crew_bids')
    expect(bids).toHaveLength(1)
    expect(has(bids[0]!, 'gte', 'work_date', START) && has(bids[0]!, 'lte', 'work_date', END)).toBe(true)
  })

  it('opens the lifetime at the period’s start when that is further back', async () => {
    await loadTeamReviewUnion('2020-01-01', '2020-01-31', false, payConfig, NO_TAGS, [])
    expect(fromQueries('people_hours').some((q) => has(q, 'gte', 'work_date', '2020-01-01') && stepArgs(q, 'lte').length === 0)).toBe(true)
    expect(queries.some((q) => has(q, 'gte', 'work_date', LOOKBACK))).toBe(false)
  })

  it('reads bid sessions only when no office job is set, office or bid when one is', async () => {
    await loadTeamReviewUnion(START, END, false, payConfig, NO_TAGS, [])
    expect(has(fromQueries('clock_sessions')[0]!, 'not', 'bid_id', 'is', null)).toBe(true)
    expect(stepArgs(fromQueries('clock_sessions')[0]!, 'or')).toEqual([])

    queries.length = 0
    officeJobId.mockResolvedValue('office-1')
    await loadTeamReviewUnion(START, END, false, payConfig, NO_TAGS, [])
    expect(has(fromQueries('clock_sessions')[0]!, 'or', 'job_ledger_id.eq.office-1,bid_id.not.is.null')).toBe(true)
  })

  it('asks for no ledger, invoice or bid rows when the period names no job or bid', async () => {
    await loadTeamReviewUnion(START, END, false, payConfig, NO_TAGS, [])
    expect(queries.filter((q) => q.kind === 'rpc').map((q) => q.name)).toEqual(['list_tally_parts_with_po'])
    expect(fromQueries('jobs_ledger')).toHaveLength(0)
    expect(fromQueries('jobs_ledger_materials')).toHaveLength(0)
  })

  it('reads the ledger through the paid-only RPC when asked to', async () => {
    const crewDay = [{ work_date: '2026-09-02', person_name: 'Al', person_id: 'p-al', job_assignments: [{ job_id: 'job-1', pct: 100 }] }]
    serve({ people_crew_jobs: crewDay })
    await loadTeamReviewUnion(START, END, false, payConfig, NO_TAGS, [])
    expect(rpcQueries('get_jobs_ledger_by_ids')).toHaveLength(1)
    expect(rpcQueries('get_jobs_ledger_by_ids')[0]!.rpcArgs).toEqual({ p_job_ids: ['job-1'] })
    expect(rpcQueries('get_jobs_ledger_by_ids_paid_only')).toHaveLength(0)

    queries.length = 0
    await loadTeamReviewUnion(START, END, true, payConfig, NO_TAGS, [])
    expect(rpcQueries('get_jobs_ledger_by_ids_paid_only')).toHaveLength(1)
    expect(rpcQueries('get_jobs_ledger_by_ids')).toHaveLength(0)
  })
})

describe('loadTeamReviewUnion — what the union carries', () => {
  const sheet = { id: 'sheet-1', job_date: '2026-09-03', address: '1 Main', job_number: '101', job_ledger_id: 'job-2', labor_rate: 40, distance_miles: 10, assigned_to_name: 'Sub Co' }
  const sheetItems = [{ job_id: 'sheet-1', count: 2, hrs_per_unit: 1.5, is_fixed: false, labor_rate: null, direct_labor_amount: null }]
  const week = {
    people_labor_jobs: [sheet],
    people_labor_job_items: sheetItems,
    people_crew_jobs: [{ work_date: '2026-09-02', person_name: 'Al', person_id: 'p-al', job_assignments: [{ job_id: 'job-1', pct: 50 }] }],
    people_crew_bids: [
      { work_date: '2026-09-04', person_name: 'Al', bid_assignments: [{ bid_id: 'bid-1', pct: 100 }] },
      { work_date: '2026-09-05', person_name: 'Al', bid_assignments: null },
    ],
    people_hours: [{ person_name: 'Al', work_date: '2026-09-02', hours: 8 }],
    app_settings: [{ key: 'drive_mileage_cost', value_num: 0.5 }],
    list_tally_parts_with_po: [
      { job_id: 'job-1', part_id: 'part-1', price_at_time: 10, fixture_cost: null, quantity: 3 },
      { job_id: 'job-1', part_id: null, price_at_time: null, fixture_cost: 25, quantity: 2 },
    ],
    get_jobs_ledger_by_ids: [{ id: 'job-1' }, { id: 'job-2' }],
    get_bids_by_ids: [{ id: 'bid-1', bid_number: ' B12 ', project_name: null, address: ' 1 Main ' }],
    jobs_ledger: [{ id: 'job-1', status: 'billed' }],
    get_invoice_amounts_for_jobs: [{ job_id: 'job-1', invoice_amount: 1000 }],
    jobs_ledger_materials: [
      { job_id: 'job-1', amount: 100 },
      { job_id: 'job-1', amount: 50 },
    ],
    mercury_transaction_job_allocations: [{ job_id: 'job-1', amount: -40, mercury_transaction_id: 'tx-1' }],
  }

  it('shapes a hand-built week', async () => {
    serve(week)
    const u = await loadTeamReviewUnion(START, END, false, payConfig, NO_TAGS, [])

    expect(u.periodLaborRows).toEqual([sheet])
    expect(u.periodHoursRows).toEqual(week.people_hours)
    expect(u.hoursMap).toEqual({ 'Al:2026-09-02': 8 })
    expect(u.crewByDatePerson).toEqual({ '2026-09-02:Al': { job_assignments: [{ job_id: 'job-1', pct: 50 }] } })
    // A bid day with no assignments reads as an empty list, not null.
    expect(u.periodCrewBidRows.map((r) => r.bid_assignments)).toEqual([[{ bid_id: 'bid-1', pct: 100 }], []])
    expect(u.bidsById.get('bid-1')).toEqual({ bid_number: 'B12', project_name: '', address: '1 Main' })

    // Settings: the row that is set, and the default for the one that is not.
    expect(u.mileageCost).toBe(0.5)
    expect(u.timePerMile).toBe(0.02)

    // Crew, Convention 1: 8 h × 50% = 4 h on the job, at Al's $30.
    expect(u.teamLaborHoursByJobId.get('job-1')).toBe(4)
    expect(u.teamLaborCostByJobId.get('job-1')).toBe(120)

    // The sheet is costed by the Jobs page's rule and keyed by its link.
    expect(u.laborItemsByJobId.get('sheet-1')).toHaveLength(1)
    expect(u.laborCostByJobId.get('job-2')).toBe(
      laborJobSubCost({ labor_rate: 40, items: u.laborItemsByJobId.get('sheet-1')!, distance_miles: 10 }, 0.5, 0.02),
    )
    expect(u.laborCostByJobId.has('job-1')).toBe(false)

    // Tally parts: a part at its price, a fixture at its cost.
    expect(u.partsCostByJobId.get('job-1')).toBe(3 * 10 + 2 * 25)
    expect(u.invoiceAmountByJob).toEqual({ 'job-1': 1000 })
    expect(u.billedMaterialsByJobId.get('job-1')).toBe(150)
    // A card purchase arrives negative and counts as cost.
    expect(u.cardChargesByJobId.get('job-1')).toBe(40)

    // The ledger rows carry the status read beside them; none reads as null.
    expect([...u.jobsById.keys()].sort()).toEqual(['job-1', 'job-2'])
    expect(u.jobsById.get('job-1')!.status).toBe('billed')
    expect(u.jobsById.get('job-2')!.status).toBeNull()

    expect(u.officeJobLedgerId).toBeNull()
    expect(u.vehicleByPersonName).toEqual({})
    expect(u.costLineTags).toEqual([])
    expect(u.tagChargesByJobId.size).toBe(0)
  })

  it('prices crew time by the pay config row found by person id before name', async () => {
    serve({
      ...week,
      people_crew_jobs: [{ work_date: '2026-09-02', person_name: 'Al (renamed)', person_id: 'p-al', job_assignments: [{ job_id: 'job-1', pct: 100 }] }],
      people_hours: [{ person_name: 'Al (renamed)', work_date: '2026-09-02', hours: 8 }],
    })
    const u = await loadTeamReviewUnion(START, END, false, payConfig, NO_TAGS, [])
    expect(u.teamLaborCostByJobId.get('job-1')).toBe(8 * 30)
  })

  it('buckets the period’s overhead sessions by person', async () => {
    officeJobId.mockResolvedValue('office-1')
    const session = (over: Record<string, unknown>) => ({
      id: 's',
      user_id: 'u-al',
      work_date: '2026-09-02',
      clocked_in_at: '2026-09-02T14:00:00Z',
      clocked_out_at: '2026-09-02T16:00:00Z',
      job_ledger_id: 'office-1',
      bid_id: null,
      approved_at: '2026-09-03T00:00:00Z',
      rejected_at: null,
      revoked_at: null,
      users: { name: ' Al ' },
      ...over,
    })
    serve({
      clock_sessions: [
        session({ id: 's-office' }),
        session({ id: 's-bid', job_ledger_id: null, bid_id: 'bid-1', clocked_out_at: '2026-09-02T15:00:00Z' }),
        session({ id: 's-rejected', rejected_at: '2026-09-03T00:00:00Z' }),
        session({ id: 's-revoked', revoked_at: '2026-09-03T00:00:00Z' }),
        session({ id: 's-unapproved', approved_at: null }),
        session({ id: 's-open', clocked_out_at: null }),
        session({ id: 's-field', job_ledger_id: 'job-1' }),
        session({ id: 's-nameless', users: null }),
      ],
    })
    const u = await loadTeamReviewUnion(START, END, false, payConfig, NO_TAGS, [])
    expect(u.officeJobLedgerId).toBe('office-1')
    expect(u.overheadHoursByPerson).toEqual({ Al: { office: 2, bid: 1 } })
    expect(u.overheadHoursByPersonByDate).toEqual({ 'Al:2026-09-02': 3 })
    expect(u.overheadSessionsByPerson.Al!.map((s) => [s.sessionId, s.bucket, s.hours, s.bidId])).toEqual([
      ['s-office', 'office', 2, null],
      ['s-bid', 'bid', 1, 'bid-1'],
    ])
  })
})

describe('loadTeamReviewUnion — Wheels and the users it is handed', () => {
  const fuelTag: CategoryTagRow = { id: 'tag-fuel', name: 'Fuel & gas', icon: '⛽', color: 'amber' as CategoryTagRow['color'], sort_order: 1, default_key: 'fuel', show_as_cost_line: true, hide_from_picker: false }
  const tags = buildCategoryTagLookups([fuelTag], [{ tag_id: 'tag-fuel', bank_category: 'Fuel', label_id: null }])
  const rows = {
    people_crew_jobs: [{ work_date: '2026-09-02', person_name: 'Al', person_id: 'p-al', job_assignments: [{ job_id: 'job-1', pct: 100 }] }],
    get_jobs_ledger_by_ids: [{ id: 'job-1' }],
    mercury_transaction_job_allocations: [
      { job_id: 'job-1', amount: -60, mercury_transaction_id: 'tx-fuel' },
      { job_id: 'job-1', amount: -40, mercury_transaction_id: 'tx-parts' },
    ],
    mercury_transactions: [
      { id: 'tx-fuel', mercury_category: 'Fuel', kind: 'debitCardTransaction' },
      { id: 'tx-parts', mercury_category: 'Hardware', kind: 'debitCardTransaction' },
    ],
  }
  const deal = { name: 'Al', arrangement: 'own_fuel_paid', effectiveRate: 3, truck: null, note: 'his own truck' }

  beforeEach(() => {
    serve(rows)
    wheelsSnapshot.mockResolvedValue({ rows: [deal, { name: 'Bo', arrangement: 'none', effectiveRate: null, truck: null, note: '' }], fuelTag })
    attributions.mockResolvedValue([{ mercury_transaction_id: 'tx-fuel', user_id: 'u-al' }])
  })

  it('takes the fuel a person with a vehicle deal bought off the job', async () => {
    const users = [{ id: 'u-al', name: 'Al' }]
    const u = await loadTeamReviewUnion(START, END, false, payConfig, tags, users)
    expect(wheelsSnapshot).toHaveBeenCalledWith({ todayYmd: '2026-09-10', users })
    expect(u.vehicleByPersonName).toEqual({ Al: { arrangement: 'own_fuel_paid', rate: 3, truckName: null, note: 'his own truck' } })
    expect(u.cardChargesByJobId.get('job-1')).toBe(40)
    expect(u.tagChargesByJobId.get('job-1')).toBeUndefined()
    expect(u.costLineTags).toEqual([fuelTag])
  })

  it('leaves the fuel on the job when the buyer is not among the users', async () => {
    const u = await loadTeamReviewUnion(START, END, false, payConfig, tags, [])
    expect(u.cardChargesByJobId.get('job-1')).toBe(100)
    expect([...u.tagChargesByJobId.get('job-1')!]).toEqual([['tag-fuel', 60]])
  })

  it('leaves a fuel charge that was not a card purchase on the job', async () => {
    serve({ ...rows, mercury_transactions: [{ id: 'tx-fuel', mercury_category: 'Fuel', kind: 'outgoingPayment' }] })
    const u = await loadTeamReviewUnion(START, END, false, payConfig, tags, [{ id: 'u-al', name: 'Al' }])
    expect(u.cardChargesByJobId.get('job-1')).toBe(100)
  })

  it('carries on without vehicle deals when Wheels cannot be read', async () => {
    wheelsSnapshot.mockRejectedValue(new Error('rls'))
    const u = await loadTeamReviewUnion(START, END, false, payConfig, tags, [{ id: 'u-al', name: 'Al' }])
    expect(u.vehicleByPersonName).toEqual({})
    expect(u.cardChargesByJobId.get('job-1')).toBe(100)
    expect(attributions).not.toHaveBeenCalled()
  })

  it('drops an Internal Transfer by the one card rule', async () => {
    cardExclusions.mockResolvedValue({ bucketByTxId: new Map([['tx-parts', 'internal_transfer']]), invoiceLinkedTxIds: new Set() })
    const u = await loadTeamReviewUnion(START, END, false, payConfig, tags, [{ id: 'u-al', name: 'Al' }])
    expect(cardExclusions).toHaveBeenCalledWith(['tx-fuel', 'tx-parts'])
    expect(u.cardChargesByJobId.get('job-1')).toBeUndefined()
  })
})

describe('loadTeamReviewUnion — a failed read', () => {
  it('throws when a paged read fails, never an empty union', async () => {
    route = (q) => (q.name === 'people_hours' ? { data: null, error: { message: 'timeout' } } : { data: [], error: null })
    await expect(loadTeamReviewUnion(START, END, false, payConfig, NO_TAGS, [])).rejects.toBeInstanceOf(DatabaseError)
  })

  it('throws, naming the load, when the settings read fails', async () => {
    route = (q) => (q.name === 'app_settings' ? { data: null, error: { message: 'permission denied' } } : { data: [], error: null })
    await expect(loadTeamReviewUnion(START, END, false, payConfig, NO_TAGS, [])).rejects.toThrow(
      'Failed to load team summary data: permission denied',
    )
  })
})
