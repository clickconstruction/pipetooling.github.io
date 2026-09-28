import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Review's own 90-day overhead scan (`loadReviewOverheadRates`) against the
 * shared one (`loadOverheadPoolSnapshot`, which serves People → Overhead, the
 * Dashboard, the Bridge and the job day ledger), over the SAME rows. The
 * PEOPLE_REVIEW_TAB map asks for this before Review adopts the shared scan:
 * the twelve figures Review shows must come out the same from both.
 *
 * Where they are known to differ is in what happens when a read fails or a
 * table is long, not in the math — pinned at the bottom.
 */
type Step = { method: string; args: unknown[] }
type Query = { table: string; steps: Step[] }
type Result = { data: unknown; error: { message: string; code?: string } | null }
const queries: Query[] = []
let respond: (q: Query) => Result = () => ({ data: [], error: null })

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const q: Query = { table, steps: [] }
      queries.push(q)
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: Result) => void) => resolve(respond(q))
            return (...a: unknown[]) => {
              q.steps.push({ method: String(prop), args: a })
              return p
            }
          },
        },
      )
      return p
    },
  },
}))

const officeJobId = vi.fn<() => Promise<string | null>>()
vi.mock('../overheadOfficeJobSettings', () => ({
  fetchOverheadOfficeJobLedgerIdFromAppSettings: () => officeJobId(),
}))
const officeParts = vi.fn()
vi.mock('../overheadPartsBucketLoader', () => ({
  loadOfficePartsUsdByDayExcludingInternalTransfer: (input: unknown) => officeParts(input),
}))

import { loadOverheadPoolSnapshot, loadOverheadPoolSnapshotInputs } from '../overheadPoolSnapshot'
import { loadReviewOverheadRates, type ReviewOverheadRates } from './loadReviewOverheadRates'

// "Today" is 2026-09-10 on the company calendar; the window opens 2026-06-13.
const TODAY = '2026-09-10'
const WINDOW_START = '2026-06-13'

const has = (q: Query, method: string, ...args: unknown[]) =>
  q.steps.some((s) => s.method === method && JSON.stringify(s.args) === JSON.stringify(args))
const rangeOf = (q: Query) => (q.steps.find((s) => s.method === 'range')?.args ?? [0, 999]) as [number, number]
const page = (rows: unknown[], q: Query) => rows.slice(rangeOf(q)[0], rangeOf(q)[1] + 1)

type Session = {
  id: string
  user_id: string
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
  job_ledger_id: string | null
  bid_id: string | null
  approved_at: string | null
  rejected_at: string | null
  revoked_at: string | null
  origin?: string
  users: { name: string } | null
}
let nextId = 0
function session(day: string, hours: number, who: { id: string; name: string }, over: Partial<Session> = {}): Session {
  const start = Date.parse(`${day}T14:00:00Z`)
  return {
    id: `s-${++nextId}`,
    user_id: who.id,
    work_date: day,
    clocked_in_at: new Date(start).toISOString(),
    clocked_out_at: new Date(start + hours * 3_600_000).toISOString(),
    job_ledger_id: null,
    bid_id: null,
    approved_at: `${day}T23:00:00Z`,
    rejected_at: null,
    revoked_at: null,
    users: { name: who.name },
    ...over,
  }
}

const AL = { id: 'u-al', name: 'Al' } // two rates
const BO = { id: 'u-bo', name: 'Bo' } // one rate
const CY = { id: 'u-cy', name: 'Cy Renamed' } // pay config still says "Cy" — found by person id only
const DI = { id: 'u-di', name: 'Di' } // salaried
const EV = { id: 'u-ev', name: 'Ev' } // no pay config row at all

