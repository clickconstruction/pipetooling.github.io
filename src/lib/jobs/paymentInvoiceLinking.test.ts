import { describe, expect, it } from 'vitest'
import {
  autoApplyInvoiceId,
  invoiceRecordsThroughStripe,
  openStripeBills,
  paymentDateBeforeBilled,
  paymentRowNeedsInvoiceLink,
} from './paymentInvoiceLinking'

const inv = (id: string, status = 'billed', billed_at: string | null = null, estimated_bill_date: string | null = null) => ({
  id,
  status,
  billed_at,
  estimated_bill_date,
})

describe('autoApplyInvoiceId', () => {
  it('defaults to the single billed invoice', () => {
    expect(autoApplyInvoiceId([inv('a'), inv('rtb', 'ready_to_bill'), inv('paid', 'paid')])).toBe('a')
  })

  it('stays null when the choice is ambiguous or absent', () => {
    expect(autoApplyInvoiceId([inv('a'), inv('b')])).toBeNull()
    expect(autoApplyInvoiceId([inv('paid', 'paid')])).toBeNull()
    expect(autoApplyInvoiceId([])).toBeNull()
    expect(autoApplyInvoiceId(null)).toBeNull()
  })

  // v2.3692 — job 1022: the only open bill was a Stripe bill, so the first
  // keystroke attached the row to it and the table drew the row read-only.
  it('never defaults to a Stripe bill, even when it is the only open bill', () => {
    expect(autoApplyInvoiceId([{ ...inv('s'), stripe_invoice_id: 'in_123' }])).toBeNull()
    expect(autoApplyInvoiceId([{ ...inv('s'), external_send_channel: 'stripe' }])).toBeNull()
  })

  it('skips Stripe bills when picking the single hand-typed bill', () => {
    expect(autoApplyInvoiceId([{ ...inv('s'), stripe_invoice_id: 'in_123' }, inv('a')])).toBe('a')
  })
})

describe('invoiceRecordsThroughStripe / openStripeBills', () => {
  it('reads either Stripe marker and ignores blanks', () => {
    expect(invoiceRecordsThroughStripe({ stripe_invoice_id: 'in_1', external_send_channel: null })).toBe(true)
    expect(invoiceRecordsThroughStripe({ stripe_invoice_id: null, external_send_channel: 'stripe' })).toBe(true)
    expect(invoiceRecordsThroughStripe({ stripe_invoice_id: '  ', external_send_channel: 'email' })).toBe(false)
    expect(invoiceRecordsThroughStripe({})).toBe(false)
  })

  it('lists only the open Stripe bills, keeping the caller\'s row type', () => {
    const rows = [
      { ...inv('s'), stripe_invoice_id: 'in_1', amount: 1500 },
      { ...inv('s-paid', 'paid'), stripe_invoice_id: 'in_2', amount: 900 },
      { ...inv('a'), amount: 400 },
    ]
    expect(openStripeBills(rows).map((r) => [r.id, r.amount])).toEqual([['s', 1500]])
    expect(openStripeBills(null)).toEqual([])
  })
})

describe('paymentRowNeedsInvoiceLink', () => {
  const invoices = [inv('a'), inv('b')]

  it('flags a positive unlinked payment when open bills exist', () => {
    expect(paymentRowNeedsInvoiceLink({ amount: 100, invoice_id: null }, invoices)).toBe(true)
  })

  it('does not flag linked rows, zero rows, or jobs with nothing to link', () => {
    expect(paymentRowNeedsInvoiceLink({ amount: 100, invoice_id: 'a' }, invoices)).toBe(false)
    expect(paymentRowNeedsInvoiceLink({ amount: 0, invoice_id: null }, invoices)).toBe(false)
    expect(paymentRowNeedsInvoiceLink({ amount: '', invoice_id: null }, invoices)).toBe(false)
    expect(paymentRowNeedsInvoiceLink({ amount: 100, invoice_id: null }, [inv('paid', 'paid')])).toBe(false)
    expect(paymentRowNeedsInvoiceLink({ amount: 100, invoice_id: null }, null)).toBe(false)
  })

  it('does not flag when the only open bills are Stripe bills (the hand-off note covers those)', () => {
    expect(paymentRowNeedsInvoiceLink({ amount: 100, invoice_id: null }, [{ ...inv('s'), external_send_channel: 'stripe' }])).toBe(false)
    expect(paymentRowNeedsInvoiceLink({ amount: 100, invoice_id: null }, [{ ...inv('s'), external_send_channel: 'stripe' }, inv('a')])).toBe(true)
  })
})

describe('paymentDateBeforeBilled', () => {
  it('warns only when paid strictly before the linked bill date', () => {
    const invoices = [inv('a', 'billed', '2026-08-10T15:00:00Z')]
    expect(paymentDateBeforeBilled({ amount: 1, invoice_id: 'a', paid_on: '2026-08-09' }, invoices)).toBe(true)
    expect(paymentDateBeforeBilled({ amount: 1, invoice_id: 'a', paid_on: '2026-08-10' }, invoices)).toBe(false)
    expect(paymentDateBeforeBilled({ amount: 1, invoice_id: 'a', paid_on: '2026-08-11' }, invoices)).toBe(false)
  })

  it('falls back to the est. bill date and stays quiet without dates or a link', () => {
    const estOnly = [inv('a', 'billed', null, '2026-08-10')]
    expect(paymentDateBeforeBilled({ amount: 1, invoice_id: 'a', paid_on: '2026-08-01' }, estOnly)).toBe(true)
    expect(paymentDateBeforeBilled({ amount: 1, invoice_id: 'a', paid_on: '2026-08-01' }, [inv('a')])).toBe(false)
    expect(paymentDateBeforeBilled({ amount: 1, invoice_id: null, paid_on: '2026-08-01' }, estOnly)).toBe(false)
    expect(paymentDateBeforeBilled({ amount: 1, invoice_id: 'a', paid_on: null }, estOnly)).toBe(false)
  })
})
