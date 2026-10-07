import { describe, expect, it } from 'vitest'
import {
  heldLandingWrite,
  heldMoveEventRow,
  heldMoveNoun,
  planHeldLanding,
  stripeHeldMoveDoneWords,
  stripeHeldMoveIntro,
  stripeHeldMoveOffered,
  stripeHeldMoveReason,
  stripeHeldMoveSteps,
  stripeHeldMoveStoppedWords,
  stripeHeldMoveTitle,
  type HeldLanding,
} from './stripeHeldPaymentMove'
import type { JobsLedgerInvoiceRow, PaymentRow } from './jobFormTypes'
import type { JobWithDetails } from '../../types/jobWithDetails'

const inv = (over: Record<string, unknown> = {}) =>
  ({ id: 'inv-s', status: 'paid', amount: 6200, stripe_invoice_id: 'in_1', external_send_channel: 'stripe', stripe_invoice_status: 'paid', ...over }) as unknown as JobsLedgerInvoiceRow
const row = (over: Partial<PaymentRow> = {}): PaymentRow =>
  ({ id: 'p1', amount: 6200, paid_on: '2025-10-28', sent_on: null, note: null, payment_type: 'Check', reference_number: '1042', invoice_id: 'inv-s', mercury_transaction_id: null, ...over })
const job = (invoices: JobsLedgerInvoiceRow[]) => ({ id: 'j186', invoices }) as unknown as JobWithDetails
const bill = (over: Partial<Extract<HeldLanding, { kind: 'bill' }>> = {}): Extract<HeldLanding, { kind: 'bill' }> =>
  ({ kind: 'bill', invoiceId: 'b1', billAmount: 6200, remaining: 6200, stripeHosted: true, ...over })

describe('stripeHeldMoveOffered (v2.4803)', () => {
  it('a payment on a bill Stripe holds by our mark, still Paid here; not a held mark, a credit note, or a Billed bill', () => {
    expect(stripeHeldMoveOffered(row(), job([inv()]))).toBe(true)
    expect(stripeHeldMoveOffered(row(), job([inv({ stripe_invoice_status: 'open' })]))).toBe(false)
    expect(stripeHeldMoveOffered(row({ stripe_credit_note_id: 'cn_1' }), job([inv()]))).toBe(false)
    expect(stripeHeldMoveOffered(row(), job([inv({ status: 'billed' })]))).toBe(false)
    expect(stripeHeldMoveOffered(row(), null)).toBe(false)
  })
})

describe('the words name a check only when it is one (v2.4822)', () => {
  it('check or payment, in the title, the intro and the toast', () => {
    expect(heldMoveNoun({ payment_type: 'Check' })).toBe('check')
    expect(heldMoveNoun({ payment_type: 'Cash' })).toBe('payment')
    expect(heldMoveNoun({ payment_type: null })).toBe('payment')
    expect(stripeHeldMoveTitle('payment')).toBe('Move this payment')
    expect(stripeHeldMoveIntro('payment', 'J904')).toBe(
      "Stripe holds this payment as paid, and Stripe never reopens a paid invoice. Moving it reverses that mark with a credit note, sends J904's bill back for a fresh one, and lands the payment on the job you pick.",
    )
    expect(stripeHeldMoveDoneWords('check', 'J186', 'J922')).toBe('Check moved to J922. J186 is Ready to Bill. Press Bill Customer there for a fresh bill.')
  })
})

describe('the plan', () => {
  it('the credit note reason names the job and the why', () => {
    expect(stripeHeldMoveReason('J922', 'wrong job')).toBe('Moved to J922 · wrong job')
    expect(stripeHeldMoveReason('J922', '  ')).toBe('Moved to J922')
  })
  it('lands on the one open bill with room, with what is left on it and whether it is Stripe’s; else on the job', () => {
    expect(planHeldLanding([{ id: 'b1', status: 'billed', amount: 6200, applied: 0, stripeHosted: true }], 6200)).toEqual({ kind: 'bill', invoiceId: 'b1', billAmount: 6200, remaining: 6200, stripeHosted: true })
    expect(planHeldLanding([{ id: 'b1', status: 'billed', amount: 9000, applied: 1000 }], 6200)).toEqual({ kind: 'bill', invoiceId: 'b1', billAmount: 9000, remaining: 8000, stripeHosted: false })
    expect(planHeldLanding([{ id: 'b1', status: 'billed', amount: 5000, applied: 0 }], 6200)).toEqual({ kind: 'job' })
    expect(planHeldLanding([{ id: 'b1', status: 'billed', amount: 9000, applied: 0 }, { id: 'b2', status: 'billed', amount: 7000, applied: 0 }], 6200)).toEqual({ kind: 'job' })
    expect(planHeldLanding([{ id: 'b1', status: 'paid', amount: 6200, applied: 6200 }], 6200)).toEqual({ kind: 'job' })
    expect(planHeldLanding([], 6200)).toEqual({ kind: 'job' })
  })
  it('writes the landing the way Mark Paid would on that bill', () => {
    expect(heldLandingWrite(bill({ stripeHosted: false }), 'Cash', 6200)).toBe('mark_paid')
    expect(heldLandingWrite(bill(), 'Check', 6200)).toBe('mark_paid')
    expect(heldLandingWrite(bill(), 'Cash', 6200)).toBe('mark_paid_then_close')
    expect(heldLandingWrite(bill({ remaining: 9000 }), 'Check', 6200)).toBe('stripe_part')
    expect(heldLandingWrite(bill({ remaining: 9000 }), 'Cash', 6200)).toBe('stripe_part')
  })
})

