import { describe, expect, it } from 'vitest'
import { applyToStripeOffered, applyToStripeWords, customerPaymentTypeWord } from './applyPaymentToStripeBill'

const bill = { status: 'billed', amount: 3850, stripe_invoice_id: 'in_825', stripe_invoice_status: 'open' }
const row = { stripe_credit_note_id: null, amount: 3500 }
const base = { bill, billIsStripe: true, row, persisted: true, partial: false, hasAction: true }

describe('applyToStripeOffered (v2.4847)', () => {
  it('a saved check under an open Stripe bill, with no credit note, under the bill amount, is offered', () => {
    expect(applyToStripeOffered(base)).toBe(true)
  })

  it('not on a bill that is not Stripe, not Billed, or already paid in Stripe', () => {
    expect(applyToStripeOffered({ ...base, billIsStripe: false })).toBe(false)
    expect(applyToStripeOffered({ ...base, bill: { ...bill, status: 'paid' } })).toBe(false)
    expect(applyToStripeOffered({ ...base, bill: { ...bill, stripe_invoice_status: 'paid' } })).toBe(false)
    expect(applyToStripeOffered({ ...base, bill: { ...bill, stripe_invoice_id: '' } })).toBe(false)
    expect(applyToStripeOffered({ ...base, bill: null })).toBe(false)
  })

  it('not when Stripe already holds it, the row is unsaved or split, or the host has no door', () => {
    expect(applyToStripeOffered({ ...base, row: { ...row, stripe_credit_note_id: 'cn_1' } })).toBe(false)
    expect(applyToStripeOffered({ ...base, persisted: false })).toBe(false)
    expect(applyToStripeOffered({ ...base, partial: true })).toBe(false)
    expect(applyToStripeOffered({ ...base, hasAction: false })).toBe(false)
  })

  it('a payment at or over the bill is a whole-bill close, not a credit line', () => {
    expect(applyToStripeOffered({ ...base, row: { ...row, amount: 3850 } })).toBe(false)
    expect(applyToStripeOffered({ ...base, row: { ...row, amount: 4000 } })).toBe(false)
    expect(applyToStripeOffered({ ...base, row: { ...row, amount: 0 } })).toBe(false)
  })
})

describe('applyToStripeWords', () => {
  it('names the credit line Stripe will show and what stays due', () => {
    const w = applyToStripeWords({
      row: { amount: 3500, paid_on: '2026-09-14', payment_type: 'Check', reference_number: '1042' },
      bill: { amount: 3850 },
      openAfter: 350,
    })
    expect(w.creditLine).toBe('Check #1042 received Sep 14 · $3,500.00')
    expect(w.staysDue).toBe('350.00')
    expect(w.sentence).toContain('ask for $350.00')
    expect(w.sentence).toContain('Undo part payment is the way back')
  })

  it('a bank deposit reads the customer word for its kind and never the bank reference id', () => {
    const w = applyToStripeWords({
      row: { amount: 3500, paid_on: '2026-09-14', payment_type: 'checkDeposit', reference_number: '4ed0c1d2-0000-4000-8000-0000000003c1', mercury_transaction_id: 'mt1' },
      bill: { amount: 3850 },
      openAfter: 350,
    })
    expect(w.creditLine).toBe('Check received Sep 14 · $3,500.00')
  })

  it('customerPaymentTypeWord: Check · Wire · ACH · Card · Cash, else Payment', () => {
    expect(customerPaymentTypeWord('checkDeposit')).toBe('Check')
    expect(customerPaymentTypeWord('Cheque')).toBe('Check')
    expect(customerPaymentTypeWord('incomingDomesticWire')).toBe('Wire')
    expect(customerPaymentTypeWord('ACH')).toBe('ACH')
    expect(customerPaymentTypeWord('Card (external)')).toBe('Card')
    expect(customerPaymentTypeWord('cash')).toBe('Cash')
    expect(customerPaymentTypeWord('other')).toBe('Payment')
    expect(customerPaymentTypeWord(null)).toBe('Payment')
  })
})