const payConfig = [
  { person_name: 'Al', person_id: 'p-al', hourly_wage: 30, office_hourly_wage: 22.5, is_salary: false },
  { person_name: 'Bo', person_id: 'p-bo', hourly_wage: 27.75, office_hourly_wage: null, is_salary: false },
  { person_name: 'Cy', person_id: 'p-cy', hourly_wage: 41.1, office_hourly_wage: 33.3, is_salary: false },
  { person_name: 'Di', person_id: 'p-di', hourly_wage: 38, office_hourly_wage: null, is_salary: true },
]
const people = [
  { id: 'p-al', account_user_id: 'u-al' },
  { id: 'p-bo', account_user_id: 'u-bo' },
  { id: 'p-cy', account_user_id: 'u-cy' },
  { id: 'p-di', account_user_id: 'u-di' },
]

const OFFICE = { job_ledger_id: 'office-1' }
const BID = { bid_id: 'bid-7' }
const FIELD = { job_ledger_id: 'job-9' }

/** A window with the awkward cases in it: both edges, every person kind, every session state. */
function awkwardSessions(): Session[] {
  return [
    // The window's two edges.
    session(WINDOW_START, 2.25, AL, OFFICE),
    session(TODAY, 1.5, AL, BID),
    session(WINDOW_START, 7.5, BO, FIELD),
    session(TODAY, 8, BO, FIELD),
    // The middle, every person kind, on office, bid and field work.
    session('2026-07-04', 3, BO, OFFICE),
    session('2026-07-04', 0.75, CY, BID),
    session('2026-07-04', 6.1, CY, FIELD),
    session('2026-08-15', 4, DI, OFFICE),
    session('2026-08-15', 5, DI, FIELD),
    session('2026-08-16', 2, EV, OFFICE),
    session('2026-08-16', 3.3, EV, FIELD),
    session('2026-08-17', 9.9, AL, { job_ledger_id: 'job-12' }),
    // A bid session on a field job, and one on the office job.
    session('2026-08-20', 1.2, AL, { job_ledger_id: 'job-9', bid_id: 'bid-7' }),
    session('2026-08-20', 1.3, BO, { job_ledger_id: 'office-1', bid_id: 'bid-7' }),
    // States that must not count, or count differently.
    session('2026-08-21', 5, AL, { ...OFFICE, rejected_at: '2026-08-22T00:00:00Z' }),
    session('2026-08-21', 5, AL, { ...FIELD, revoked_at: '2026-08-22T00:00:00Z' }),
    session('2026-08-22', 2.5, BO, { ...OFFICE, approved_at: null }),
    session('2026-08-22', 4.5, BO, { ...FIELD, approved_at: null }),
    session('2026-08-23', 3, CY, { ...BID, clocked_out_at: null }),
    session('2026-08-23', 3, CY, { ...FIELD, clocked_out_at: null }),
    session('2026-08-24', 1, AL, { ...OFFICE, users: null }),
  ]
}

const invoices = [
  { amount: 1200.5, sent_to_customer_at: '2026-07-04T18:00:00Z' },
  { amount: 310, sent_to_customer_at: '2026-08-15T12:00:00Z' },
  // The evening before the window opens, company time — outside.
  { amount: 9999, sent_to_customer_at: '2026-06-13T03:00:00Z' },
  // The first morning of the window, company time — inside.
  { amount: 45.25, sent_to_customer_at: '2026-06-13T14:00:00Z' },
  // Late on the last day, company time — inside, though tomorrow in UTC.
  { amount: 800, sent_to_customer_at: '2026-09-11T02:30:00Z' },
  // After midnight, company time — outside.
  { amount: 7777, sent_to_customer_at: '2026-09-11T06:00:00Z' },
  { amount: null, sent_to_customer_at: '2026-08-01T12:00:00Z' },
  { amount: 50, sent_to_customer_at: null },
]

const parts = new Map([
  [WINDOW_START, 12.34],
  ['2026-07-04', 410.1],
  ['2026-08-15', 0.07],
  [TODAY, 88],
])