describe('the steps', () => {
  const base = { fromLabel: 'J186', toLabel: 'J922', amount: 6200, billAmount: 6200, noun: 'check' as const, paymentType: 'Check', paidOnYmd: '2025-10-28', todayYmd: '2026-10-07' }
  it('read in order, and a week-old check on a Stripe bill closes the next morning', () => {
    expect(stripeHeldMoveSteps({ ...base, landing: bill() })).toEqual([
      "A credit note in Stripe reverses the paid mark on J186's $6,200.00 bill",
      'That bill is sent back and J186 is Ready to Bill, so a fresh bill with a new number goes out',
      "The $6,200.00 check pays J922's $6,200.00 bill. Stripe closes that bill the next morning, since the check is over seven days old",
      'Both jobs get the grey line: moved → J922',
    ])
  })
  it('a fresh check names its day; other payments close at once or pay part; a plain bill is just paid', () => {
    expect(stripeHeldMoveSteps({ ...base, paidOnYmd: '2026-10-05', landing: bill() })[2]).toBe("The $6,200.00 check pays J922's $6,200.00 bill. Stripe closes that bill Oct 12, once the check has cleared")
    expect(stripeHeldMoveSteps({ ...base, noun: 'payment', paymentType: 'Cash', landing: bill() })[2]).toBe("The $6,200.00 payment pays J922's $6,200.00 bill, and Stripe closes that bill at once")
    expect(stripeHeldMoveSteps({ ...base, landing: bill({ billAmount: 9000, remaining: 9000 }) })[2]).toBe("The $6,200.00 check pays part of J922's $9,000.00 bill, and its pay link asks for the rest")
    expect(stripeHeldMoveSteps({ ...base, noun: 'payment', paymentType: 'Cash', landing: bill({ stripeHosted: false }) })[2]).toBe("The $6,200.00 payment pays J922's $6,200.00 bill")
    expect(stripeHeldMoveSteps({ ...base, landing: bill({ stripeHosted: false, billAmount: 9000, remaining: 9000 }) })[2]).toBe("The $6,200.00 check pays part of J922's $9,000.00 bill")
    expect(stripeHeldMoveSteps({ ...base, landing: { kind: 'job' } })[2]).toBe('The $6,200.00 check lands on J922 under Other money, with no bill picked')
    expect(stripeHeldMoveSteps({ ...base, landing: null })[2]).toBe('The $6,200.00 check lands on J922')
  })
})

describe('when a step stops', () => {
  const args = { fromLabel: 'J186', toLabel: 'J922', amount: 6200, paidOn: '2025-10-28', reference: '1042', message: 'Stripe timed out', noun: 'check' as const }
  it('says what is done and what is left by hand', () => {
    expect(stripeHeldMoveStoppedWords('send_back', args)).toBe(
      "The paid mark is reversed and the payment is off J186, but its bill did not go back: Stripe timed out. Open View bill on J186's Billed row and press Check didn't clear · send back…, then record the $6,200.00 check 1042 dated 2025-10-28 on J922 by hand.",
    )
    expect(stripeHeldMoveStoppedWords('land', args)).toBe('J186 is sent back, but the check did not land: Stripe timed out. Record the $6,200.00 check 1042 dated 2025-10-28 on J922 by hand.')
    expect(stripeHeldMoveStoppedWords('close', { ...args, noun: 'payment' })).toBe(
      "The payment is on J922's bill, but Stripe did not close that bill: Stripe timed out. Mark it paid out of band in the Stripe Dashboard so its pay link cannot be paid again.",
    )
    expect(stripeHeldMoveStoppedWords('trace', args)).toBe('The check is on J922, but the grey line could not be written: Stripe timed out.')
  })
  it('the event row carries the snapshot, the landed row and the office’s reason alone', () => {
    const ev = heldMoveEventRow({ snapshot: row(), fromJobId: 'j186', toJobId: 'j922', landedPaymentId: 'p9', reason: 'wrong job', actorUserId: 'u1', actorName: 'Taunya' })
    expect(ev).toMatchObject({ kind: 'moved', payment_id: 'p9', from_job_id: 'j186', to_job_id: 'j922', amount: 6200, paid_on: '2025-10-28', payment_type: 'Check', reference_number: '1042', invoice_id: 'inv-s', reason: 'wrong job', actor_name: 'Taunya' })
    expect(heldMoveEventRow({ snapshot: row(), fromJobId: 'j186', toJobId: 'j922', landedPaymentId: null, reason: '  ', actorUserId: null, actorName: null }).reason).toBeNull()
  })
})
