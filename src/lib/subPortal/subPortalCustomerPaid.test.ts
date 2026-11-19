import { describe, expect, it } from 'vitest'
// Deno edge module (supabase/functions/_shared), dependency-free, tested here.
import { attachCustomerPaid, customerPaidDays, customerPaidOn, type TiedBillPaymentRow, type TiedBillRow } from '../../../supabase/functions/_shared/subPortalCustomerPaid'

// Made-up bills and payments on a made-up job.
const BILLED: TiedBillRow = { id: 'bill-open', status: 'billed' }
const PAID: TiedBillRow = { id: 'bill-paid', status: 'paid' }
const DRAFT: TiedBillRow = { id: 'bill-draft', status: 'ready_to_bill' }
const bills = [BILLED, PAID, DRAFT]

const pay = (invoice_id: string | null, paid_on: string | null): TiedBillPaymentRow => ({ invoice_id, paid_on })
const payments = [pay('bill-paid', '2026-11-03'), pay('bill-paid', '2026-11-12'), pay('bill-open', '2026-11-14'), pay(null, '2026-11-20')]

const at = (drawInvoiceId: string | null, stage: string | null = 'customer_pay') => customerPaidOn({ stage, drawInvoiceId, bills, payments })

describe('the day the customer paid the sheet’s tied bill', () => {
  it('is the day the last of the money came in on a bill paid in full', () => {
    expect(at('bill-paid')).toBe('2026-11-12')
  })

  it('says nothing for a part payment: the bill is still open', () => {
    expect(at('bill-open')).toBeNull()
  })

  it('says nothing for a bill that was never sent', () => {
    expect(at('bill-draft')).toBeNull()
  })

  it('says nothing for a sheet with no tie, whatever was paid on the job', () => {
    expect(at(null)).toBeNull()
    expect(at('')).toBeNull()
    expect(at('   ')).toBeNull()
  })

  it('says nothing off Waiting on customer, even with a tie to a paid bill', () => {
    expect(at('bill-paid', 'walkthrough')).toBeNull()
    expect(at('bill-paid', 'working')).toBeNull()
    expect(at('bill-paid', null)).toBeNull()
  })

  it('says nothing when the tied bill is not among the bills read', () => {
    expect(at('bill-gone')).toBeNull()
  })

  it('never guesses a day: a paid bill with no dated payment says nothing', () => {
    expect(customerPaidOn({ stage: 'customer_pay', drawInvoiceId: 'bill-paid', bills, payments: [] })).toBeNull()
    expect(customerPaidOn({ stage: 'customer_pay', drawInvoiceId: 'bill-paid', bills, payments: [pay('bill-paid', null), pay('bill-paid', 'soon')] })).toBeNull()
  })

  it('reads the day off a longer stamp, and never takes another bill’s payment', () => {
    expect(customerPaidOn({ stage: 'customer_pay', drawInvoiceId: 'bill-paid', bills, payments: [pay('bill-paid', '2026-11-09T00:00:00Z'), pay('bill-open', '2026-12-01')] })).toBe('2026-11-09')
  })
})

describe('every sheet’s paid day', () => {
  it('keeps only the sheets the page may say paid for', () => {
    const sheets = [
      { id: 's-paid', stage: 'customer_pay', draw_invoice_id: 'bill-paid' },
      { id: 's-open', stage: 'customer_pay', draw_invoice_id: 'bill-open' },
      { id: 's-none', stage: 'customer_pay', draw_invoice_id: null },
      { id: 's-early', stage: 'walkthrough', draw_invoice_id: 'bill-paid' },
      { id: 's-before-the-column', stage: 'customer_pay' },
    ]
    expect([...customerPaidDays(sheets, bills, payments)]).toEqual([['s-paid', '2026-11-12']])
  })
})

describe('the payload’s sheets', () => {
  it('carry the day where there is one, and come back untouched where there is none', () => {
    const a = { id: 's-paid', open: 3000 }
    const b = { id: 's-open', open: 900 }
    const out = attachCustomerPaid([a, b], new Map([['s-paid', '2026-11-12']]))
    expect(out).toEqual([{ id: 's-paid', open: 3000, customerPaidOn: '2026-11-12' }, { id: 's-open', open: 900 }])
    expect(out[1]).toBe(b)
    expect('customerPaidOn' in out[1]!).toBe(false)
  })
})
