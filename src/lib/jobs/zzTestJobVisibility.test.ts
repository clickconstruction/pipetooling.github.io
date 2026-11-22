import { describe, expect, it } from 'vitest'
import { computeBillTruth } from '../billing/billTruth'
import { buildArBuckets } from '../dashboardFinancials'
import { hidesZzTestJobs, jobIdsAlone, leavesOutByIdAlone, withoutZzTestJobMoney, withoutZzTestJobRows, withoutZzTestJobs, zzTestJobIds } from './zzTestJobVisibility'

// Made-up jobs, customers and amounts.
const job = (id: string, jobName: string, customerName: string | null) => ({
  id,
  job_name: jobName,
  customer_name: customerName,
  status: 'billed',
  revenue: 500,
  payments_made: 0,
  pct_complete: 100,
  collections_at: null,
  hcp_number: id,
  click_number: null,
  customer_id: 'c1',
  gc_customer_id: null,
})
const REAL = job('A', '101 Hill Street', 'Ann Lee')
const ZZ_BY_NAME = job('Z', 'ZZ TEST billed', 'Ann Lee')
const ZZ_BY_CUSTOMER = job('Y', 'Hill Street remodel', '  zz Test Customer')

describe('hidesZzTestJobs', () => {
  it('hides them from every role but dev, whatever the switch says, and while the role is still loading', () => {
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'helper', 'subcontractor']) {
      expect(hidesZzTestJobs(role)).toBe(true)
      expect(hidesZzTestJobs(role, true)).toBe(true)
    }
    expect(hidesZzTestJobs(null, true)).toBe(true)
    expect(hidesZzTestJobs(undefined)).toBe(true)
  })

  it('hides them from a dev by default, and shows them when the dev’s switch does (v2.5120)', () => {
    expect(hidesZzTestJobs('dev')).toBe(true)
    expect(hidesZzTestJobs('dev', false)).toBe(true)
    expect(hidesZzTestJobs('dev', true)).toBe(false)
  })
})

describe('withoutZzTestJobs', () => {
  it('drops a job by its own ZZ name or by its customer’s, and keeps the rest in order', () => {
    expect(withoutZzTestJobs([ZZ_BY_NAME, REAL, ZZ_BY_CUSTOMER]).map((j) => j.id)).toEqual(['A'])
  })

  it('hands back the same array when nothing is a ZZ job', () => {
    const rows = [REAL, job('B', 'Pizza shop', 'Buzz Co')]
    expect(withoutZzTestJobs(rows)).toBe(rows)
  })

  it('names the ZZ ids', () => {
    expect([...zzTestJobIds([ZZ_BY_NAME, REAL, ZZ_BY_CUSTOMER])].sort()).toEqual(['Y', 'Z'])
  })
})

describe('withoutZzTestJobMoney', () => {
  const invoice = (id: string, jobId: string, amount: number) => ({
    id,
    job_id: jobId,
    amount,
    status: 'billed',
    sequence_order: 1,
    is_primary_rtb_bundle: false,
    estimated_bill_date: null,
    billed_at: '2026-09-01',
  })
  const payment = (id: string, jobId: string, invoiceId: string | null, amount: number) => ({
    id,
    job_id: jobId,
    invoice_id: invoiceId,
    amount,
    paid_on: '2026-09-03',
  })
  const input = {
    jobs: [REAL, ZZ_BY_NAME],
    invoices: [invoice('i1', 'A', 500), invoice('iz', 'Z', 2200), invoice('ip', 'P', 75)],
    payments: [payment('p1', 'A', 'i1', 200), payment('pz', 'Z', 'iz', 100), payment('pp', 'P', null, 50)],
  }

  it('drops the ZZ job with its bills and payments, and keeps the real job’s', () => {
    const out = withoutZzTestJobMoney(input)
    expect(out.jobs.map((j) => j.id)).toEqual(['A'])
    expect(out.invoices.map((i) => i.id)).toEqual(['i1', 'ip'])
    expect(out.payments.map((p) => p.id)).toEqual(['p1', 'pp'])
    expect([...out.zzJobIds]).toEqual(['Z'])
  })

  it('drops the bills and payments of a ZZ job the rows do not carry, named by id', () => {
    const out = withoutZzTestJobMoney(input, ['P'])
    expect(out.invoices.map((i) => i.id)).toEqual(['i1'])
    expect(out.payments.map((p) => p.id)).toEqual(['p1'])
  })

  it('leaves bill truth with no orphan, where dropping the job alone leaves its bill as one', () => {
    const jobOnly = computeBillTruth({ jobs: [REAL], invoices: input.invoices.slice(0, 2), payments: input.payments.slice(0, 2) })
    expect(jobOnly.excludedOwed.count).toBe(1)
    const out = withoutZzTestJobMoney({ ...input, invoices: input.invoices.slice(0, 2), payments: input.payments.slice(0, 2) })
    const truth = computeBillTruth(out)
    expect(truth.excludedOwed).toEqual({ count: 0, total: 0 })
    expect(truth.billed.total).toBe(300)
  })

  it('hands every list back as it was when there is no ZZ job', () => {
    const plain = { jobs: [REAL], invoices: [input.invoices[0]!], payments: [input.payments[0]!] }
    const out = withoutZzTestJobMoney(plain)
    expect(out.jobs).toBe(plain.jobs)
    expect(out.invoices).toBe(plain.invoices)
    expect(out.payments).toBe(plain.payments)
  })
})