/** Serves both scans from one set of rows, by the filters each read carries. */
function serve(rows: { sessions: Session[]; invoices?: unknown[]; payConfig?: unknown[]; people?: unknown[] }) {
  respond = (q) => {
    if (q.table === 'clock_sessions') {
      const inWindow = rows.sessions.filter((s) => s.work_date >= WINDOW_START && s.work_date <= TODAY)
      let out: Session[]
      if (has(q, 'eq', 'origin', 'salary_schedule')) out = []
      else if (has(q, 'not', 'job_ledger_id', 'is', null)) out = inWindow.filter((s) => s.job_ledger_id != null && s.job_ledger_id !== 'office-1')
      else out = inWindow.filter((s) => s.job_ledger_id === 'office-1' || s.bid_id != null)
      return { data: page(out, q), error: null }
    }
    if (q.table === 'jobs_ledger_invoices') return { data: page(rows.invoices ?? [], q), error: null }
    if (q.table === 'people_pay_config') return { data: page(rows.payConfig ?? payConfig, q), error: null }
    if (q.table === 'people') return { data: page(rows.people ?? people, q), error: null }
    return { data: [], error: null }
  }
}

/** The shared scan's result, read as the twelve figures Review shows. */
async function sharedScanAsReviewFigures(): Promise<ReviewOverheadRates | null> {
  const snap = await loadOverheadPoolSnapshot(await loadOverheadPoolSnapshotInputs())
  if (!snap) return null
  return {
    ratePerHour: snap.rates.methodA,
    ratePerRevenueDecimal: snap.rates.methodB,
    ratePerLaborDollar: snap.rates.methodC,
    loading: false,
    windowStart: snap.windowStart,
    windowEnd: snap.windowEnd,
    officeLabor90d: snap.poolTrend.totals.officeLaborUsd,
    bidLabor90d: snap.poolTrend.totals.bidLaborUsd,
    officeParts90d: snap.poolTrend.totals.officePartsUsd,
    invoices90d: snap.lensDetail.denominators.invoicedRevenueUsd,
    fieldHours90d: snap.lensDetail.denominators.fieldHours,
    fieldLaborUsd90d: snap.lensDetail.denominators.fieldLaborUsd,
  }
}

const MONEY_AND_HOURS = [
  'ratePerHour',
  'ratePerRevenueDecimal',
  'ratePerLaborDollar',
  'officeLabor90d',
  'bidLabor90d',
  'officeParts90d',
  'invoices90d',
  'fieldHours90d',
  'fieldLaborUsd90d',
] as const

