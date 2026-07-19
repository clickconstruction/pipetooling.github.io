import { describe, expect, it } from 'vitest'
import {
  billedUnpaidDollars,
  buildEditJobBillingBar,
  remainingToBillDollars,
  sumBillingPayments,
} from './editJobBillingBar'

const inv = (status: string, amount: number, id = 'i1') => ({ status, amount, id })
const pay = (amount: number, invoice_id: string | null = null) => ({ amount, invoice_id })

describe('sumBillingPayments', () => {
  it('sums amounts, tolerating null/non-finite', () => {
    expect(sumBillingPayments([pay(100), pay(50), { amount: null }])).toBe(150)
    expect(sumBillingPayments([])).toBe(0)
  })
})

describe('billedUnpaidDollars', () => {
  it('counts only billed invoices, net of payments applied to each', () => {
    const invoices = [inv('billed', 1000, 'a'), inv('ready_to_bill', 500, 'b')]
    expect(billedUnpaidDollars(invoices, [])).toBe(1000) // draft excluded
    expect(billedUnpaidDollars(invoices, [pay(400, 'a')])).toBe(600) // payment nets down the billed line
    expect(billedUnpaidDollars(invoices, [pay(400, 'b')])).toBe(1000) // payment on the draft doesn't touch billed
  })
  it('floors a billed line at zero when overpaid', () => {
    expect(billedUnpaidDollars([inv('billed', 300, 'a')], [pay(500, 'a')])).toBe(0)
  })
})

describe('remainingToBillDollars', () => {
  it('is total minus payments minus all allocated (draft + billed) invoices', () => {
    // total 1000, paid 100, draft 300, billed 200 → 1000 - 100 - 500 = 400
    const invoices = [inv('ready_to_bill', 300, 'a'), inv('billed', 200, 'b')]
    expect(remainingToBillDollars(1000, [pay(100)], invoices)).toBe(400)
  })
  it('floors at zero', () => {
    expect(remainingToBillDollars(100, [pay(200)], [])).toBe(0)
  })
})

describe('buildEditJobBillingBar', () => {
  it('the reported shape: $300 job, $240 billed unpaid, $0 paid', () => {
    const b = buildEditJobBillingBar({ total: 300, payments: [], invoices: [inv('billed', 240, 'a')] })
    expect(b.hasBar).toBe(true)
    expect(b.total).toBe(300)
    expect(b.paid).toBe(0)
    expect(b.billedUnpaid).toBeCloseTo(240)
    expect(b.billedFrac).toBeCloseTo(0.8, 2)
    expect(b.draft).toBe(0)
    expect(b.remaining).toBe(60) // 300 − 0 − 240
  })
  it('separates draft from billed; buckets tile the whole job total (unallocated payment)', () => {
    const b = buildEditJobBillingBar({
      total: 1000,
      payments: [pay(100)], // unallocated (no invoice_id) — money in, not against an invoice
      invoices: [inv('ready_to_bill', 400, 'a'), inv('billed', 300, 'b')],
    })
    expect(b.paid).toBe(100)
    expect(b.billedUnpaid).toBeCloseTo(300) // nothing applied to the billed line
    expect(b.draft).toBe(400)
    expect(b.remaining).toBe(200) // 1000 − 100 − (400+300)
    expect(b.paidFrac).toBeCloseTo(0.1)
    expect(b.billedFrac).toBeCloseTo(0.3)
    expect(b.draftFrac).toBeCloseTo(0.4)
    // paid + billed + draft + remaining = job total
    expect(b.paid + b.billedUnpaid + b.draft + b.remaining).toBe(1000)
  })
  it('a payment applied to a billed invoice nets its blue segment down', () => {
    const b = buildEditJobBillingBar({
      total: 1000,
      payments: [pay(100, 'b')],
      invoices: [inv('billed', 300, 'b')],
    })
    expect(b.paid).toBe(100)
    expect(b.billedUnpaid).toBeCloseTo(200) // 300 billed − 100 paid on it
  })
  it('no line items → no bar', () => {
    const b = buildEditJobBillingBar({ total: 0, payments: [], invoices: [] })
    expect(b.hasBar).toBe(false)
    expect(b.paidFrac).toBe(0)
  })
})