describe('withoutZzTestJobRows (v2.5120)', () => {
  type Bill = { id: string; job_id: string; job_name?: string; customer_name?: string | null }
  const bills: Bill[] = [
    { id: 'i1', job_id: 'A', job_name: '101 Hill Street', customer_name: 'Ann Lee' },
    { id: 'iz', job_id: 'Z', job_name: 'ZZ TEST billed', customer_name: 'Ann Lee' },
    { id: 'iy', job_id: 'Y', job_name: 'Hill Street remodel' },
  ]

  it('drops a row by its own ZZ name, and by the shared ids when it carries no customer name', () => {
    expect(withoutZzTestJobRows(bills, (b) => b.job_id, null).map((b) => b.id)).toEqual(['i1', 'iy'])
    expect(withoutZzTestJobRows(bills, (b) => b.job_id, new Set(['Y'])).map((b) => b.id)).toEqual(['i1'])
  })

  it('hands back the same array when nothing is dropped', () => {
    const plain = [bills[0]!]
    expect(withoutZzTestJobRows(plain, (b) => b.job_id, new Set(['Q']))).toBe(plain)
  })
})

describe('withoutZzTestJobMoney · reads with no job id on a payment (v2.5120)', () => {
  it('drops a payment with its bill when the read selected only the bill id', () => {
    const out = withoutZzTestJobMoney(
      {
        jobs: [{ id: 'A' }, { id: 'Z' }],
        invoices: [
          { id: 'i1', job_id: 'A' },
          { id: 'iz', job_id: 'Z' },
        ],
        payments: [
          { invoice_id: 'i1', amount: 200 },
          { invoice_id: 'iz', amount: 100 },
        ],
      },
      ['Z'],
    )
    expect(out.payments).toEqual([{ invoice_id: 'i1', amount: 200 }])
  })

  it('the AR card’s buckets fall by exactly the test money, with nothing excluded', () => {
    const job = (id: string, name: string, revenue: number) => ({
      id, job_name: name, customer_name: 'Ann Lee', status: 'billed', revenue, payments_made: 0, collections_at: null,
      hcp_number: id, click_number: null, customer_id: 'c1', gc_customer_id: null, job_address: '', last_work_date: null, pct_complete: 100,
    })
    const bill = (id: string, jobId: string, amount: number) => ({ id, job_id: jobId, amount, status: 'billed', billed_at: '2026-09-01', sequence_order: 1 })
    const read = {
      jobs: [job('A', '101 Hill Street', 500), job('Z', 'ZZ TEST billed', 2200)],
      invoices: [bill('i1', 'A', 500), bill('iz', 'Z', 2200)],
      payments: [] as Array<{ job_id: string }>,
    }
    const before = buildArBuckets(read.jobs as never, read.invoices as never, [])
    const kept = withoutZzTestJobMoney(read, [])
    const after = buildArBuckets(kept.jobs as never, kept.invoices as never, [])
    expect(before.ar.total - after.ar.total).toBe(2200)
    expect(after.ar.total).toBe(500)
  })
})

