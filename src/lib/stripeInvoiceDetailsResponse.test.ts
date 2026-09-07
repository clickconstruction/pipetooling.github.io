import { describe, expect, it } from 'vitest'
import { parseStripeInvoiceDetailsResponse } from './stripeInvoiceDetailsResponse'

const ok = {
  success: true,
  currency: ' usd ',
  total: 125000,
  amount_due: 125000,
  amount_remaining: 25000,
  amount_paid: 100000,
  paid_at: 1725580800,
  oob_paid_on: ' 2026-09-05 ',
  due_date: 1726790400,
  invoice_number: ' INV-0042 ',
  customer_name: 'Pat Customer',
  customer_email: '',
  seller_name: null,
  memo: 'Gate code 1234',
  footer: 'Thanks',
  lines: [
    { description: 'Labor', quantity: 2, amount: 60000 },
    { description: 'Heater', quantity: null, amount: 65000 },
    { amount: 0 },
  ],
}

describe('parseStripeInvoiceDetailsResponse', () => {
  it('reads a full success payload, trimming strings and blanking empty ones', () => {
    expect(parseStripeInvoiceDetailsResponse(ok)).toEqual({
      success: true,
      currency: 'usd',
      total: 125000,
      amount_due: 125000,
      amount_remaining: 25000,
      amount_paid: 100000,
      paid_at: 1725580800,
      oob_paid_on: '2026-09-05',
      due_date: 1726790400,
      invoice_number: 'INV-0042',
      customer_name: 'Pat Customer',
      customer_email: null,
      seller_name: null,
      memo: 'Gate code 1234',
      footer: 'Thanks',
      lines: [
        { description: 'Labor', quantity: 2, amount: 60000 },
        { description: 'Heater', quantity: null, amount: 65000 },
        { description: '', quantity: null, amount: 0 },
      ],
    })
  })

  it('refuses anything that is not a success with a currency and numeric total / amount_due', () => {
    expect(parseStripeInvoiceDetailsResponse(null)).toBeNull()
    expect(parseStripeInvoiceDetailsResponse('x')).toBeNull()
    expect(parseStripeInvoiceDetailsResponse({ ...ok, success: false })).toBeNull()
    expect(parseStripeInvoiceDetailsResponse({ ...ok, currency: '  ' })).toBeNull()
    expect(parseStripeInvoiceDetailsResponse({ ...ok, total: '125000' })).toBeNull()
    expect(parseStripeInvoiceDetailsResponse({ ...ok, amount_due: Number.NaN })).toBeNull()
  })

  it('derives amount_remaining from total − paid when Stripe omits it, never below zero, and defaults paid to zero', () => {
    const { amount_remaining: _r, amount_paid: _p, ...noRemaining } = ok
    expect(parseStripeInvoiceDetailsResponse({ ...noRemaining, amount_paid: 100000 })).toMatchObject({ amount_remaining: 25000 })
    expect(parseStripeInvoiceDetailsResponse(noRemaining)).toMatchObject({ amount_paid: 0, amount_remaining: 125000 })
    expect(parseStripeInvoiceDetailsResponse({ ...ok, amount_remaining: -5 })).toMatchObject({ amount_remaining: 0 })
    expect(parseStripeInvoiceDetailsResponse({ ...noRemaining, amount_paid: 200000 })).toMatchObject({ amount_remaining: 0 })
  })

  it('treats bad timestamps and dates as unknown', () => {
    expect(parseStripeInvoiceDetailsResponse({ ...ok, paid_at: 0, due_date: 'tomorrow', oob_paid_on: '09/05/2026' })).toMatchObject({ paid_at: null, due_date: null, oob_paid_on: null })
    expect(parseStripeInvoiceDetailsResponse({ ...ok, paid_at: undefined, due_date: null })).toMatchObject({ paid_at: null, due_date: null })
  })

  it('a malformed line item fails the whole parse; a missing lines array reads as none', () => {
    expect(parseStripeInvoiceDetailsResponse({ ...ok, lines: [{ description: 'x', amount: 'free' }] })).toBeNull()
    expect(parseStripeInvoiceDetailsResponse({ ...ok, lines: [null] })).toBeNull()
    expect(parseStripeInvoiceDetailsResponse({ ...ok, lines: 'none' })?.lines).toEqual([])
    expect(parseStripeInvoiceDetailsResponse({ ...ok, lines: [{ description: 'x', amount: 5, quantity: 'two' }] })?.lines[0]?.quantity).toBeNull()
  })
})
