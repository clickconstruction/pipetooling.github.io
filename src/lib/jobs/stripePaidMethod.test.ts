import { describe, expect, it } from 'vitest'
import { isStripeBankDebitMethod, STRIPE_BANK_DEBIT_PAYMENT_TYPE as EDGE_TYPE, STRIPE_PAYMENT_ROW_NOTE, stripePaidMethodArgs } from '../../../supabase/functions/_shared/stripePaidMethod'
import { instrumentWord, isStripePayment, paymentSourceFromFacts, STRIPE_BANK_DEBIT_PAYMENT_TYPE } from './billsAndPayments'

describe('stripePaidMethod — how a bill paid through Stripe was paid (v2.8428)', () => {
  it('names a debit on a bank account, and nothing else', () => {
    expect(isStripeBankDebitMethod('us_bank_account')).toBe(true)
    expect(isStripeBankDebitMethod(' ach_debit ')).toBe(true)
    expect(['card', 'link', 'cashapp', 'customer_balance', '', null, undefined].some(isStripeBankDebitMethod)).toBe(false)
  })
  it('passes the type with the note, so the row is still Stripe\'s', () => {
    expect(stripePaidMethodArgs('us_bank_account', {})).toEqual({ p_payment_type: 'Bank debit', p_internal_note: 'Stripe' })
  })
  it('passes nothing for a card, so a card\'s row is written as it always was', () => {
    expect(stripePaidMethodArgs('card', {})).toBeNull()
    expect(stripePaidMethodArgs(null, {})).toBeNull()
  })
  it('passes nothing when the office marked the bill paid itself: its own words stand', () => {
    expect(stripePaidMethodArgs('us_bank_account', { p_payment_type: 'Check' })).toBeNull()
    expect(stripePaidMethodArgs('us_bank_account', { p_reference_number: '4417' })).toBeNull()
    expect(stripePaidMethodArgs('us_bank_account', { p_internal_note: 'dropped at the office' })).toBeNull()
  })
  it('writes a row the app reads as a bank debit through Stripe', () => {
    // The edge side and the client name the type with one word, and the note is the one the app tells a Stripe row by.
    expect(EDGE_TYPE).toBe(STRIPE_BANK_DEBIT_PAYMENT_TYPE)
    expect(isStripePayment({ note: STRIPE_PAYMENT_ROW_NOTE })).toBe(true)
    expect(instrumentWord(EDGE_TYPE)).toBe('bank debit')
    expect(paymentSourceFromFacts({ bankLinked: false, stripeOwned: true, paymentType: EDGE_TYPE })).toEqual({ kind: 'stripe-card', chip: 'Bank debit · Stripe', instrument: 'bank debit' })
  })
})
