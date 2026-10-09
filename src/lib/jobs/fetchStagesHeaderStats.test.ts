import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The lean fetch under the Pipeline strip, the Dashboard AR card, the Billed
 * pin and Quickfill's chase queue. The kernels it feeds (`stagesHeaderStats`,
 * `billTruth`, the board lists) have their own suites; this pins the four
 * bounded reads it sends — the active-cohort jobs, the paid head-count, the
 * open invoices, the linked-or-recent payments — how they are paged, what the
 * result carries, and the fallback error.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => { data?: unknown; count?: number; error: null } = () => ({ data: [], error: null })
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') {
              return (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
                try {
                  resolve(route(table, steps))
                } catch (e) {
                  reject(e)
                }
              }
            }
            return (...a: unknown[]) => {
              steps.push({ method: String(prop), args: a })
              return p
            }
          },
        },
      )
      return p
    },
  },
}))
vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: null }>) => (await op()).data,
  formatErrorMessage: (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback),
}))

import { collectedWindowStartYmd, fetchStagesHeaderStats, LEAN_STATS_ACTIVE_INVOICE_STATUSES, LEAN_STATS_ACTIVE_JOB_STATUSES } from './fetchStagesHeaderStats'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const isHead = (steps: Step[]) => steps.some((s) => s.method === 'select' && (s.args[1] as { head?: boolean } | undefined)?.head === true)
const q = (table: string, head = false) => queries.find((x) => x.table === table && isHead(x.steps) === head)!
const now = new Date('2026-09-07T18:00:00Z')

const data = {
  jobs: [
    { id: 'A', status: 'billed', revenue: 500, payments_made: 200, pct_complete: 100, collections_at: null, hcp_number: '200', click_number: null, customer_id: 'c1', gc_customer_id: null },
    { id: 'B', status: 'working', revenue: 900, payments_made: 0, pct_complete: 40, collections_at: null, hcp_number: '201', click_number: null, customer_id: 'c1', gc_customer_id: null },
  ],
  invoices: [{ id: 'i1', job_id: 'A', amount: 500, status: 'billed', sequence_order: 1, is_primary_rtb_bundle: false, estimated_bill_date: null, billed_at: '2026-09-01' }],
  payments: [{ job_id: 'A', invoice_id: 'i1', amount: 200, paid_on: '2026-09-03' }],
}
const routeScenario = (table: string, steps: Step[]) => {
  if (table === 'jobs_ledger') return isHead(steps) ? { count: 7, error: null } : { data: data.jobs, error: null }
  if (table === 'jobs_ledger_invoices') return { data: data.invoices, error: null }
  if (table === 'jobs_ledger_payments') return { data: data.payments, error: null }
  return { data: [], error: null }
}

beforeEach(() => {
  queries.length = 0
  route = routeScenario
})

describe('collectedWindowStartYmd', () => {
  it('is the first day of the trailing 30-day window', () => {
    expect(collectedWindowStartYmd(now)).toBe('2026-08-09')
  })
})

