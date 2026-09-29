import { describe, expect, it } from 'vitest'
import {
  oobMarkPaidOnWords,
  oobUnwindDoneWords,
  paymentRowOffersCheckDidNotClear,
  stripeSendBackKind,
  stripeSendBackWords,
  stripeShowsOobMarkOnly,
} from './stripeOobSendBack'

// J1040 Iannotti PRV (2026-09-28): Stripe paid out of band on Sep 24, amount_paid 0, no payments left in the ledger.
const oobMark = { amount_paid: 0, paid_at: 1790260292, oob_paid_on: '2026-09-24' }
const openBill = { amount_paid: 0, paid_at: null, oob_paid_on: null }
const cardPaid = { amount_paid: 60000, paid_at: 1790260292, oob_paid_on: null }

describe('stripeShowsOobMarkOnly', () => {
  it('is true only when Stripe says paid with nothing paid through it', () => {
    expect(stripeShowsOobMarkOnly(oobMark)).toBe(true)
    expect(stripeShowsOobMarkOnly({ amount_paid: 0, paid_at: 1790260292, oob_paid_on: null })).toBe(true)
    expect(stripeShowsOobMarkOnly(openBill)).toBe(false)
    expect(stripeShowsOobMarkOnly(cardPaid)).toBe(false)
    expect(stripeShowsOobMarkOnly(null)).toBe(false)
  })
})

describe('stripeSendBackKind', () => {
  it('an open Stripe bill voids; a bill Stripe holds only as our mark reverses the mark', () => {
    expect(stripeSendBackKind({ invoiceStatus: 'billed', applied: 0, detail: openBill })).toBe('void_open')
    expect(stripeSendBackKind({ invoiceStatus: 'billed', applied: 0, detail: oobMark })).toBe('reverse_oob_mark')
  })
  it('no door while payments sit on the line, while Stripe holds real money, or before Stripe answered', () => {
    expect(stripeSendBackKind({ invoiceStatus: 'billed', applied: 600, detail: oobMark })).toBeNull()
    expect(stripeSendBackKind({ invoiceStatus: 'billed', applied: 0, detail: cardPaid })).toBeNull()
    expect(stripeSendBackKind({ invoiceStatus: 'billed', applied: 0, detail: null })).toBeNull()
    expect(stripeSendBackKind({ invoiceStatus: 'paid', applied: 0, detail: oobMark })).toBeNull()
    expect(stripeSendBackKind({ invoiceStatus: 'ready_to_bill', applied: 0, detail: openBill })).toBeNull()
  })
})

describe('oobMarkPaidOnWords', () => {
  it('prefers the mark’s own day, falls back to Stripe’s paid_at in company time, else nothing', () => {
    expect(oobMarkPaidOnWords(oobMark)).toBe('Sep 24')
    expect(oobMarkPaidOnWords({ amount_paid: 0, paid_at: 1790260292, oob_paid_on: null })).toBe('Sep 24')
    expect(oobMarkPaidOnWords(openBill)).toBeNull()
    expect(oobMarkPaidOnWords(null)).toBeNull()
  })
})

describe('stripeSendBackWords', () => {
  it('the reverse-the-mark confirm names the amount, the day and the re-bill', () => {
    const w = stripeSendBackWords('reverse_oob_mark', { amount: 600, paidOn: 'Sep 24' })
    expect(w.button).toBe("Check didn't clear · send back…")
    expect(w.title).toBe("Check didn't clear?")
    expect(w.bullets[0]).toContain('$600.00 bill paid by check on Sep 24')
    expect(w.bullets[0]).toContain('credit note')
    expect(w.bullets[2]).toContain('Bill Customer')
    expect(w.action).toBe('Send back')
    expect(w.note).toContain('Stripe Dashboard')
  })
  it('without a day the sentence still reads', () => {
    const w = stripeSendBackWords('reverse_oob_mark', { amount: 600, paidOn: null })
    expect(w.bullets[0]).toContain('$600.00 bill paid by check, but')
  })
  it('the plain void keeps its words', () => {
    const w = stripeSendBackWords('void_open', { amount: 600, paidOn: null })
    expect(w.button).toBe('Void Stripe invoice…')
    expect(w.title).toBe('Void Stripe invoice?')
    expect(w.action).toBe('Void invoice')
    expect(w.bullets).toHaveLength(3)
  })
})

describe('paymentRowOffersCheckDidNotClear', () => {
  it('only a whole-bill out-of-band mark on a bill still Paid', () => {
    expect(paymentRowOffersCheckDidNotClear({ holdsReason: 'paid_in_stripe', invoiceStatus: 'paid' })).toBe(true)
    expect(paymentRowOffersCheckDidNotClear({ holdsReason: 'paid_in_stripe', invoiceStatus: 'billed' })).toBe(false)
    expect(paymentRowOffersCheckDidNotClear({ holdsReason: 'credit_note', invoiceStatus: 'paid' })).toBe(false)
    expect(paymentRowOffersCheckDidNotClear({ holdsReason: null, invoiceStatus: 'paid' })).toBe(false)
  })
})

describe('oobUnwindDoneWords', () => {
  it('says what to do next either way', () => {
    expect(oobUnwindDoneWords(true)).toContain('Bill Customer')
    expect(oobUnwindDoneWords(false)).toContain('send the bill back')
  })
})
