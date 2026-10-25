import { describe, expect, it } from 'vitest'
import { buildLienSupplierJobs, type LienSupplierUnpaidInvoice } from './lienJobSuppliers'
import { supplierPaidButtonWords, supplierPaidDraftProblem, supplierPaidInvoiceWords, supplierPaidPicked, supplierPaidSavedWords, supplierPaidSplitWarning } from './lienSupplierPaid'

const TODAY = '2026-10-25'
const inv = (over: Partial<LienSupplierUnpaidInvoice>): LienSupplierUnpaidInvoice => ({ id: 'i', invoiceNumber: '48812', invoiceDate: '2026-07-14', amount: 4_120, allocated: 4_120, onJobAccount: false, ...over })

describe('the house carries its unpaid invoices (v2.5838)', () => {
  it('lists them oldest first with the job’s slice, and leaves paid ones out', () => {
    const byJob = buildLienSupplierJobs({
      invoices: [
        { id: 'b', supply_house_id: 'h', amount: 1_000, is_paid: false, invoice_date: '2026-08-02', paidYmd: null, on_job_account: true, invoice_number: 'B-2' },
        { id: 'a', supply_house_id: 'h', amount: 4_120, is_paid: false, invoice_date: '2026-07-14', paidYmd: null, on_job_account: false, invoice_number: '48812' },
        { id: 'p', supply_house_id: 'h', amount: 300, is_paid: true, invoice_date: '2026-07-01', paidYmd: '2026-07-20', on_job_account: false },
      ],
      allocations: [{ invoice_id: 'a', job_id: 'j', pct: 50 }, { invoice_id: 'b', job_id: 'j', pct: 100 }, { invoice_id: 'p', job_id: 'j', pct: 100 }],
      houses: [{ id: 'h', name: 'Reece' }],
    })
    const house = byJob.get('j')!.houses[0]!
    expect(house.unpaidInvoices).toEqual([
      { id: 'a', invoiceNumber: '48812', invoiceDate: '2026-07-14', amount: 4_120, allocated: 2_060, onJobAccount: false },
      { id: 'b', invoiceNumber: 'B-2', invoiceDate: '2026-08-02', amount: 1_000, allocated: 1_000, onJobAccount: true },
    ])
    expect(house.owed).toBe(3_060)
  })
})

describe('the Mark paid form’s rules and words', () => {
  const list = [inv({ id: 'a', allocated: 2_060 }), inv({ id: 'b', invoiceNumber: 'B-2', invoiceDate: '2026-08-02', amount: 1_000, allocated: 1_000, onJobAccount: true })]
  it('refuses no day, a day ahead, and nothing ticked', () => {
    expect(supplierPaidDraftProblem({ paidOn: '', invoiceIds: ['a'] }, TODAY)).toBe('Pick the day it was paid.')
    expect(supplierPaidDraftProblem({ paidOn: '2026-10-26', invoiceIds: ['a'] }, TODAY)).toMatch(/ahead of today/)
    expect(supplierPaidDraftProblem({ paidOn: '2026-10-22', invoiceIds: [] }, TODAY)).toBe('Tick at least one invoice.')
    expect(supplierPaidDraftProblem({ paidOn: '2026-10-22', invoiceIds: ['a'] }, TODAY)).toBeNull()
  })
  it('names the ticked invoices and sums the whole invoices on the button', () => {
    const picked = supplierPaidPicked(list, { paidOn: TODAY, invoiceIds: ['b', 'a'] })
    expect(picked.map((i) => i.id)).toEqual(['a', 'b'])
    expect(supplierPaidButtonWords(picked)).toBe('Mark 2 invoices paid · $5,120')
    expect(supplierPaidButtonWords([list[1]!])).toBe('Mark 1 invoice paid · $1,000')
    expect(supplierPaidButtonWords([])).toBe('Mark paid')
  })
  it('words each invoice line, warns when a ticked invoice is split across jobs, and words the toast', () => {
    expect(supplierPaidInvoiceWords(list[0]!)).toBe('#48812 · Jul 14 · $4,120 (this job $2,060)')
    expect(supplierPaidInvoiceWords(list[1]!)).toBe('#B-2 · Aug 2 · $1,000 · job account')
    expect(supplierPaidInvoiceWords(inv({ invoiceNumber: '', invoiceDate: '' }))).toBe('no number · $4,120')
    expect(supplierPaidSplitWarning([list[1]!])).toBe('')
    expect(supplierPaidSplitWarning(list)).toBe('One invoice is split across jobs: marking it paid marks the whole invoice paid, on every job it is on.')
    expect(supplierPaidSavedWords('Reece', 2)).toBe('Marked 2 invoices from Reece paid. The Liens window and Held for suppliers read it too.')
  })
})
