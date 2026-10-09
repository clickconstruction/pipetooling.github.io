import { describe, expect, it } from 'vitest'
import { jobPaymentRemovedReasonWords, jobPaymentTraceLines, paymentMoveBlock, paymentMoveBlockText, paymentMoveReason, planJobPaymentMove } from './jobPaymentMove'
import type { JobPaymentEvent } from './jobPaymentMove'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { PaymentRow } from './jobFormTypes'

const row = (over: Partial<PaymentRow> = {}): PaymentRow => ({ id: 'p1', amount: 2400, paid_on: '2026-09-10', sent_on: null, note: null, payment_type: 'check', reference_number: '1044', invoice_id: null, mercury_transaction_id: null, ...over })
const job = (invoices: Array<Record<string, unknown>>): JobWithDetails => ({ id: 'j880', invoices } as unknown as JobWithDetails)

describe('paymentMoveBlock (v2.3576)', () => {
  it('a saved manual or bank-linked payment moves; an unsaved draft does not', () => {
    expect(paymentMoveBlock(row(), job([]), true)).toBeNull()
    expect(paymentMoveBlock(row({ mercury_transaction_id: 'tx1' }), job([]), true)).toBeNull()
    expect(paymentMoveBlock(row(), job([]), false)).toBe('unsaved')
  })
  it('a payment a SENT bill counted stays; on an unsent bill it moves; a Stripe bill\'s stays with Stripe', () => {
    const sent = job([{ id: 'i3', amount: 5000, sent_to_customer_at: '2026-09-01T00:00:00Z', stripe_invoice_id: null, external_send_channel: null }])
    expect(paymentMoveBlock(row({ invoice_id: 'i3' }), sent, true)).toBe('sent-bill')
    const unsent = job([{ id: 'i3', amount: 5000, sent_to_customer_at: null, stripe_invoice_id: null, external_send_channel: null }])
    expect(paymentMoveBlock(row({ invoice_id: 'i3' }), unsent, true)).toBeNull()
    const stripe = job([{ id: 'i3', amount: 5000, sent_to_customer_at: null, stripe_invoice_id: 'in_1', external_send_channel: null, stripe_invoice_status: 'paid' }])
    expect(paymentMoveBlock(row({ invoice_id: 'i3' }), stripe, true)).toBe('stripe')
  })
  it('v2.4801: a check held on a Stripe bill Stripe has not closed moves, sent or not; a credit-note row stays', () => {
    const held = job([{ id: 'i3', amount: 5000, status: 'paid', sent_to_customer_at: '2026-09-01T00:00:00Z', stripe_invoice_id: 'in_1', external_send_channel: 'stripe', stripe_invoice_status: 'open' }])
    expect(paymentMoveBlock(row({ invoice_id: 'i3' }), held, true)).toBeNull()
    expect(paymentMoveBlock(row({ invoice_id: 'i3', stripe_credit_note_id: 'cn_1' }), held, true)).toBe('stripe')
    expect(paymentMoveBlockText('sent-bill', 5000)).toBe('A sent bill counted it — unlink it from the $5,000 bill first')
  })
})

describe('planJobPaymentMove', () => {
  it('moves the dollars from one job\'s paid to the other\'s and says when the destination is paid in full', () => {
    const plan = planJobPaymentMove({ amountUsd: 2400, from: { label: 'J880', revenueUsd: 10000, paidUsd: 4400 }, to: { label: 'J922', revenueUsd: 3000, paidUsd: 600 } })
    expect(plan.from).toEqual({ label: 'J880', paidBefore: 4400, paidAfter: 2000, openBefore: 5600, openAfter: 8000 })
    expect(plan.to).toEqual({ label: 'J922', paidBefore: 600, paidAfter: 3000, openBefore: 2400, openAfter: 0 })
    expect(plan.toPaidInFull).toBe(true)
  })
})

describe('jobPaymentTraceLines', () => {
  const ev = (over: Partial<Parameters<typeof jobPaymentTraceLines>[0][number]> = {}) => ({ id: 'e1', kind: 'moved', payment_id: 'p1', from_job_id: 'j880', to_job_id: 'j922', amount: 2400, paid_on: '2026-09-10', reason: 'wrong job', actor_name: 'Taunya', created_at: '2026-09-17T15:00:00Z', ...over })
  const label = (id: string) => (id === 'j922' ? 'J922 · Michael Palmer' : 'J880 · Reliant')
  const money = (n: number) => `$${n.toFixed(2)}`
  it('reads out on the job it left and in on the job it reached, with who and why', () => {
    expect(jobPaymentTraceLines([ev()], 'j880', label, money)).toEqual([{ id: 'e1', direction: 'out', text: '$2400.00 moved → J922 · Michael Palmer · Taunya · wrong job' }])
    expect(jobPaymentTraceLines([ev()], 'j922', label, money)).toEqual([{ id: 'e1', direction: 'in', text: '$2400.00 moved here from J880 · Reliant · Taunya · wrong job' }])
    expect(jobPaymentTraceLines([ev({ reason: null, actor_name: null })], 'j880', label, money)[0]!.text).toBe('$2400.00 moved → J922 · Michael Palmer')
    expect(jobPaymentTraceLines([ev()], 'j000', label, money)).toEqual([])
  })
})

