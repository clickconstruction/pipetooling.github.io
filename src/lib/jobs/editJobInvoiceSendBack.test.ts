import { describe, expect, it } from 'vitest'
import {
  billsAheadRemedyHint,
  paymentsAppliedToInvoice,
  sendBackBlockedByPayments,
  sendBackEligibleBilledInvoices,
} from './editJobInvoiceSendBack'

const pay = (invoice_id: string | null, amount: number) => ({ invoice_id, amount })
const inv = (id: string, status: string, amount: number) => ({ id, status, amount })

describe('payments linkage', () => {
  it('sums payments on the invoice and flags the block', () => {
    const payments = [pay('a', 6220), pay('a', 100), pay(null, 50), pay('b', 0)]
    expect(paymentsAppliedToInvoice('a', payments)).toBe(6320)
    expect(sendBackBlockedByPayments('a', payments)).toBe(true)
    // A zero-amount link does not block (matches the server's sum semantics).
    expect(sendBackBlockedByPayments('b', payments)).toBe(false)
    expect(sendBackBlockedByPayments('c', payments)).toBe(false)
  })
})

describe('sendBackEligibleBilledInvoices', () => {
  it('keeps unpaid billed rows only', () => {
    const invoices = [inv('paid', 'billed', 6220), inv('open', 'billed', 8900), inv('draft', 'ready_to_bill', 2680)]
    const payments = [pay('paid', 6220)]
    expect(sendBackEligibleBilledInvoices(invoices, payments).map((i) => i.id)).toEqual(['open'])
  })
})

describe('billsAheadRemedyHint', () => {
  it('names the single unpaid bill, totals several, and stays quiet otherwise', () => {
    const payments = [pay('paid', 6220)]
    expect(billsAheadRemedyHint([inv('paid', 'billed', 6220), inv('open', 'billed', 8900)], payments)).toBe(
      'Or send back the unpaid $8,900.00 bill below and rebill to match the field.',
    )
    expect(
      billsAheadRemedyHint([inv('open', 'billed', 8900), inv('open2', 'billed', 1100)], []),
    ).toBe('Or send back an unpaid bill below (2 unpaid · $10,000.00) and rebill to match the field.')
    expect(billsAheadRemedyHint([inv('paid', 'billed', 6220), inv('draft', 'ready_to_bill', 2680)], payments)).toBeNull()
  })
})
