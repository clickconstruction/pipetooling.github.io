import { describe, expect, it } from 'vitest'
import {
  heldMoveEventRow,
  planHeldLanding,
  stripeHeldMoveOffered,
  stripeHeldMoveReason,
  stripeHeldMoveSteps,
  stripeHeldMoveStoppedWords,
} from './stripeHeldPaymentMove'
import type { JobsLedgerInvoiceRow, PaymentRow } from './jobFormTypes'
import type { JobWithDetails } from '../../types/jobWithDetails'

const inv = (over: Record<string, unknown> = {}) =>
  ({ id: 'inv-s', status: 'paid', amount: 6200, stripe_invoice_id: 'in_1', external_send_channel: 'stripe', stripe_invoice_status: 'paid', ...over }) as unknown as JobsLedgerInvoiceRow
const row = (over: Partial<PaymentRow> = {}): PaymentRow =>
  ({ id: 'p1', amount: 6200, paid_on: '2025-10-28', sent_on: null, note: null, payment_type: 'Check', reference_number: '1042', invoice_id: 'inv-s', mercury_transaction_id: null, ...over })
const job = (invoices: JobsLedgerInvoiceRow[]) => ({ id: 'j186', invoices }) as unknown as JobWithDetails

describe('stripeHeldMoveOffered (v2.4803)', () => {
  it('a check on a bill Stripe holds by our mark, still Paid here; not a held mark, a credit note, or a Billed bill', () => {
    expect(stripeHeldMoveOffered(row(), job([inv()]))).toBe(true)
    expect(stripeHeldMoveOffered(row(), job([inv({ stripe_invoice_status: 'open' })]))).toBe(false)
    expect(stripeHeldMoveOffered(row({ stripe_credit_note_id: 'cn_1' }), job([inv()]))).toBe(false)
    expect(stripeHeldMoveOffered(row(), job([inv({ status: 'billed' })]))).toBe(false)
    expect(stripeHeldMoveOffered(row(), null)).toBe(false)
  })
})

describe('the plan', () => {
  it('the reason names the job and the why', () => {
    expect(stripeHeldMoveReason('J922', 'wrong job')).toBe('Moved to J922 · wrong job')
    expect(stripeHeldMoveReason('J922', '  ')).toBe('Moved to J922')
  })
  it('lands on the one open bill with room, else on the job', () => {
    expect(planHeldLanding([{ id: 'b1', status: 'billed', amount: 6200, applied: 0 }], 6200)).toEqual({ kind: 'bill', invoiceId: 'b1', billAmount: 6200 })
    expect(planHeldLanding([{ id: 'b1', status: 'billed', amount: 5000, applied: 0 }], 6200)).toEqual({ kind: 'job' })
    expect(planHeldLanding([{ id: 'b1', status: 'billed', amount: 6200, applied: 1000 }], 6200)).toEqual({ kind: 'job' })
    expect(planHeldLanding([{ id: 'b1', status: 'billed', amount: 9000, applied: 0 }, { id: 'b2', status: 'billed', amount: 7000, applied: 0 }], 6200)).toEqual({ kind: 'job' })
    expect(planHeldLanding([{ id: 'b1', status: 'paid', amount: 6200, applied: 6200 }], 6200)).toEqual({ kind: 'job' })
    expect(planHeldLanding([], 6200)).toEqual({ kind: 'job' })
  })
  it('the steps read in order and say where the check lands', () => {
    const steps = stripeHeldMoveSteps({ fromLabel: 'J186', toLabel: 'J922', amount: 6200, billAmount: 6200, landing: { kind: 'bill', invoiceId: 'b1', billAmount: 6200 } })
    expect(steps).toEqual([
      "A credit note in Stripe reverses the paid mark on J186's $6,200.00 bill",
      'That bill is sent back and J186 is Ready to Bill, so a fresh bill with a new number goes out',
      "The $6,200.00 check pays J922's $6,200.00 bill, held for seven days like any check",
      'Both jobs get the grey line: moved → J922',
    ])
    expect(stripeHeldMoveSteps({ fromLabel: 'J186', toLabel: 'J922', amount: 6200, billAmount: 6200, landing: { kind: 'job' } })[2]).toBe('The $6,200.00 check lands on J922 under Other money, with no bill picked')
    expect(stripeHeldMoveSteps({ fromLabel: 'J186', toLabel: 'J922', amount: 6200, billAmount: 6200, landing: null })[2]).toBe('The $6,200.00 check lands on J922')
  })
})

describe('when a step stops', () => {
  const args = { fromLabel: 'J186', toLabel: 'J922', amount: 6200, paidOn: '2025-10-28', reference: '1042', message: 'Stripe timed out' }
  it('says what is done and what is left by hand', () => {
    expect(stripeHeldMoveStoppedWords('send_back', args)).toBe(
      "The paid mark is reversed and the payment is off J186, but its bill did not go back: Stripe timed out. Open View bill on J186's Billed row and press Check didn't clear · send back…, then record the $6,200.00 check 1042 dated 2025-10-28 on J922 by hand.",
    )
    expect(stripeHeldMoveStoppedWords('land', args)).toBe('J186 is sent back, but the check did not land: Stripe timed out. Record the $6,200.00 check 1042 dated 2025-10-28 on J922 by hand.')
    expect(stripeHeldMoveStoppedWords('trace', args)).toBe('The check is on J922, but the grey line could not be written: Stripe timed out.')
  })
  it('the event row carries the snapshot and names the landed row', () => {
    expect(heldMoveEventRow({ snapshot: row(), fromJobId: 'j186', toJobId: 'j922', landedPaymentId: 'p9', reason: 'Moved to J922 · wrong job', actorUserId: 'u1', actorName: 'Taunya' })).toMatchObject({
      kind: 'moved', payment_id: 'p9', from_job_id: 'j186', to_job_id: 'j922', amount: 6200, paid_on: '2025-10-28', payment_type: 'Check', reference_number: '1042', invoice_id: 'inv-s', reason: 'Moved to J922 · wrong job', actor_name: 'Taunya',
    })
  })
})
