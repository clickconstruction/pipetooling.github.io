import { describe, expect, it } from 'vitest'
import { billPaidState, billPaymentStripeOwned, billPaymentWayWords, billPaymentYmd, billsPaidByBill, type BillPaidBill, type BillPayment } from './billsPaid'
import { paymentSource } from '../jobs/billsAndPayments'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { PaymentRow } from '../jobs/jobFormTypes'

// Made-up data throughout: no live bill, payment, check number or amount.
const BILL = 'aaaaaaaa-1111-4111-8111-111111111111'
const OTHER = 'bbbbbbbb-2222-4222-8222-222222222222'

const bill = (over: Partial<BillPaidBill> = {}): BillPaidBill => ({ id: BILL, amount: 3120, status: 'billed', ...over })
const stripeBill = (over: Partial<BillPaidBill> = {}): BillPaidBill => bill({ stripeInvoiceId: 'in_made_up', stripeInvoiceStatus: 'paid', externalSendChannel: 'stripe', status: 'paid', ...over })
const payment = (over: Partial<BillPayment> = {}): BillPayment => ({
  id: 'p1',
  billId: BILL,
  amount: 3120,
  paidOn: '2026-11-10',
  createdAtIso: '2026-11-11T15:00:00.000Z',
  paymentType: null,
  note: null,
  referenceNumber: null,
  bankTransactionId: null,
  stripeCreditNoteId: null,
  ...over,
})

describe('billPaymentYmd', () => {
  it('reads the day the row names, whole or with a time after it', () => {
    expect(billPaymentYmd({ paidOn: '2026-11-10', createdAtIso: '2026-11-11T15:00:00.000Z' })).toBe('2026-11-10')
    expect(billPaymentYmd({ paidOn: '2026-11-10T00:00:00+00:00', createdAtIso: null })).toBe('2026-11-10')
  })
  it('falls back to the day the row was written, in the company’s calendar', () => {
    // 9:40 PM Central on Sun, Nov 8 is already Monday in UTC.
    expect(billPaymentYmd({ paidOn: null, createdAtIso: '2026-11-09T03:40:00.000Z' })).toBe('2026-11-08')
    expect(billPaymentYmd({ paidOn: 'soon', createdAtIso: null })).toBe('')
  })
})

