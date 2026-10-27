import { describe, expect, it, vi } from 'vitest'
import {
  applyInvoicePlanRows,
  applyPaymentPlanRows,
  invoiceApplyLabel,
  paymentApplyLabel,
  reconcileApplyWords,
  type InvoiceApplyIo,
  type PaymentApplyIo,
} from './hcpReconcileApply'
import type { InvoiceReconcilePlan, PaymentReconcilePlan } from './hcpReconcile'
import { plainWordsFailures } from '../plainWords'

const refused = { message: 'new row violates row-level security policy', code: '42501' }

function invoicePlan(over: Partial<InvoiceReconcilePlan> = {}): InvoiceReconcilePlan {
  return {
    creates: [
      { jobId: 'j1', jobNumber: '1001', invoiceNo: 'A1', sentAtIso: '2026-08-01T12:00:00Z', amount: 500, linkPaymentIds: ['p1', 'p2'] },
      { jobId: 'j2', jobNumber: '1002', invoiceNo: 'A2', sentAtIso: '2026-08-02T12:00:00Z', amount: 300, linkPaymentIds: [] },
    ],
    stamps: [{ invoiceId: 'i3', jobNumber: '1003', sentAtIso: '2026-08-03T12:00:00Z' }],
    links: [
      { paymentId: 'p4', invoiceId: 'i4', jobNumber: '1004' },
      { paymentId: 'p5', invoiceId: 'i5', jobNumber: '1005' },
    ],
    skips: [{ key: 'k', reason: 'Already reconciled', count: 2 }],
    exportRows: 9,
    ...over,
  }
}

function okInvoiceIo(): InvoiceApplyIo {
  return {
    createInvoice: vi.fn(async (c) => `new-${c.jobId}`),
    linkPayments: vi.fn(async () => {}),
    stampBillDate: vi.fn(async () => {}),
    linkPayment: vi.fn(async () => {}),
  }
}

describe('the Apply labels say the count and what it is made of (punch list #184)', () => {
  it('lane 1: invoices, dates, links', () => {
    const plan = {
      creates: Array.from({ length: 3 }, () => invoicePlan().creates[0]!),
      stamps: Array.from({ length: 5 }, () => invoicePlan().stamps[0]!),
      links: Array.from({ length: 4 }, () => invoicePlan().links[0]!),
    }
    expect(invoiceApplyLabel(plan)).toBe('Apply 12 · 3 invoices, 5 dates, 4 links')
    expect(invoiceApplyLabel({ ...plan, creates: [plan.creates[0]!], stamps: [] })).toBe('Apply 5 · 1 invoice, 4 links')
    expect(invoiceApplyLabel({ creates: [], stamps: [], links: plan.links })).toBe('Apply 4 links')
    expect(invoiceApplyLabel({ creates: [], stamps: [], links: [] })).toBe('Apply')
  })
  it('lane 2: dates, splits', () => {
    const c = { paymentId: 'p', jobNumber: '1', amount: 1, fromYmd: null, toYmd: '2026-08-01', newNote: '' }
    const s = { deletePaymentId: 'r', jobId: 'j', jobNumber: '1', rollupAmount: 2, inserts: [] }
    expect(paymentApplyLabel({ corrections: Array.from({ length: 7 }, () => c), splits: [s, s] })).toBe('Apply 9 · 7 dates, 2 splits')
    expect(paymentApplyLabel({ corrections: [], splits: [s] })).toBe('Apply 1 split')
  })
})

describe('applyInvoicePlanRows — past a failure, with what is left', () => {
  it('every row applies: nothing failed, nothing left', async () => {
    const io = okInvoiceIo()
    const progress: number[] = []
    const out = await applyInvoicePlanRows(invoicePlan(), io, (n) => progress.push(n))
    expect(out).toMatchObject({ done: 5, total: 5, failures: [] })
    expect(out.remaining.creates.length + out.remaining.stamps.length + out.remaining.links.length).toBe(0)
    expect(io.linkPayments).toHaveBeenCalledWith(['p1', 'p2'], 'new-j1')
    expect(progress).toEqual([1, 2, 3, 4, 5])
  })
  it('a refused row does not stop the rest, and comes back with its reason', async () => {
    const io = okInvoiceIo()
    io.stampBillDate = vi.fn(async () => {
      throw refused
    })
    io.linkPayment = vi.fn(async (l) => {
      if (l.paymentId === 'p4') throw new Error('timeout')
    })
    const out = await applyInvoicePlanRows(invoicePlan(), io)
    expect(out.done).toBe(3)
    expect(out.failures.map((f) => f.what)).toEqual(['Job 1003 · bill date', 'Job 1004 · payment link'])
    expect(out.failures[0]!.why).toContain('Could not stamp the bill date')
    expect(out.failures[1]!.why).toBe('timeout')
    // The later link still ran.
    expect(io.linkPayment).toHaveBeenCalledTimes(2)
    expect(out.remaining.stamps).toEqual([invoicePlan().stamps[0]])
    expect(out.remaining.links).toEqual([invoicePlan().links[0]])
    expect(out.remaining.creates).toEqual([])
    // The skips stay with the plan.
    expect(out.remaining.skips).toEqual(invoicePlan().skips)
    expect(invoiceApplyLabel(out.remaining)).toBe('Apply 2 · 1 date, 1 link')
  })
  it('an invoice made whose links failed comes back as the links alone, never a second invoice', async () => {
    const io = okInvoiceIo()
    io.linkPayments = vi.fn(async () => {
      throw new Error('links refused')
    })
    const out = await applyInvoicePlanRows(invoicePlan({ stamps: [], links: [] }), io)
    expect(out.done).toBe(1)
    expect(out.failures).toEqual([{ key: 'create:j1', what: 'Job 1001 · invoice #A1 made, 2 payments not linked', why: 'links refused' }])
    expect(out.remaining.creates).toEqual([])
    expect(out.remaining.links).toEqual([
      { paymentId: 'p1', invoiceId: 'new-j1', jobNumber: '1001' },
      { paymentId: 'p2', invoiceId: 'new-j1', jobNumber: '1001' },
    ])
  })
  it('an invoice that could not be made comes back whole', async () => {
    const io = okInvoiceIo()
    io.createInvoice = vi.fn(async (c) => {
      if (c.jobId === 'j1') throw refused
      return `new-${c.jobId}`
    })
    const out = await applyInvoicePlanRows(invoicePlan({ stamps: [], links: [] }), io)
    expect(out.done).toBe(1)
    expect(out.remaining.creates.map((c) => c.jobId)).toEqual(['j1'])
    expect(io.linkPayments).not.toHaveBeenCalled()
  })
})

