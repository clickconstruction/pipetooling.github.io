import { describe, expect, it } from 'vitest'
import {
  canRemovePaymentRowFromForm,
  canUnlinkMercuryPayment,
  jobsLedgerInvoiceIsStripeLinked,
  mercuryDepositFailed,
  mercuryDepositFailedWords,
  mercuryLinkedPaymentRow,
  mercuryUnlinkBlockedByStripeHostedInvoice,
  unlinkedPaymentToastText,
  paymentRowLinkedToInvoice,
  stripeBillInvoiceForPaymentRow,
  stripeHoldsPaymentReason,
  stripeHoldsPaymentWords,
  unlinkLeavesStripeBillUntouched,
} from './jobFormPaymentPredicates'
import type { JobsLedgerInvoiceRow, PaymentRow } from './jobFormTypes'
import type { JobWithDetails } from '../../types/jobWithDetails'

const payment = (o: Partial<PaymentRow> = {}): PaymentRow => ({ id: 'p', amount: 0, paid_on: null, sent_on: null, note: null, payment_type: null, reference_number: null, invoice_id: null, mercury_transaction_id: null, ...o })
const jobWithInvoice = (inv: Partial<JobsLedgerInvoiceRow>) => ({ invoices: [{ id: 'i1', ...inv }] }) as unknown as JobWithDetails

describe('linkage predicates', () => {
  it('mercuryLinkedPaymentRow / paymentRowLinkedToInvoice', () => {
    expect(mercuryLinkedPaymentRow(payment())).toBe(false)
    expect(mercuryLinkedPaymentRow(payment({ mercury_transaction_id: 'm' }))).toBe(true)
    expect(paymentRowLinkedToInvoice(payment())).toBe(false)
    expect(paymentRowLinkedToInvoice(payment({ invoice_id: 'i' }))).toBe(true)
  })
  it('jobsLedgerInvoiceIsStripeLinked via stripe id or channel', () => {
    expect(jobsLedgerInvoiceIsStripeLinked({ stripe_invoice_id: 'in_1', external_send_channel: null } as JobsLedgerInvoiceRow)).toBe(true)
    expect(jobsLedgerInvoiceIsStripeLinked({ stripe_invoice_id: null, external_send_channel: 'stripe' } as JobsLedgerInvoiceRow)).toBe(true)
    expect(jobsLedgerInvoiceIsStripeLinked({ stripe_invoice_id: null, external_send_channel: 'physical' } as JobsLedgerInvoiceRow)).toBe(false)
  })
})

describe('canUnlinkMercuryPayment', () => {
  it('office roles only', () => {
    expect(canUnlinkMercuryPayment('dev')).toBe(true)
    expect(canUnlinkMercuryPayment('primary')).toBe(true)
    expect(canUnlinkMercuryPayment('technician')).toBe(false)
    expect(canUnlinkMercuryPayment(null)).toBe(false)
  })
})

describe('stripeBillInvoiceForPaymentRow / canRemovePaymentRowFromForm', () => {
  it('returns the linked stripe invoice, else null', () => {
    const job = jobWithInvoice({ stripe_invoice_id: 'in_1' })
    expect(stripeBillInvoiceForPaymentRow(payment({ invoice_id: 'i1' }), job)?.id).toBe('i1')
    expect(stripeBillInvoiceForPaymentRow(payment({ invoice_id: 'i1' }), null)).toBeNull()
    expect(stripeBillInvoiceForPaymentRow(payment(), job)).toBeNull() // not invoice-linked
  })
  it('a plain manual row is removable; mercury/invoice/stripe-linked rows are not', () => {
    expect(canRemovePaymentRowFromForm(payment(), null)).toBe(true)
    expect(canRemovePaymentRowFromForm(payment({ mercury_transaction_id: 'm' }), null)).toBe(false)
    expect(canRemovePaymentRowFromForm(payment({ invoice_id: 'i1' }), jobWithInvoice({ stripe_invoice_id: 'in_1' }))).toBe(false)
  })
})