/** Same to a millionth of a cent: the two scans add the same days in a different order. */
function expectSameFigures(review: ReviewOverheadRates | null, shared: ReviewOverheadRates | null) {
  expect(review).not.toBeNull()
  expect(shared).not.toBeNull()
  expect(review!.windowStart).toBe(shared!.windowStart)
  expect(review!.windowEnd).toBe(shared!.windowEnd)
  for (const key of MONEY_AND_HOURS) {
    const a = review![key]
    const b = shared![key]
    if (a == null || b == null) expect([key, a]).toEqual([key, b])
    else expect(Math.abs(a - b), `${key}: review ${a} vs shared ${b}`).toBeLessThan(1e-8)
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-10T18:00:00Z'))
  nextId = 0
  queries.length = 0
  respond = () => ({ data: [], error: null })
  officeJobId.mockReset().mockResolvedValue('office-1')
  officeParts.mockReset().mockResolvedValue({ partsUsdByDay: parts, partsDetailByDay: new Map(), bucketByTxId: new Map() })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Review’s overhead scan and the shared one — the same figures', () => {
  it('over a window with the awkward cases in it', async () => {
    serve({ sessions: awkwardSessions(), invoices })
    const review = await loadReviewOverheadRates()
    const shared = await sharedScanAsReviewFigures()
    expectSameFigures(review, shared)
    // Not a vacuous match: there is a pool, all three rates, and every figure is in play.
    for (const key of MONEY_AND_HOURS) expect(review![key], key).toBeGreaterThan(0)
    expect(review!.invoices90d).toBeCloseTo(1200.5 + 310 + 45.25 + 800, 8)
    expect(review!.officeParts90d).toBeCloseTo(12.34 + 410.1 + 0.07 + 88, 8)
  })

  it('over an empty window', async () => {
    serve({ sessions: [] })
    officeParts.mockResolvedValue({ partsUsdByDay: new Map(), partsDetailByDay: new Map(), bucketByTxId: new Map() })
    const review = await loadReviewOverheadRates()
    expectSameFigures(review, await sharedScanAsReviewFigures())
    expect(review!.ratePerHour).toBeNull()
  })

  it('with a pool and nothing to divide it by', async () => {
    serve({ sessions: [session('2026-08-15', 4, AL, OFFICE)] })
    const review = await loadReviewOverheadRates()
    expectSameFigures(review, await sharedScanAsReviewFigures())
    expect(review!.officeLabor90d).toBe(90)
    expect([review!.ratePerHour, review!.ratePerRevenueDecimal, review!.ratePerLaborDollar]).toEqual([null, null, null])
  })

  it('with no office job set', async () => {
    officeJobId.mockResolvedValue(null)
    serve({ sessions: awkwardSessions().filter((s) => s.job_ledger_id !== 'office-1'), invoices })
    respond = ((inner) => (q: Query) => {
      if (q.table !== 'clock_sessions' || has(q, 'eq', 'origin', 'salary_schedule')) return inner(q)
      const all = awkwardSessions().filter((s) => s.job_ledger_id !== 'office-1')
      const out = has(q, 'not', 'job_ledger_id', 'is', null) ? all.filter((s) => s.job_ledger_id != null) : all.filter((s) => s.bid_id != null)
      return { data: page(out, q), error: null }
    })(respond)
    const review = await loadReviewOverheadRates()
    expectSameFigures(review, await sharedScanAsReviewFigures())
    expect(officeParts).not.toHaveBeenCalled()
    expect(review!.officeLabor90d).toBe(0)
    expect(review!.bidLabor90d).toBeGreaterThan(0)
  })

  it('over more sessions than one page holds', async () => {
    const many: Session[] = []
    for (let i = 0; i < 1300; i++) {
      const day = `2026-08-${String(1 + (i % 28)).padStart(2, '0')}`
      many.push(session(day, 1 + (i % 7) * 0.25, i % 2 ? AL : BO, i % 3 === 0 ? OFFICE : i % 3 === 1 ? BID : FIELD))
    }
    serve({ sessions: many, invoices })
    const review = await loadReviewOverheadRates()
    expectSameFigures(review, await sharedScanAsReviewFigures())
    expect(review!.fieldHours90d).toBeGreaterThan(0)
  })
})

describe('Review’s overhead scan and the shared one — where they differ', () => {
  it('the person links cannot be read: Review fails, the shared scan prices by name', async () => {
    serve({ sessions: awkwardSessions(), invoices })
    const inner = respond
    respond = (q) => {
      if (q.table === 'people') throw new Error('rls')
      return inner(q)
    }
    await expect(loadReviewOverheadRates()).rejects.toThrow()
    const shared = await sharedScanAsReviewFigures()
    expect(shared).not.toBeNull()
    // Cy is on the books as "Cy" and clocks in as "Cy Renamed": without the link, the wage is not found.
    serve({ sessions: awkwardSessions(), invoices })
    const linked = await sharedScanAsReviewFigures()
    expect(shared!.bidLabor90d!).toBeLessThan(linked!.bidLabor90d!)
  })

  it('a pay config longer than one page: the shared scan reads all of it, Review reads the first page', async () => {
    const filler = Array.from({ length: 1000 }, (_, i) => ({ person_name: `A filler ${i}`, person_id: `p-x-${i}`, hourly_wage: 1, office_hourly_wage: null, is_salary: false }))
    // PostgREST caps an un-ranged read at 1,000 rows: the real rows fall past the cap.
    serve({ sessions: awkwardSessions(), invoices, payConfig: [...filler, ...payConfig] })
    const review = await loadReviewOverheadRates()
    const shared = await sharedScanAsReviewFigures()
    expect(review!.officeLabor90d).toBe(0)
    expect(shared!.officeLabor90d!).toBeGreaterThan(0)
  })
})