describe('jobPaymentTraceLines — a payment moved here and later removed (the owner\'s call of 2026-10-09)', () => {
  // J907 from punch list #22's walk: $1.00 moved J904 → J907, then removed on J907. Remove stored *unlinked*; no bill held it.
  const moved: JobPaymentEvent = { id: 'm1', kind: 'moved', payment_id: 'p9', from_job_id: 'j904', to_job_id: 'j907', invoice_id: null, amount: 1, paid_on: '2026-10-08', reason: 'wrong job', actor_name: 'Robert', created_at: '2026-10-08T15:00:00Z' }
  const removed: JobPaymentEvent = { id: 'r1', kind: 'removed', payment_id: 'p9', from_job_id: 'j907', to_job_id: null, invoice_id: null, amount: 1, paid_on: '2026-10-08', reason: 'unlinked', actor_name: 'Robert', created_at: '2026-10-08T15:05:00Z' }
  const label = (id: string) => (id === 'j904' ? 'J904 · ZZ TEST held check A' : 'J907 · ZZ TEST held check B')
  const money = (n: number) => `$${n.toFixed(2)}`
  const arrived = { id: 'm1', direction: 'in', text: '$1.00 moved here from J904 · ZZ TEST held check A · Robert · wrong job' }

  it('draws *$1.00 removed · Robert* right under its moved-here line, never *unlinked*, whatever order the events come in', () => {
    const want = [arrived, { id: 'r1', direction: 'removed', text: '$1.00 removed · Robert' }]
    expect(jobPaymentTraceLines([removed, moved], 'j907', label, money)).toEqual(want)
    expect(jobPaymentTraceLines([moved, removed], 'j907', label, money)).toEqual(want)
    // The job it left keeps its one moved line.
    expect(jobPaymentTraceLines([removed, moved], 'j904', label, money)).toEqual([{ id: 'm1', direction: 'out', text: '$1.00 moved → J907 · ZZ TEST held check B · Robert · wrong job' }])
  })
  it('a removal that never moved here draws nothing, as before', () => {
    expect(jobPaymentTraceLines([{ ...removed, payment_id: 'p-other' }, moved], 'j907', label, money)).toEqual([arrived])
    expect(jobPaymentTraceLines([{ ...removed, payment_id: null }, moved], 'j907', label, money)).toEqual([arrived])
    expect(jobPaymentTraceLines([removed], 'j907', label, money)).toEqual([])
    expect(jobPaymentTraceLines([{ ...removed, from_job_id: 'j904' }, moved], 'j907', label, money)).toEqual([arrived])
  })
  it('goes under the latest arrival when the payment came here twice', () => {
    const in1 = { ...moved, id: 'm1', created_at: '2026-10-08T10:00:00Z' }
    const back = { ...moved, id: 'm2', from_job_id: 'j907', to_job_id: 'j904', created_at: '2026-10-08T11:00:00Z' }
    const in2 = { ...moved, id: 'm3', created_at: '2026-10-08T12:00:00Z' }
    const gone = { ...removed, created_at: '2026-10-08T13:00:00Z' }
    expect(jobPaymentTraceLines([gone, in2, back, in1], 'j907', label, money).map((l) => l.id)).toEqual(['m3', 'r1', 'm2', 'm1'])
    expect(jobPaymentTraceLines([in1, back, in2, gone], 'j907', label, money).map((l) => l.id)).toEqual(['m1', 'm2', 'm3', 'r1'])
  })
  it('a bill that held it, the bank and a typed reason read as words; no one named reads as the amount alone', () => {
    expect(jobPaymentTraceLines([{ ...removed, invoice_id: 'inv-1' }, moved], 'j907', label, money)[1]!.text).toBe('$1.00 removed · Robert · unlinked from its bill')
    expect(jobPaymentTraceLines([{ ...removed, actor_name: null }, moved], 'j907', label, money)[1]!.text).toBe('$1.00 removed')
    expect(jobPaymentRemovedReasonWords('unlinked', false)).toBeNull()
    expect(jobPaymentRemovedReasonWords('unlinked', true)).toBe('unlinked from its bill')
    expect(jobPaymentRemovedReasonWords('unlinked_stripe_bill_unrecorded', true)).toBe('unlinked from its Stripe bill')
    expect(jobPaymentRemovedReasonWords('bank_failed', false)).toBe('the bank returned it')
    expect(jobPaymentRemovedReasonWords('bank_failed: Insufficient funds', false)).toBe('the bank returned it · Insufficient funds')
    expect(jobPaymentRemovedReasonWords('  customer paid twice ', false)).toBe('customer paid twice')
    expect(jobPaymentRemovedReasonWords(null, true)).toBeNull()
    expect(jobPaymentRemovedReasonWords('   ', true)).toBeNull()
  })
})

describe('paymentMoveReason (v2.4895)', () => {
  it('records what was typed, else wrong job — never the default with the typing run onto it', () => {
    expect(paymentMoveReason('customer paid twice')).toBe('customer paid twice')
    expect(paymentMoveReason('  duplicate  ')).toBe('duplicate')
    expect(paymentMoveReason('')).toBe('wrong job')
    expect(paymentMoveReason('   ')).toBe('wrong job')
    expect(paymentMoveReason(null)).toBe('wrong job')
  })
})
