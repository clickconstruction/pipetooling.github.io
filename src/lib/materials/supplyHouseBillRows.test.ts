import { describe, expect, it } from 'vitest'
import type { SupplyPayment, SupplyPaymentLine } from './payments/supplyPayment'
import {
  allocationJobLabel,
  houseOnAccountTotal,
  jobsLedgerNames,
  jobsLedgerNamesWithAddress,
  paymentWindowBills,
  recordPaymentBills,
  supplyBillCardRows,
  supplyBillsToList,
  supplyPhoneBills,
  typedPaidBillIds,
  type SupplyBillSource,
} from './supplyHouseBillRows'

// Made-up bills, jobs and payments.
const bill = (id: string, over: Partial<SupplyBillSource> = {}): SupplyBillSource => ({
  id,
  invoice_number: `S-${id}`,
  purchase_order_number: null,
  invoice_date: '2026-03-01',
  due_date: '2026-03-31',
  amount: 100,
  is_paid: false,
  paid_at: null,
  link: null,
  payment_link: null,
  on_job_account: false,
  job_allocations: [],
  ...over,
})
const payment = (id: string, over: Partial<SupplyPayment> = {}): SupplyPayment =>
  ({ id, supply_house_id: 'h1', paid_on: '2026-03-10', amount: 100, method: 'ach', method_ref: '88213', receipt_link: null, source: 'typed', removed_at: null, ...over }) as SupplyPayment
const line = (payment_id: string, invoice_id: string, amount: number): SupplyPaymentLine => ({ id: `${payment_id}-${invoice_id}`, payment_id, invoice_id, amount }) as SupplyPaymentLine
const jobs = { j1: { hcp_number: '1017', click_number: '', job_name: 'Elm Street' }, j2: { hcp_number: '', click_number: '988', job_name: 'Oak Court' } }
const none = { payments: [], lines: [] }
const rowsOf = (shown: SupplyBillSource[], over: Partial<Parameters<typeof supplyBillCardRows>[0]> = {}) =>
  supplyBillCardRows({ shown, all: shown, payments: none, jobs, ledgerCodes: null, papers: new Map(), paperNames: new Map(), ...over })

describe('allocationJobLabel', () => {
  it('names a job by its number and name, the Click number when there is no other', () => {
    expect(allocationJobLabel('j1', jobs)).toBe('1017 · Elm Street')
    expect(allocationJobLabel('j2', jobs)).toBe('988 · Oak Court')
  })

  it('falls back to the start of the id while the name has not read', () => {
    expect(allocationJobLabel('0a1b2c3d-ffff-ffff', jobs)).toBe('0a1b2c3d')
  })
})

describe('supplyBillsToList', () => {
  const all = [bill('a'), bill('b', { is_paid: true }), bill('c', { is_paid: true })]

  it('lists the unpaid bills, and a bill marked paid on this visit stays where it was', () => {
    expect(supplyBillsToList(all, false, new Set(['c'])).map((b) => b.id)).toEqual(['a', 'c'])
  })

  it('lists every bill with Show paid on', () => {
    expect(supplyBillsToList(all, true, new Set())).toBe(all)
  })
})

describe('supplyBillCardRows', () => {
  it('lists a part-paid bill for what is left on it, and says what was paid', () => {
    const [row] = rowsOf([bill('a', { amount: 812.4 })], { payments: { payments: [payment('p1', { amount: 300 })], lines: [line('p1', 'a', 300)] } })
    expect(row?.amount).toBe(512.4)
    expect(row?.partPaid).toBe('$300.00 paid · $512.40 left of $812.40')
    expect(row?.paidBy).toBe('')
    expect(row?.seePayment).toBe(false)
  })

  it('keeps a paid bill at its own amount, and a typed payment turns Mark unpaid into See the payment', () => {
    const [row] = rowsOf([bill('a', { is_paid: true, paid_at: '2026-03-10T18:00:00Z' })], { payments: { payments: [payment('p1')], lines: [line('p1', 'a', 100)] } })
    expect(row?.amount).toBe(100)
    expect(row?.partPaid).toBe('')
    expect(row?.paidYmd).toBe('2026-03-10')
    expect(row?.seePayment).toBe(true)
    expect(row?.needsHow).toBe(false)
    expect(row?.paidBy).toContain('88213')
  })

  it('a bill nothing is on reads as it was typed', () => {
    const [row] = rowsOf([bill('a')])
    expect(row).toMatchObject({ amount: 100, partPaid: '', paidYmd: null, seePayment: false, needsHow: false, payment_link: null, pairLine: null })
  })

  it("shows the bill's own receipt link first, and the payment's when the bill has none", () => {
    const pays = { payments: [payment('p1', { receipt_link: 'https://example.test/receipt' })], lines: [line('p1', 'a', 100), line('p1', 'b', 100)] }
    const [own, fromPayment] = rowsOf([bill('a', { is_paid: true, payment_link: 'https://example.test/by-hand' }), bill('b', { is_paid: true })], { payments: pays })
    expect(own?.payment_link).toBe('https://example.test/by-hand')
    expect(fromPayment?.payment_link).toBe('https://example.test/receipt')
  })

  it('warns on a PO code the ledger does not hold, and never when the ledger did not read', () => {
    const shown = [bill('a', { purchase_order_number: '10410' }), bill('b', { purchase_order_number: 'PO 10420' }), bill('c', { purchase_order_number: 'the Elm job' })]
    expect(rowsOf(shown, { ledgerCodes: new Set([10410]) }).map((r) => r.poMismatch)).toEqual([false, true, false])
    expect(rowsOf(shown, { ledgerCodes: null }).map((r) => r.poMismatch)).toEqual([false, false, false])
  })

  it('names the jobs a bill is put to, with their shares', () => {
    const [row] = rowsOf([bill('a', { job_allocations: [{ job_id: 'j1', pct: 60 }, { job_id: 'j2', pct: 40 }] })])
    expect(row?.jobs).toEqual([{ label: '1017 · Elm Street', pct: 60 }, { label: '988 · Oak Court', pct: 40 }])
  })

  it('reads a credit and its bill against every bill of the house, the ones not listed too', () => {
    const invoice = bill('a', { is_paid: true })
    const credit = bill('b', { amount: -20, document_kind: 'credit', credits_invoice_id: 'a' })
    const [row] = rowsOf([credit], { all: [invoice, credit] })
    expect(row?.pairLine).toBe('Credits S-a')
  })

  it('titles interest by the bill that ran late', () => {
    const late = bill('a')
    const interest = bill('b', { is_interest: true, late_invoice_id: 'a' })
    expect(rowsOf([late, interest]).map((r) => r.interest)).toEqual([null, 'Interest on S-a'])
  })

  it('says No lines yet for a bill with no paper, and offers no Look', () => {
    const [row] = rowsOf([bill('a')])
    expect(row?.lines.look).toBe(false)
    expect(row?.lines.tone).toBe('none')
  })
})