/**
 * v2.8281 (punch list #334, a fault found while building): the Bridge's left-out list hands every read a set of job
 * ids, and every read took any set to mean *hide the ZZ tests too*. So a dev who shows ZZ tests lost them all once the
 * list named one job. `jobIdsAlone` is a set that leaves out its own jobs and reads no name.
 */
describe('job ids alone', () => {
  const invoice = (id: string, jobId: string) => ({ id, job_id: jobId, amount: 100 })
  const payment = (id: string, jobId: string | null, invoiceId: string | null) => ({ id, job_id: jobId, invoice_id: invoiceId, amount: 40 })
  const LEFT_OUT = job('L', '40 Pine Road', 'Bo Diaz')
  const jobs = [REAL, ZZ_BY_NAME, ZZ_BY_CUSTOMER, LEFT_OUT]
  const money = {
    jobs,
    invoices: [invoice('ia', 'A'), invoice('iz', 'Z'), invoice('iy', 'Y'), invoice('il', 'L')],
    payments: [payment('pa', 'A', 'ia'), payment('pz', 'Z', 'iz'), payment('py', null, 'iy'), payment('pl', 'L', 'il'), payment('pl2', null, 'il')],
  }

  it('is a set of its ids, and is told apart from a plain set and from none', () => {
    const alone = jobIdsAlone(['L'])
    expect([...alone]).toEqual(['L'])
    expect(alone.has('L')).toBe(true)
    expect(alone.size).toBe(1)
    expect(leavesOutByIdAlone(alone)).toBe(true)
    expect(leavesOutByIdAlone(new Set(['L']))).toBe(false)
    expect(leavesOutByIdAlone(new Set())).toBe(false)
    expect(leavesOutByIdAlone(['L'])).toBe(false)
    expect(leavesOutByIdAlone(null)).toBe(false)
    expect(leavesOutByIdAlone(undefined)).toBe(false)
  })

  it('rows: the named job leaves by its id, and a ZZ job stays', () => {
    expect(withoutZzTestJobRows(jobs, (j) => j.id, jobIdsAlone(['L'])).map((j) => j.id)).toEqual(['A', 'Z', 'Y'])
    // The same ids as a plain set are a viewer who hides ZZ tests: the ZZ jobs leave by their names as well.
    expect(withoutZzTestJobRows(jobs, (j) => j.id, new Set(['L'])).map((j) => j.id)).toEqual(['A'])
  })

  it('rows: the same array when the ids name none of them', () => {
    expect(withoutZzTestJobRows(jobs, (j) => j.id, jobIdsAlone(['nobody']))).toBe(jobs)
  })

  it('money: the named job goes with its bills and payments, and a ZZ job keeps its own', () => {
    const kept = withoutZzTestJobMoney(money, jobIdsAlone(['L']))
    expect(kept.jobs.map((j) => j.id)).toEqual(['A', 'Z', 'Y'])
    expect(kept.invoices.map((i) => i.id)).toEqual(['ia', 'iz', 'iy'])
    expect(kept.payments.map((p) => p.id)).toEqual(['pa', 'pz', 'py'])
    expect([...kept.zzJobIds]).toEqual(['L'])
  })

  it('money: what stays is what a dev who shows ZZ tests reads with no list, less the named job alone', () => {
    const kept = withoutZzTestJobMoney(money, jobIdsAlone(['L']))
    expect(kept.jobs).toEqual(money.jobs.filter((j) => j.id !== 'L'))
    expect(kept.invoices).toEqual(money.invoices.filter((i) => i.job_id !== 'L'))
    expect(kept.payments).toEqual(money.payments.filter((p) => p.job_id !== 'L' && p.invoice_id !== 'il'))
  })

  it('money: a plain set reads as it always did, the ZZ jobs gone with the named one', () => {
    const kept = withoutZzTestJobMoney(money, new Set(['L']))
    expect(kept.jobs.map((j) => j.id)).toEqual(['A'])
    expect(kept.invoices.map((i) => i.id)).toEqual(['ia'])
    expect(kept.payments.map((p) => p.id)).toEqual(['pa'])
  })
})