describe('fetchStagesHeaderStats', () => {
  it('sends the four bounded reads: active-cohort jobs, paid head-count, open invoices, linked-or-recent payments — all paged and id-ordered', async () => {
    const r = await fetchStagesHeaderStats(null, now)
    expect(r.ok).toBe(true)
    const jobs = q('jobs_ledger')
    expect(argsOf(jobs.steps, 'select')[0]![0]).toBe(
      'id, status, revenue, payments_made, pct_complete, collections_at, uncollectible_at, hcp_number, click_number, customer_id, gc_customer_id, bill_to_party, job_name, customer_name',
    )
    expect(argsOf(jobs.steps, 'or')).toEqual([[`status.in.(${LEAN_STATS_ACTIVE_JOB_STATUSES.join(',')}),status.is.null`]])
    expect(argsOf(jobs.steps, 'order')).toEqual([['id']])
    expect(argsOf(jobs.steps, 'range')).toEqual([[0, 999]])
    expect(argsOf(jobs.steps, 'eq')).toEqual([])

    const paid = q('jobs_ledger', true)
    expect(argsOf(paid.steps, 'select')).toEqual([['id', { count: 'exact', head: true }]])
    expect(argsOf(paid.steps, 'eq')).toEqual([['status', 'paid']])

    const inv = q('jobs_ledger_invoices')
    expect(argsOf(inv.steps, 'in')).toEqual([['status', [...LEAN_STATS_ACTIVE_INVOICE_STATUSES]]])
    expect(argsOf(inv.steps, 'range')).toEqual([[0, 999]])

    const pay = q('jobs_ledger_payments')
    expect(argsOf(pay.steps, 'select')).toEqual([['id, job_id, invoice_id, amount, paid_on']])
    expect(argsOf(pay.steps, 'or')).toEqual([['invoice_id.not.is.null,paid_on.gte.2026-08-09']])
    expect(argsOf(pay.steps, 'range')).toEqual([[0, 999]])
  })

  it('a customer filter narrows the job reads (rows and head-count) but not the invoice or payment reads', async () => {
    await fetchStagesHeaderStats('c1', now)
    expect(argsOf(q('jobs_ledger').steps, 'eq')).toEqual([['customer_id', 'c1']])
    expect(argsOf(q('jobs_ledger', true).steps, 'eq')).toEqual([
      ['status', 'paid'],
      ['customer_id', 'c1'],
    ])
    expect(argsOf(q('jobs_ledger_invoices').steps, 'eq')).toEqual([])
    expect(argsOf(q('jobs_ledger_payments').steps, 'eq')).toEqual([])
  })

  it('returns the stats with the head-count as paid, collected-by-day from the raw payments, the bill truth, and the lean billed rows for the chase queue', async () => {
    const r = await fetchStagesHeaderStats(null, now)
    if (!r.ok) throw new Error(r.error)
    expect(r.stats.paid).toEqual({ count: 7 })
    expect(r.stats.billTruth).toBe(r.billTruth)
    expect(typeof r.billTruth.billed.total).toBe('number')
    expect(Object.keys(r.stats.collectedByDay ?? {}).length + (r.stats.collectedByDay instanceof Map ? r.stats.collectedByDay.size : 0)).toBeGreaterThan(0)
    expect(r.leanBilledRows.map((row) => [row.kind, row.job.id])).toEqual([['job_with_merged_billed', 'A']]) // the billed job with its invoice merged, not the working one
  })

  it('adds the unlinked payments of jobs with a billed bill, and those jobs\' paid bills — the payment rule walks them (v2.5006)', async () => {
    // Job 273's shape: three billed bills, no linked money, $39,680 put on the job with no bill picked.
    const job273 = { id: 'J273', status: 'billed', revenue: 56365, payments_made: 39680, pct_complete: 100, collections_at: null, hcp_number: '273', click_number: null, customer_id: 'c1', gc_customer_id: null }
    const bill = (id: string, amount: number, seq: number, status = 'billed') => ({ id, job_id: 'J273', amount, status, sequence_order: seq, is_primary_rtb_bundle: false, estimated_bill_date: null, billed_at: `2026-0${seq + 3}-16` })
    const bills = [bill('b0', 13420, 0), bill('b1', 665, 1), bill('b2', 3500, 2)]
    const unlinked = [12000, 1200, 8880, 17600].map((amount, i) => ({ id: `p${i}`, job_id: 'J273', invoice_id: null, amount, paid_on: `2025-1${i}-01` }))
    route = (table, steps) => {
      if (table === 'jobs_ledger') return isHead(steps) ? { count: 0, error: null } : { data: [job273], error: null }
      if (table === 'jobs_ledger_invoices') {
        const paidRead = argsOf(steps, 'eq').some(([c, v]) => c === 'status' && v === 'paid')
        return { data: paidRead ? [] : bills, error: null }
      }
      if (table === 'jobs_ledger_payments') {
        const unlinkedRead = argsOf(steps, 'is').some(([c, v]) => c === 'invoice_id' && v === null)
        return { data: unlinkedRead ? unlinked : [], error: null }
      }
      return { data: [], error: null }
    }
    const r = await fetchStagesHeaderStats(null, now)
    if (!r.ok) throw new Error(r.error)
    const payReads = queries.filter((x) => x.table === 'jobs_ledger_payments')
    expect(payReads).toHaveLength(2)
    expect(argsOf(payReads[1]!.steps, 'is')).toEqual([['invoice_id', null]])
    expect(argsOf(payReads[1]!.steps, 'in')).toEqual([['job_id', ['J273']]])
    const invReads = queries.filter((x) => x.table === 'jobs_ledger_invoices')
    expect(invReads).toHaveLength(2)
    expect(argsOf(invReads[1]!.steps, 'eq')).toEqual([['status', 'paid']])
    expect(argsOf(invReads[1]!.steps, 'in')).toEqual([['job_id', ['J273']]])
    // $38,780 paid the part of the job on no bill; the $900 left went to the oldest bill.
    expect(r.billTruth.billed.total).toBe(16685)
    expect(r.billTruth.billed.rows.map((row) => [row.invoiceId, row.remaining])).toEqual([
      ['b0', 12520],
      ['b1', 665],
      ['b2', 3500],
    ])
  })

  it('a head-count of null reads as zero', async () => {
    route = (table, steps) => (table === 'jobs_ledger' && isHead(steps) ? { count: undefined, error: null } : routeScenario(table, steps))
    const r = await fetchStagesHeaderStats(null, now)
    expect(r.ok && r.stats.paid.count).toBe(0)
  })

  it('capable to bill reads the Working jobs\' stage plans, exactly as the Capable list does (v2.3809)', async () => {
    // No fixtures, no plan: the formula — B is 40% through $900, nothing billed.
    const plain = await fetchStagesHeaderStats(null, now)
    if (!plain.ok) throw new Error(plain.error)
    expect(plain.stats.capableToBill).toBe(360)
    const fixtures = q('jobs_ledger_fixtures')
    expect(argsOf(fixtures.steps, 'select')).toEqual([['id, job_id, name, count, line_unit_price, sequence_order, invoice_id, line_kind, discount_pct, discount_basis_positions, progress_pct, stage_kind, shared_with_gc']])
    expect(argsOf(fixtures.steps, 'in')).toEqual([['job_id', ['B']]]) // Working jobs only
    expect(argsOf(q('job_stage_windows').steps, 'in')).toEqual([['job_id', ['B']]])

    // B split into one Order stage with no window passed: the plan says nothing is billable yet.
    queries.length = 0
    route = (table, steps) => {
      if (table === 'jobs_ledger_fixtures')
        return { data: [{ id: 'f1', job_id: 'B', name: 'Rough-in', count: 1, line_unit_price: 900, sequence_order: 1, invoice_id: null, line_kind: 'work', discount_pct: null, discount_basis_positions: null, progress_pct: null, stage_kind: 'order', shared_with_gc: false }], error: null }
      return routeScenario(table, steps)
    }
    const planned = await fetchStagesHeaderStats(null, now)
    if (!planned.ok) throw new Error(planned.error)
    expect(planned.stats.capableToBill).toBe(0)

    // The plan reads failing is not a failed stats load: the formula figure stands.
    queries.length = 0
    route = (table, steps) => {
      if (table === 'jobs_ledger_fixtures') throw new Error('fixtures down')
      return routeScenario(table, steps)
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fallback = await fetchStagesHeaderStats(null, now)
    warn.mockRestore()
    if (!fallback.ok) throw new Error(fallback.error)
    expect(fallback.stats.capableToBill).toBe(360)
  })

  it('a failed read reports ok:false with the message, or the fallback', async () => {
    route = () => {
      throw new Error('timeout')
    }
    expect(await fetchStagesHeaderStats(null, now)).toEqual({ ok: false, error: 'timeout' })
    route = () => {
      throw 'weird'
    }
    expect(await fetchStagesHeaderStats(null, now)).toEqual({ ok: false, error: 'Could not load board stats' })
  })
})

describe('fetchStagesHeaderStats · excludeZzTestJobs (punch list #61, v2.5116)', () => {
  // Made-up jobs. A is real and billed; Z is a ZZ job by its own name, billed for a $2,200 test bid;
  // Y is a ZZ job only by its customer's name, ready to bill; P is a paid ZZ job the active read never ships.
  const job = (id: string, status: string, revenue: number, paid: number, jobName: string, customerName: string) => ({
    id, status, revenue, payments_made: paid, pct_complete: 100, collections_at: null, hcp_number: id, click_number: null,
    customer_id: 'c1', gc_customer_id: null, job_name: jobName, customer_name: customerName,
  })
  const jobs = [
    job('A', 'billed', 500, 200, '101 Hill Street', 'Ann Lee'),
    job('Z', 'billed', 2200, 100, 'ZZ TEST billed', 'Ann Lee'),
    job('Y', 'ready_to_bill', 300, 0, 'Hill Street remodel', 'zz Test Customer'),
  ]
  const zzRows = [
    { id: 'Z', status: 'billed', job_name: 'ZZ TEST billed', customer_name: 'Ann Lee' },
    { id: 'Y', status: 'ready_to_bill', job_name: 'Hill Street remodel', customer_name: 'zz Test Customer' },
    { id: 'P', status: 'paid', job_name: 'ZZ TEST paid', customer_name: 'Ann Lee' },
  ]
  const invoice = (id: string, jobId: string, amount: number, status: string) => ({
    id, job_id: jobId, amount, status, sequence_order: 1, is_primary_rtb_bundle: false, estimated_bill_date: null, billed_at: status === 'billed' ? '2026-09-01' : null,
  })
  const invoices = [invoice('i1', 'A', 500, 'billed'), invoice('iz', 'Z', 2200, 'billed'), invoice('iy', 'Y', 300, 'ready_to_bill')]
  const payments = [
    { id: 'p1', job_id: 'A', invoice_id: 'i1', amount: 200, paid_on: '2026-09-03' },
    { id: 'pz', job_id: 'Z', invoice_id: 'iz', amount: 100, paid_on: '2026-09-04' },
    { id: 'pp', job_id: 'P', invoice_id: null, amount: 50, paid_on: '2026-09-05' },
  ]
  const isZzRead = (steps: Step[]) => argsOf(steps, 'or').some(([f]) => f === 'job_name.ilike.ZZ%,customer_name.ilike.ZZ%')
  const zzScenario = (table: string, steps: Step[]) => {
    if (table === 'jobs_ledger') {
      if (isHead(steps)) return { count: 7, error: null }
      return { data: isZzRead(steps) ? zzRows : jobs, error: null }
    }
    if (table === 'jobs_ledger_invoices') return { data: argsOf(steps, 'eq').length > 0 ? [] : invoices, error: null }
    if (table === 'jobs_ledger_payments') return { data: argsOf(steps, 'is').length > 0 ? [] : payments, error: null }
    return { data: [], error: null }
  }
  const collected = (points: Array<{ total: number }> | undefined) => (points ?? []).reduce((sum, p) => sum + p.total, 0)

  beforeEach(() => {
    route = zzScenario
  })

  it('without the option, sends no ZZ read and counts the ZZ jobs as today', async () => {
    const r = await fetchStagesHeaderStats(null, now)
    if (!r.ok) throw new Error(r.error)
    expect(queries.filter((x) => x.table === 'jobs_ledger' && !isHead(x.steps))).toHaveLength(1)
    expect(r.stats.paid).toEqual({ count: 7 })
    expect(r.billTruth.billed.total).toBe(2400) // A's $300 left and Z's $2,100
    expect(r.leanBilledRows.map((row) => row.job.id).sort()).toEqual(['A', 'Z'])
    expect(collected(r.stats.collectedByDay)).toBe(350)
  })

  it('with the option, the ZZ jobs leave with their bills and payments, and none of their bills is an orphan', async () => {
    const r = await fetchStagesHeaderStats(null, now, { excludeZzTestJobs: true })
    if (!r.ok) throw new Error(r.error)
    const zzRead = queries.find((x) => x.table === 'jobs_ledger' && isZzRead(x.steps))!
    expect(argsOf(zzRead.steps, 'select')).toEqual([['id, status, job_name, customer_name']])
    expect(argsOf(zzRead.steps, 'order')).toEqual([['id']])
    expect(argsOf(zzRead.steps, 'range')).toEqual([[0, 999]])
    expect(argsOf(zzRead.steps, 'eq')).toEqual([])
    expect(r.billTruth.billed.total).toBe(300)
    expect(r.billTruth.excludedOwed).toEqual({ count: 0, total: 0 })
    expect(r.leanBilledRows.map((row) => row.job.id)).toEqual(['A'])
    expect(r.stats.readyToBill.count).toBe(0) // Y was the only one, and it is a ZZ customer's
    expect(r.stats.paid).toEqual({ count: 6 }) // P, paid and never in the active read, leaves the head-count
    expect(collected(r.stats.collectedByDay)).toBe(200) // Z's $100 and P's $50 leave collected-by-day
  })

  it('a customer filter narrows the ZZ read too', async () => {
    await fetchStagesHeaderStats('c1', now, { excludeZzTestJobs: true })
    const zzRead = queries.find((x) => x.table === 'jobs_ledger' && isZzRead(x.steps))!
    expect(argsOf(zzRead.steps, 'eq')).toEqual([['customer_id', 'c1']])
  })
})

describe('collectedWindowStartYmd · today on the company calendar (v2.4475)', () => {
  it('starts the window 29 days before the Central day', () => {
    // 00:30 UTC on Oct 3 is 7:30 pm CDT on Oct 2.
    expect(collectedWindowStartYmd(new Date('2026-10-03T00:30:00Z'))).toBe('2026-09-03')
    expect(collectedWindowStartYmd(new Date('2026-10-03T12:00:00Z'))).toBe('2026-09-04')
  })
})