describe('supplyPhoneBills', () => {
  it('changes only an unpaid bill a payment has taken part of', () => {
    const a = bill('a', { amount: 812.4 })
    const b = bill('b')
    const c = bill('c', { is_paid: true })
    const out = supplyPhoneBills([a, b, c], { payments: [payment('p1', { amount: 400 })], lines: [line('p1', 'a', 300), line('p1', 'c', 100)] })
    expect(out[0]).toMatchObject({ amount: 512.4, partPaid: '$300.00 paid · $512.40 left of $812.40' })
    expect(out[1]).toBe(b)
    expect(out[2]).toBe(c)
  })
})

describe('typedPaidBillIds', () => {
  it('holds the paid bills a typed payment stands behind, and no unpaid one', () => {
    const ids = typedPaidBillIds([bill('a', { is_paid: true }), bill('b', { is_paid: true }), bill('c')], { payments: [payment('p1', { amount: 150 })], lines: [line('p1', 'a', 100), line('p1', 'c', 50)] })
    expect([...ids]).toEqual(['a'])
  })

  it('a removed payment stands behind nothing', () => {
    const ids = typedPaidBillIds([bill('a', { is_paid: true })], { payments: [payment('p1', { removed_at: '2026-03-11T00:00:00Z' })], lines: [line('p1', 'a', 100)] })
    expect(ids.size).toBe(0)
  })
})

describe('houseOnAccountTotal', () => {
  it('adds what each payment sent past its bills', () => {
    const pays = { payments: [payment('p1', { amount: 500 }), payment('p2', { amount: 100 }), payment('p3', { amount: 70 })], lines: [line('p1', 'a', 300), line('p2', 'b', 100), line('p3', 'c', 50)] }
    expect(houseOnAccountTotal(pays)).toBe(220)
  })

  it('is zero with no payments', () => {
    expect(houseOnAccountTotal(none)).toBe(0)
  })
})

describe('the payment windows’ bills', () => {
  const late = bill('a', { job_allocations: [{ job_id: 'j1', pct: 100 }] })
  const interest = bill('b', { is_interest: true, late_invoice_id: 'a' })
  const byPo = bill('c', { purchase_order_number: ' the Elm job ' })
  const bare = bill('d')
  const all = [late, interest, byPo, bare]

  it('Record a payment titles a bill by its interest words, its jobs, its PO, then that it has no job', () => {
    expect(recordPaymentBills(all, jobs).map((b) => b.title)).toEqual(['1017 · Elm Street', 'Interest on S-a', 'the Elm job', 'No job on this bill'])
    expect(recordPaymentBills(all, jobs)[1]).toMatchObject({ id: 'b', invoice_number: 'S-b', due_date: '2026-03-31', amount: 100, is_paid: false, is_interest: true })
  })

  it("a payment's own window leaves the title empty for a bill on no job", () => {
    expect(paymentWindowBills(all, jobs).map((b) => b.title)).toEqual(['1017 · Elm Street', 'Interest on S-a', '', ''])
  })
})

describe('jobsLedgerNames', () => {
  const rows = [{ id: 'j1', hcp_number: '1017', click_number: null, job_name: 'Elm Street', job_address: '1 Elm St' }, { id: 'j2', hcp_number: null, click_number: '988', job_name: null }]

  it('keys the jobs by id, every missing word an empty string', () => {
    expect(jobsLedgerNames(rows)).toEqual({ j1: { hcp_number: '1017', click_number: '', job_name: 'Elm Street' }, j2: { hcp_number: '', click_number: '988', job_name: '' } })
  })

  it('carries the address for the invoice form\'s job cards', () => {
    expect(jobsLedgerNamesWithAddress(rows)).toEqual({
      j1: { hcp_number: '1017', click_number: '', job_name: 'Elm Street', job_address: '1 Elm St' },
      j2: { hcp_number: '', click_number: '988', job_name: '', job_address: '' },
    })
  })

  it('the names feed the job label', () => {
    expect(allocationJobLabel('j2', jobsLedgerNames(rows))).toBe('988 · ')
  })
})
