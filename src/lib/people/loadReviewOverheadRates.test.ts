import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The Review tab's 90-day overhead scan. The kernels it composes (the wage
 * lookup, the daily labor builders, the invoice bucketing, the three rates)
 * have their own suites; this pins the composition: the window, which
 * sessions and invoices each read asks for, a hand-built window's twelve
 * figures, the two points it stops at when cancelled, and that a failed read
 * throws.
 */
type Step = { method: string; args: unknown[] }
type Query = { table: string; steps: Step[] }
type Result = { data: unknown; error: { message: string } | null }
const queries: Query[] = []
let rowsByTable: Record<string, unknown[] | ((q: Query) => unknown[])> = {}

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const q: Query = { table, steps: [] }
      queries.push(q)
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') {
              return (resolve: (v: Result) => void) => {
                const r = rowsByTable[table]
                resolve({ data: typeof r === 'function' ? r(q) : (r ?? []), error: null })
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

import { EMPTY_REVIEW_OVERHEAD_RATES, loadReviewOverheadRates } from './loadReviewOverheadRates'

// "Today" is 2026-09-10 on the company calendar; 90 days back, inclusive, opens 2026-06-13.
const TODAY = '2026-09-10'
const WINDOW_START = '2026-06-13'

const has = (q: Query, method: string, ...args: unknown[]) =>
  q.steps.some((s) => s.method === method && JSON.stringify(s.args) === JSON.stringify(args))
const reads = (table: string) => queries.filter((q) => q.table === table)
const isFieldRead = (q: Query) => has(q, 'not', 'job_ledger_id', 'is', null)

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
  users: { name: 'Al' },
  ...over,
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-10T18:00:00Z'))
  queries.length = 0
  rowsByTable = {}
  officeJobId.mockReset().mockResolvedValue('office-1')
  officeParts.mockReset().mockResolvedValue({ partsUsdByDay: new Map<string, number>() })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('loadReviewOverheadRates — what it asks for', () => {
  it('scans 90 company-calendar days ending today', async () => {
    const r = await loadReviewOverheadRates()
    expect(r?.windowStart).toBe(WINDOW_START)
    expect(r?.windowEnd).toBe(TODAY)
    const sessions = reads('clock_sessions')
    expect(sessions).toHaveLength(2)
    for (const q of sessions) {
      expect(has(q, 'gte', 'work_date', WINDOW_START)).toBe(true)
      expect(has(q, 'lte', 'work_date', TODAY)).toBe(true)
    }
    expect(officeParts).toHaveBeenCalledWith({ officeJobLedgerId: 'office-1', startYmd: WINDOW_START, endYmd: TODAY })
  })

  it('reads the pool from office-or-bid sessions and the denominators from every other job', async () => {
    await loadReviewOverheadRates()
    const pool = reads('clock_sessions').find((q) => !isFieldRead(q))!
    const field = reads('clock_sessions').find(isFieldRead)!
    expect(has(pool, 'or', 'job_ledger_id.eq.office-1,bid_id.not.is.null')).toBe(true)
    expect(has(field, 'neq', 'job_ledger_id', 'office-1')).toBe(true)
  })

  it('with no office job set: bid sessions only, every job is field, and no parts read', async () => {
    officeJobId.mockResolvedValue(null)
    await loadReviewOverheadRates()
    const pool = reads('clock_sessions').find((q) => !isFieldRead(q))!
    const field = reads('clock_sessions').find(isFieldRead)!
    expect(has(pool, 'not', 'bid_id', 'is', null)).toBe(true)
    expect(pool.steps.some((s) => s.method === 'or')).toBe(false)
    expect(field.steps.some((s) => s.method === 'neq')).toBe(false)
    expect(officeParts).not.toHaveBeenCalled()
  })

  it('reads invoices a day wide on both sides and leaves Stripe test mode out', async () => {
    await loadReviewOverheadRates()
    const inv = reads('jobs_ledger_invoices')[0]!
    expect(has(inv, 'gte', 'sent_to_customer_at', '2026-06-12T00:00:00-00:00')).toBe(true)
    expect(has(inv, 'lt', 'sent_to_customer_at', '2026-09-12T00:00:00-00:00')).toBe(true)
    expect(has(inv, 'or', 'stripe_mode.is.null,stripe_mode.neq.test')).toBe(true)
  })

  it('reads the people who have an account and are not archived, and the pay config’s two rates', async () => {
    await loadReviewOverheadRates()
    const people = reads('people')[0]!
    expect(has(people, 'not', 'account_user_id', 'is', null)).toBe(true)
    expect(has(people, 'is', 'archived_at', null)).toBe(true)
    expect(has(reads('people_pay_config')[0]!, 'select', 'person_name, person_id, hourly_wage, office_hourly_wage, is_salary')).toBe(true)
  })
})

describe('loadReviewOverheadRates — what it returns', () => {
  it('works a hand-built window into the twelve figures', async () => {
    rowsByTable = {
      clock_sessions: (q) =>
        isFieldRead(q)
          ? [session({ id: 's-field', job_ledger_id: 'job-1', clocked_out_at: '2026-09-02T18:00:00Z' })]
          : [
              session({ id: 's-office' }),
              session({ id: 's-bid', job_ledger_id: null, bid_id: 'bid-1', clocked_out_at: '2026-09-02T15:00:00Z' }),
            ],
      people: [{ id: 'p-al', account_user_id: 'u-al' }],
      people_pay_config: [{ person_name: 'Al', person_id: 'p-al', hourly_wage: 30, office_hourly_wage: 20, is_salary: false }],
      jobs_ledger_invoices: [{ amount: 1200, sent_to_customer_at: '2026-09-02T18:00:00Z' }],
    }
    officeParts.mockResolvedValue({ partsUsdByDay: new Map([['2026-09-02', 60]]) })

    const r = await loadReviewOverheadRates()
    // Office 2 h and a bid 1 h at the office rate; the field job 4 h at the field rate.
    expect(r).toEqual({
      loading: false,
      windowStart: WINDOW_START,
      windowEnd: TODAY,
      officeLabor90d: 40,
      bidLabor90d: 20,
      officeParts90d: 60,
      invoices90d: 1200,
      fieldHours90d: 4,
      fieldLaborUsd90d: 120,
      // Pool = 40 + 20 + 60 = 120.
      ratePerHour: 120 / 4,
      ratePerRevenueDecimal: 120 / 1200,
      ratePerLaborDollar: 120 / 120,
    })
  })

  it('an empty window is zeros with no rate, not a failure', async () => {
    const r = await loadReviewOverheadRates()
    expect(r).toEqual({
      ...EMPTY_REVIEW_OVERHEAD_RATES,
      windowStart: WINDOW_START,
      windowEnd: TODAY,
      officeLabor90d: 0,
      bidLabor90d: 0,
      officeParts90d: 0,
      invoices90d: 0,
      fieldHours90d: 0,
      fieldLaborUsd90d: 0,
    })
  })
})

describe('loadReviewOverheadRates — cancelled and failed', () => {
  it('stops after the first wave when cancelled, before the pay config read', async () => {
    const r = await loadReviewOverheadRates({ isCancelled: () => true })
    expect(r).toBeNull()
    expect(reads('clock_sessions')).toHaveLength(2)
    expect(reads('people_pay_config')).toHaveLength(0)
  })

  it('stops after the pay config read when cancelled there', async () => {
    let asked = 0
    const r = await loadReviewOverheadRates({ isCancelled: () => ++asked > 1 })
    expect(r).toBeNull()
    expect(reads('people_pay_config')).toHaveLength(1)
  })

  it('throws when the parts read fails', async () => {
    officeParts.mockRejectedValue(new Error('rls'))
    await expect(loadReviewOverheadRates()).rejects.toThrow('rls')
  })

  it('throws when the office job cannot be read', async () => {
    officeJobId.mockRejectedValue(new Error('no settings'))
    await expect(loadReviewOverheadRates()).rejects.toThrow('no settings')
    expect(queries).toHaveLength(0)
  })
})
