import { describe, expect, it } from 'vitest'
import { autoApplyInvoiceId, paymentDateBeforeBilled, paymentRowNeedsInvoiceLink } from './paymentInvoiceLinking'

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
