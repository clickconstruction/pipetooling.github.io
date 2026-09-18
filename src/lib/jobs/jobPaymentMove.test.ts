import { describe, expect, it } from 'vitest'
import { jobPaymentTraceLines, paymentMoveBlock, paymentMoveBlockText, planJobPaymentMove } from './jobPaymentMove'
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
    const stripe = job([{ id: 'i3', amount: 5000, sent_to_customer_at: null, stripe_invoice_id: 'in_1', external_send_channel: null }])
    expect(paymentMoveBlock(row({ invoice_id: 'i3' }), stripe, true)).toBe('stripe')
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