describe('billPaymentWayWords', () => {
  it('names a payment the webhook wrote as a card through Stripe', () => {
    expect(billPaymentWayWords(payment({ note: 'Stripe' }), stripeBill())).toBe('Card · Stripe')
    // The note alone is enough: a read that did not ask for the bill's Stripe columns still knows.
    expect(billPaymentWayWords(payment({ note: ' stripe ' }), bill())).toBe('Card · Stripe')
  })
  it('names a check recorded in Stripe, with its number', () => {
    expect(billPaymentWayWords(payment({ paymentType: 'Check', referenceNumber: '2291' }), stripeBill())).toBe('Check 2291 · recorded in Stripe')
  })
  it('names a matched deposit by the bank, a check with its number', () => {
    expect(billPaymentWayWords(payment({ paymentType: 'checkDeposit', referenceNumber: '#4417', bankTransactionId: 'm1' }), bill())).toBe('Check 4417 · bank deposit')
    expect(billPaymentWayWords(payment({ paymentType: 'other', bankTransactionId: 'm1' }), bill())).toBe('Bank deposit')
    // The bank comes first: a deposit matched to a Stripe bill is the bank's.
    expect(billPaymentWayWords(payment({ paymentType: 'checkDeposit', bankTransactionId: 'm1' }), stripeBill())).toBe('Check · bank deposit')
  })
  it('never reads a bank match\'s own id out as the check\'s number', () => {
    // A matched deposit can leave its id in the reference: 36 characters, made up here.
    expect(billPaymentWayWords(payment({ paymentType: 'checkDeposit', referenceNumber: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', bankTransactionId: 'm1' }), bill())).toBe('Check · bank deposit')
    // A number typed with its word says the number once.
    expect(billPaymentWayWords(payment({ paymentType: 'checkDeposit', referenceNumber: 'ck# 3045', bankTransactionId: 'm1' }), bill())).toBe('Check 3045 · bank deposit')
  })
  it('names a payment typed by hand, and says a number for a check alone', () => {
    expect(billPaymentWayWords(payment({ paymentType: 'Cash', referenceNumber: 'drawer' }), bill())).toBe('Cash · typed by hand')
    expect(billPaymentWayWords(payment({ paymentType: 'Check', referenceNumber: '118' }), bill())).toBe('Check 118 · typed by hand')
    expect(billPaymentWayWords(payment({}), bill())).toBe('Typed by hand')
  })
  it('says what the job window says of the same row', () => {
    const rows: Array<[BillPayment, BillPaidBill]> = [
      [payment({ note: 'Stripe' }), stripeBill()],
      [payment({ paymentType: 'Check' }), stripeBill()],
      [payment({ paymentType: 'checkDeposit', bankTransactionId: 'm1' }), bill()],
      [payment({ paymentType: 'Wire' }), bill()],
      [payment({ paymentType: 'In kind' }), bill()],
      [payment({ stripeCreditNoteId: 'cn_made_up', paymentType: 'Cash' }), stripeBill({ status: 'billed', stripeInvoiceStatus: 'open' })],
      // A check held on an open Stripe bill is a hand-typed row until Stripe has the bill as paid.
      [payment({ paymentType: 'Check' }), stripeBill({ status: 'billed', stripeInvoiceStatus: 'open' })],
    ]
    for (const [p, b] of rows) {
      const row = { id: p.id, amount: p.amount, paid_on: p.paidOn, payment_type: p.paymentType, note: p.note, reference_number: p.referenceNumber, invoice_id: b.id, mercury_transaction_id: p.bankTransactionId, stripe_credit_note_id: p.stripeCreditNoteId } as unknown as PaymentRow
      const job = { invoices: [{ id: b.id, status: b.status, stripe_invoice_id: b.stripeInvoiceId ?? null, stripe_invoice_status: b.stripeInvoiceStatus ?? null, external_send_channel: b.externalSendChannel ?? null }] } as unknown as JobWithDetails
      expect(billPaymentWayWords(p, b)).toBe(paymentSource(row, job).chip)
    }
  })
})

describe('billPaymentStripeOwned', () => {
  it('is true for the webhook’s row, a credit note, and any row on a bill Stripe has as paid', () => {
    expect(billPaymentStripeOwned({ note: 'Stripe', stripeCreditNoteId: null }, undefined)).toBe(true)
    expect(billPaymentStripeOwned({ note: null, stripeCreditNoteId: 'cn_made_up' }, stripeBill({ stripeInvoiceStatus: 'open' }))).toBe(true)
    expect(billPaymentStripeOwned({ note: null, stripeCreditNoteId: null }, stripeBill())).toBe(true)
  })
  it('is false for a row on an open Stripe bill, and on a bill that never went through Stripe', () => {
    expect(billPaymentStripeOwned({ note: null, stripeCreditNoteId: null }, stripeBill({ stripeInvoiceStatus: 'open' }))).toBe(false)
    expect(billPaymentStripeOwned({ note: null, stripeCreditNoteId: 'cn_made_up' }, bill())).toBe(false)
    expect(billPaymentStripeOwned({ note: 'Rent credit', stripeCreditNoteId: null }, bill({ stripeInvoiceStatus: 'paid' }))).toBe(false)
  })
})

describe('billPaidState', () => {
  it('has no state for a bill that is neither billed nor paid', () => {
    expect(billPaidState(bill({ status: 'ready_to_bill' }), [payment()])).toBeNull()
  })
  it('says a billed bill with no payment is open for its whole amount', () => {
    expect(billPaidState(bill(), [])).toEqual({ kind: 'open', paidOn: null, paidAmount: 0, outAmount: 3120, wayWords: '', paidAtIso: null, payments: [] })
  })
  it('says a billed bill with money on it is part paid, and what is left', () => {
    const state = billPaidState(bill(), [payment({ amount: 1500, paymentType: 'Check', referenceNumber: '2291', paidOn: '2026-11-09' })])!
    expect(state).toMatchObject({ kind: 'part', paidOn: '2026-11-09', paidAmount: 1500, outAmount: 1620, wayWords: 'Check 2291 · typed by hand' })
  })
  it('says a paid bill is paid on its newest payment’s day, by that payment’s way', () => {
    const state = billPaidState(bill({ status: 'paid' }), [
      payment({ id: 'p2', amount: 1620, paidOn: '2026-11-16', paymentType: 'checkDeposit', bankTransactionId: 'm2' }),
      payment({ id: 'p1', amount: 1500, paidOn: '2026-11-09', paymentType: 'Cash' }),
    ])!
    expect(state).toMatchObject({ kind: 'paid', paidOn: '2026-11-16', paidAmount: 3120, outAmount: 0, wayWords: 'Check · bank deposit' })
    expect(state.payments.map((p) => [p.id, p.ymd])).toEqual([
      ['p1', '2026-11-09'],
      ['p2', '2026-11-16'],
    ])
  })
  it('trusts the bill’s own status: paid with no row is paid with no day, and paid for less is still paid', () => {
    expect(billPaidState(bill({ status: 'paid' }), [])).toMatchObject({ kind: 'paid', paidOn: null, outAmount: 0, wayWords: '' })
    expect(billPaidState(bill({ status: 'paid' }), [payment({ amount: 3000 })])).toMatchObject({ kind: 'paid', paidAmount: 3000, outAmount: 0 })
  })
  it('keeps a Stripe payment’s instant, to say its time, and no other row’s', () => {
    const stripe = billPaidState(stripeBill(), [payment({ note: 'Stripe', paidOn: '2026-11-12', createdAtIso: '2026-11-12T14:21:00.000Z' })])!
    expect(stripe).toMatchObject({ paidAtIso: '2026-11-12T14:21:00.000Z', wayWords: 'Card · Stripe' })
    expect(stripe.payments[0]).toMatchObject({ stripe: true, atIso: '2026-11-12T14:21:00.000Z', inKind: false })
    expect(billPaidState(bill({ status: 'paid' }), [payment({ paymentType: 'Check' })])!.paidAtIso).toBeNull()
  })
  it('marks a credit in kind, which pays the bill and is no money', () => {
    const state = billPaidState(bill({ status: 'paid' }), [payment({ paymentType: 'In kind', note: 'Rent credit' })])!
    expect(state.payments[0]).toMatchObject({ inKind: true, wayWords: 'In kind · typed by hand' })
  })
  it('never leaves a negative amount out, and holds cents', () => {
    expect(billPaidState(bill(), [payment({ amount: 4000 })])).toMatchObject({ kind: 'part', outAmount: 0 })
    expect(billPaidState(bill({ amount: 100.1 }), [payment({ amount: 33.37 })])).toMatchObject({ paidAmount: 33.37, outAmount: 66.73 })
  })
  it('reads only its own rows', () => {
    expect(billPaidState(bill(), [payment({ billId: OTHER })])).toMatchObject({ kind: 'open', payments: [] })
  })
})

describe('billsPaidByBill', () => {
  it('answers one state a bill, and none for a bill with no state', () => {
    const states = billsPaidByBill(
      [bill(), bill({ id: OTHER, status: 'paid', amount: 500 }), bill({ id: 'cccccccc-3333-4333-8333-333333333333', status: 'ready_to_bill' })],
      [payment({ amount: 1500 }), payment({ id: 'p2', billId: OTHER, amount: 500, paymentType: 'Cash' })],
    )
    expect([...states.keys()]).toEqual([BILL, OTHER])
    expect(states.get(BILL)!.kind).toBe('part')
    expect(states.get(OTHER)).toMatchObject({ kind: 'paid', wayWords: 'Cash · typed by hand' })
  })
})
