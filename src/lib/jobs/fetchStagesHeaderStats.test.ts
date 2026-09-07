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
const shadow = vi.fn((_r: { surface: string; legacy: number; kernel: number }) => true)
vi.mock('../billing/billTruthShadow', () => ({ reportBillTruthShadow: (r: never) => shadow(r), legacyStripBilledTotal: () => 0 }))

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
  shadow.mockClear()
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
    expect(argsOf(jobs.steps, 'select')[0]![0]).toBe('id, status, revenue, payments_made, pct_complete, collections_at, hcp_number, click_number, customer_id, gc_customer_id')
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
    expect(argsOf(pay.steps, 'select')).toEqual([['job_id, invoice_id, amount, paid_on']])
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
    expect(shadow).toHaveBeenCalledWith({ surface: 'pipeline-strip-billed', legacy: 0, kernel: r.billTruth.billed.total })
  })

  it('a head-count of null reads as zero', async () => {
    route = (table, steps) => (table === 'jobs_ledger' && isHead(steps) ? { count: undefined, error: null } : routeScenario(table, steps))
    const r = await fetchStagesHeaderStats(null, now)
    expect(r.ok && r.stats.paid.count).toBe(0)
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
