import { describe, expect, it } from 'vitest'
import {
  heldStripeCloseYmd,
  heldStripeMarkLineWords,
  heldStripeMarkNote,
  markPaidHoldsStripeClose,
  paymentRowOnHeldStripeMark,
  stripeMarkIsHeld,
} from './heldStripeMark'
import type { JobsLedgerInvoiceRow, PaymentRow } from './jobFormTypes'
import type { JobWithDetails } from '../../types/jobWithDetails'

const inv = (over: Partial<JobsLedgerInvoiceRow> & { stripe_invoice_status?: string | null } = {}) =>
  ({ id: 'inv-s', status: 'paid', amount: 6200, stripe_invoice_id: 'in_1', external_send_channel: 'stripe', stripe_invoice_status: 'open', ...over }) as unknown as JobsLedgerInvoiceRow
const row = (over: Partial<PaymentRow> = {}): PaymentRow =>
  ({ id: 'p1', amount: 6200, paid_on: '2026-10-07', sent_on: null, note: null, payment_type: 'Check', reference_number: '1042', invoice_id: 'inv-s', mercury_transaction_id: null, ...over })
const job = (invoices: JobsLedgerInvoiceRow[]) => ({ id: 'j186', invoices }) as unknown as JobWithDetails

describe('markPaidHoldsStripeClose (v2.4801)', () => {
  it('holds for a check at the whole open balance on a Stripe bill, and nothing else', () => {
    expect(markPaidHoldsStripeClose({ stripeHosted: true, paymentType: 'Check', planKind: 'full' })).toBe(true)
    expect(markPaidHoldsStripeClose({ stripeHosted: true, paymentType: 'cheque', planKind: 'full' })).toBe(true)
    expect(markPaidHoldsStripeClose({ stripeHosted: true, paymentType: 'Cash', planKind: 'full' })).toBe(false)
    expect(markPaidHoldsStripeClose({ stripeHosted: true, paymentType: 'Check', planKind: 'part' })).toBe(false)
    expect(markPaidHoldsStripeClose({ stripeHosted: false, paymentType: 'Check', planKind: 'full' })).toBe(false)
  })
})

describe('the held mark', () => {
  it('closes seven days after the check', () => {
    expect(heldStripeCloseYmd('2026-10-07')).toBe('2026-10-14')
  })
  it('is a Stripe bill paid here and still open in Stripe', () => {
    expect(stripeMarkIsHeld(inv())).toBe(true)
    expect(stripeMarkIsHeld(inv({ stripe_invoice_status: null }))).toBe(true)
    expect(stripeMarkIsHeld(inv({ stripe_invoice_status: 'paid' }))).toBe(false)
    expect(stripeMarkIsHeld(inv({ stripe_invoice_status: 'void' }))).toBe(false)
    expect(stripeMarkIsHeld(inv({ status: 'billed' }))).toBe(false)
    expect(stripeMarkIsHeld(inv({ stripe_invoice_id: null, external_send_channel: null }))).toBe(false)
  })
  it('finds the held bill a row pays', () => {
    expect(paymentRowOnHeldStripeMark(row(), job([inv()]))?.id).toBe('inv-s')
    expect(paymentRowOnHeldStripeMark(row(), job([inv({ stripe_invoice_status: 'paid' })]))).toBeNull()
    expect(paymentRowOnHeldStripeMark(row({ invoice_id: null }), job([inv()]))).toBeNull()
    expect(paymentRowOnHeldStripeMark(row(), null)).toBeNull()
  })
})

describe('the words', () => {
  it('the Mark Paid note names the close day and what stays possible', () => {
    const note = heldStripeMarkNote('2026-10-07')
    expect(note).toContain('Stripe closes the invoice on Oct 14, 7 days after the check')
    expect(note).toContain('moved to another job or taken off')
    expect(heldStripeMarkNote('')).toContain('7 days after the check')
  })
  it('v2.4822: a check already a week old says the next morning, not a day that has passed', () => {
    expect(heldStripeMarkNote('2026-09-29', '2026-10-07')).toContain('The check is over 7 days old, so Stripe closes the invoice the next morning.')
    expect(heldStripeMarkNote('2026-10-07', '2026-10-07')).toContain('on Oct 14')
  })
  it('the line names the close day, or the next sweep once it has passed', () => {
    expect(heldStripeMarkLineWords('2026-10-07', '2026-10-08')).toBe('Stripe closes the bill Oct 14, once the check has cleared')
    expect(heldStripeMarkLineWords('2026-10-07', '2026-10-14')).toBe('Stripe closes the bill the next morning')
    expect(heldStripeMarkLineWords(null, '2026-10-14')).toBe('Stripe closes the bill once the check has cleared')
  })
})