/**
 * v2.3784 — Take 5 – Seguin (JP878): a $13,680 check deposit matched to the
 * job's open Stripe bill, returned by the bank two days later. Stripe never
 * recorded it (no credit note, bill still open), so the unlink is allowed.
 */
describe('stripeHoldsPaymentReason / mercuryUnlinkBlockedByStripeHostedInvoice', () => {
  const bounced = payment({ id: 'p-878', amount: 13680, invoice_id: 'i1', mercury_transaction_id: 'm-failed' })
  it('a bank deposit on an open Stripe bill with no credit note unlinks — nothing in Stripe to reverse', () => {
    const job = jobWithInvoice({ stripe_invoice_id: 'in_1UGLqV', stripe_invoice_status: 'open', amount: 15200 })
    expect(stripeHoldsPaymentReason(bounced, job)).toBeNull()
    expect(mercuryUnlinkBlockedByStripeHostedInvoice(bounced, job)).toBe(false)
    expect(unlinkLeavesStripeBillUntouched(bounced, job)).toBe(true)
  })
  it('a part payment with a credit note is Undo part payment, not unlink', () => {
    const job = jobWithInvoice({ stripe_invoice_id: 'in_1', stripe_invoice_status: 'open' })
    const row = payment({ ...bounced, stripe_credit_note_id: 'cn_1' })
    expect(stripeHoldsPaymentReason(row, job)).toBe('credit_note')
    expect(mercuryUnlinkBlockedByStripeHostedInvoice(row, job)).toBe(true)
    expect(unlinkLeavesStripeBillUntouched(row, job)).toBe(false)
    expect(stripeHoldsPaymentWords('credit_note')).toMatch(/Undo part payment/)
  })
  it('a bill marked paid in Stripe is Unwind, not unlink', () => {
    const job = jobWithInvoice({ stripe_invoice_id: 'in_1', stripe_invoice_status: 'paid' })
    expect(stripeHoldsPaymentReason(bounced, job)).toBe('paid_in_stripe')
    expect(mercuryUnlinkBlockedByStripeHostedInvoice(bounced, job)).toBe(true)
    expect(stripeHoldsPaymentWords('paid_in_stripe')).toMatch(/unwind/)
  })
  it('the bank verdict chip and the toast after the unlink', () => {
    expect(mercuryDepositFailed({ status: 'failed', failureReason: 'Insufficient funds' })).toBe(true)
    expect(mercuryDepositFailed({ status: 'sent', failureReason: '' })).toBe(false)
    expect(mercuryDepositFailed(null)).toBe(false)
    expect(mercuryDepositFailedWords({ status: 'failed', failureReason: 'Insufficient funds' })).toBe('Returned by the bank · Insufficient funds')
    expect(mercuryDepositFailedWords({ status: 'failed', failureReason: '' })).toBe('Returned by the bank')
    expect(unlinkedPaymentToastText({ bank_failed: true, bank_reason: 'Insufficient funds', marked_returned: true })).toBe(
      'Payment removed from job. The bank returned this deposit (Insufficient funds), so it is marked returned in Accounts Receivable.',
    )
    expect(unlinkedPaymentToastText({ bank_failed: false, marked_returned: false })).toBe(
      'Payment removed from job. The bank deposit is available in Accounts Receivable again.',
    )
    expect(unlinkedPaymentToastText(null)).toMatch(/available in Accounts Receivable again/)
  })
  it('a physical bill, or a row on no bill, is never Stripe-held', () => {
    expect(stripeHoldsPaymentReason(bounced, jobWithInvoice({ stripe_invoice_id: null, external_send_channel: 'physical' }))).toBeNull()
    expect(unlinkLeavesStripeBillUntouched(bounced, jobWithInvoice({ stripe_invoice_id: null, external_send_channel: 'physical' }))).toBe(false)
    expect(stripeHoldsPaymentReason(payment({ mercury_transaction_id: 'm' }), jobWithInvoice({ stripe_invoice_id: 'in_1' }))).toBeNull()
    expect(mercuryUnlinkBlockedByStripeHostedInvoice(bounced, null)).toBe(false)
  })
})