describe('applyPaymentPlanRows — past a failure, never inserting a split twice', () => {
  const plan: PaymentReconcilePlan = {
    corrections: [
      { paymentId: 'c1', jobNumber: '2001', amount: 1200, fromYmd: '2026-07-01', toYmd: '2026-07-09', newNote: 'n' },
      { paymentId: 'c2', jobNumber: '2002', amount: 80, fromYmd: null, toYmd: '2026-07-10', newNote: 'n' },
    ],
    splits: [{ deletePaymentId: 'r1', jobId: 'j3', jobNumber: '2003', rollupAmount: 900, inserts: [{ amount: 400, paidYmd: '2026-07-01', paymentType: 'check', invoiceId: null, sequenceOrder: 0 }, { amount: 500, paidYmd: '2026-07-05', paymentType: 'check', invoiceId: null, sequenceOrder: 1 }] }],
    skips: [],
    exportRows: 4,
    resolvedRows: 4,
  }
  function okIo(): PaymentApplyIo {
    return { correctDate: vi.fn(async () => {}), insertSplit: vi.fn(async () => {}), removeRollup: vi.fn(async () => {}) }
  }
  it('a failed date does not stop the split', async () => {
    const io = okIo()
    io.correctDate = vi.fn(async (c) => {
      if (c.paymentId === 'c1') throw refused
    })
    const out = await applyPaymentPlanRows(plan, io)
    expect(out.done).toBe(2)
    expect(out.failures.map((f) => f.what)).toEqual(['Job 2001 · $1,200.00 paid 2026-07-01 to 2026-07-09'])
    expect(io.removeRollup).toHaveBeenCalledTimes(1)
    expect(paymentApplyLabel(out.remaining)).toBe('Apply 1 date')
  })
  it('a split whose rollup was not removed comes back as the removal alone', async () => {
    const io = okIo()
    io.removeRollup = vi.fn(async () => {
      throw new Error('delete refused')
    })
    const out = await applyPaymentPlanRows({ ...plan, corrections: [] }, io)
    expect(out.failures).toEqual([{ key: 'split:r1', what: 'Job 2003 · split of $900.00 made, the rollup not removed', why: 'delete refused' }])
    expect(out.remaining.splits).toEqual([{ ...plan.splits[0], inserts: [] }])
    // The retry removes the rollup and inserts nothing.
    const retryIo = okIo()
    const retry = await applyPaymentPlanRows(out.remaining, retryIo)
    expect(retryIo.insertSplit).not.toHaveBeenCalled()
    expect(retryIo.removeRollup).toHaveBeenCalledTimes(1)
    expect(retry).toMatchObject({ done: 1, failures: [] })
  })
  it('a split whose rows did not go in comes back whole and removes nothing', async () => {
    const io = okIo()
    io.insertSplit = vi.fn(async () => {
      throw new Error('insert refused')
    })
    const out = await applyPaymentPlanRows({ ...plan, corrections: [] }, io)
    expect(io.removeRollup).not.toHaveBeenCalled()
    expect(out.remaining.splits).toEqual(plan.splits)
  })
})

describe('reconcileApplyWords', () => {
  it('says what applied and what did not, in plain words', () => {
    const w = reconcileApplyWords(9, 3)
    expect(w).toEqual({ line: 'Applied 9 changes. 3 did not apply.', head: '3 changes did not apply. They stay here with the reason.', tone: 'warning' })
    expect(plainWordsFailures(w.line)).toEqual([])
    expect(plainWordsFailures(w.head ?? '')).toEqual([])
  })
})
