import { describe, expect, it } from 'vitest'
import { invoiceNeedsStripeMemoBackfill, stripeBillLacksMemoOrFooter, stripeMemoBackfillKey, stripeMemoBackfillTargets, type StripeMemoInvoice } from './stripeMemoBackfill'

/** A sent Stripe bill with its memo and footer read back: nothing waits. */
const bill = (over: Partial<StripeMemoInvoice> = {}): StripeMemoInvoice => ({
  id: 'inv-1',
  status: 'billed',
  stripe_invoice_id: 'in_abc',
  hosted_invoice_url: 'https://pay.example.com/in_abc',
  stripe_invoice_memo: 'Rough-in, 14 Cedar Bend',
  stripe_invoice_footer: 'Thank you',
  ...over,
})

describe('stripeBillLacksMemoOrFooter', () => {
  it('a bill with both read back lacks nothing', () => {
    expect(stripeBillLacksMemoOrFooter(bill())).toBe(false)
  })

  it('a missing memo or a missing footer is enough, and blank counts as missing', () => {
    expect(stripeBillLacksMemoOrFooter(bill({ stripe_invoice_memo: null }))).toBe(true)
    expect(stripeBillLacksMemoOrFooter(bill({ stripe_invoice_footer: null }))).toBe(true)
    expect(stripeBillLacksMemoOrFooter(bill({ stripe_invoice_memo: '   ' }))).toBe(true)
    expect(stripeBillLacksMemoOrFooter(bill({ stripe_invoice_footer: '' }))).toBe(true)
  })

  it('a bill Stripe does not host has nothing to read back: no id, or no pay link', () => {
    expect(stripeBillLacksMemoOrFooter(bill({ stripe_invoice_id: null, stripe_invoice_memo: null }))).toBe(false)
    expect(stripeBillLacksMemoOrFooter(bill({ stripe_invoice_id: '  ', stripe_invoice_memo: null }))).toBe(false)
    expect(stripeBillLacksMemoOrFooter(bill({ hosted_invoice_url: null, stripe_invoice_memo: null }))).toBe(false)
    expect(stripeBillLacksMemoOrFooter(bill({ hosted_invoice_url: '', stripe_invoice_footer: null }))).toBe(false)
  })

  it('does not look at the status: the bill view’s close loop asks whatever it is', () => {
    expect(stripeBillLacksMemoOrFooter(bill({ status: 'ready_to_bill', stripe_invoice_memo: null }))).toBe(true)
    expect(stripeBillLacksMemoOrFooter(bill({ status: 'paid', stripe_invoice_footer: null }))).toBe(true)
  })

  it('no bill, nothing waits', () => {
    expect(stripeBillLacksMemoOrFooter(undefined)).toBe(false)
    expect(stripeBillLacksMemoOrFooter(null)).toBe(false)
  })
})

describe('invoiceNeedsStripeMemoBackfill', () => {
  it('only a sent bill is asked about on open', () => {
    expect(invoiceNeedsStripeMemoBackfill(bill({ stripe_invoice_memo: null }))).toBe(true)
    for (const status of ['ready_to_bill', 'paid', 'void', null]) {
      expect(invoiceNeedsStripeMemoBackfill(bill({ status, stripe_invoice_memo: null })), String(status)).toBe(false)
    }
  })

  it('a sent bill with both read back is left alone', () => {
    expect(invoiceNeedsStripeMemoBackfill(bill())).toBe(false)
  })
})

describe('stripeMemoBackfillTargets', () => {
  it('keeps the bills that wait, in the job’s own order', () => {
    const invoices = [bill({ id: 'inv-c', stripe_invoice_memo: null }), bill({ id: 'inv-a' }), bill({ id: 'inv-b', stripe_invoice_footer: null }), bill({ id: 'inv-d', status: 'ready_to_bill', stripe_invoice_memo: null })]
    expect(stripeMemoBackfillTargets(invoices).map((i) => i.id)).toEqual(['inv-c', 'inv-b'])
  })

  it('no bills, none wait', () => {
    expect(stripeMemoBackfillTargets(null)).toEqual([])
    expect(stripeMemoBackfillTargets(undefined)).toEqual([])
    expect(stripeMemoBackfillTargets([])).toEqual([])
  })
})

describe('stripeMemoBackfillKey', () => {
  it('names the job and the bills that wait, sorted, so their order in the job does not matter', () => {
    const a = bill({ id: 'inv-b', stripe_invoice_memo: null })
    const b = bill({ id: 'inv-a', stripe_invoice_footer: null })
    expect(stripeMemoBackfillKey('job-1', [a, b])).toBe('job-1::inv-a|inv-b')
    expect(stripeMemoBackfillKey('job-1', [b, a])).toBe('job-1::inv-a|inv-b')
  })

  it('is null when nothing waits, so a job re-read with its memos filled does not ask again', () => {
    expect(stripeMemoBackfillKey('job-1', [bill(), bill({ id: 'inv-2' })])).toBeNull()
    expect(stripeMemoBackfillKey('job-1', [])).toBeNull()
    expect(stripeMemoBackfillKey('job-1', null)).toBeNull()
  })

  it('is null with no job open', () => {
    expect(stripeMemoBackfillKey(null, [bill({ stripe_invoice_memo: null })])).toBeNull()
    expect(stripeMemoBackfillKey(undefined, [bill({ stripe_invoice_memo: null })])).toBeNull()
    expect(stripeMemoBackfillKey('', [bill({ stripe_invoice_memo: null })])).toBeNull()
  })

  it('changes when a bill stops waiting, and holds when a bill that does not wait changes', () => {
    const waiting = bill({ id: 'inv-a', stripe_invoice_memo: null })
    const both = stripeMemoBackfillKey('job-1', [waiting, bill({ id: 'inv-b', stripe_invoice_footer: null })])
    const one = stripeMemoBackfillKey('job-1', [waiting, bill({ id: 'inv-b' })])
    expect(both).not.toBe(one)
    expect(stripeMemoBackfillKey('job-1', [waiting, bill({ id: 'inv-b', stripe_invoice_memo: 'Other words' })])).toBe(one)
  })

  it('is the job’s own: the same bills on another job are another key', () => {
    const invoices = [bill({ stripe_invoice_memo: null })]
    expect(stripeMemoBackfillKey('job-1', invoices)).not.toBe(stripeMemoBackfillKey('job-2', invoices))
  })
})
