import { describe, expect, it } from 'vitest'
import {
  debitFailedCaseArgs,
  disputeCaseArgs,
  STRIPE_DEBIT_REASON_MAX,
  stripeCaseDashboardUrl,
  stripeDisputeReasonWords,
} from '../../../supabase/functions/_shared/stripeArCase'
import { helpGuidePlainWordsFailures } from '../plainWords'

// 2026-10-08 15:00 UTC and 2026-10-20 05:00 UTC, as Stripe's epoch seconds.
const RAISED = Date.UTC(2026, 9, 8, 15) / 1000
const DUE = Date.UTC(2026, 9, 20, 5) / 1000

describe('stripeArCase — a card dispute or a failed bank debit, as record_ar_stripe_case reads it (v2.4950)', () => {
  it('a dispute: the charge, the bill, dollars from cents, Stripe\'s reason and status, the due day', () => {
    expect(
      disputeCaseArgs(
        { id: 'dp_1', amount: 50050, charge: { id: 'ch_1' }, reason: 'fraudulent', status: 'needs_response', created: RAISED, evidence_details: { due_by: DUE } },
        'test',
        'in_1',
      ),
    ).toEqual({
      p_kind: 'dispute',
      p_object_id: 'dp_1',
      p_mode: 'test',
      p_charge_id: 'ch_1',
      p_stripe_invoice_id: 'in_1',
      p_amount: 500.5,
      p_reason: 'fraudulent',
      p_status: 'needs_response',
      p_due_by: '2026-10-20T05:00:00.000Z',
      p_occurred_at: '2026-10-08T15:00:00.000Z',
    })
  })

  it('a dispute on a charge that paid no bill of ours is nothing', () => {
    expect(disputeCaseArgs({ id: 'dp_2', amount: 100, charge: 'ch_2' }, 'live', null)).toBeNull()
    expect(disputeCaseArgs({ id: 'dp_2', amount: 100, charge: 'ch_2' }, 'live', '  ')).toBeNull()
  })

  it('a dispute with no due day or created stamp still reads', () => {
    const a = disputeCaseArgs({ id: 'dp_3', amount: 100, charge: 'ch_3', status: 'lost' }, 'live', 'in_3')
    expect(a).toMatchObject({ p_charge_id: 'ch_3', p_due_by: null, p_occurred_at: null, p_reason: null, p_status: 'lost' })
  })

  it('a failed bank debit on a bill is a case; Stripe\'s words come along, cut to one line', () => {
    const long = `The customer's bank account has insufficient funds. ${'x'.repeat(300)}`
    const a = debitFailedCaseArgs(
      { id: 'pi_1', amount: 120000, invoice: 'in_9', payment_method_types: ['card', 'us_bank_account'], last_payment_error: { message: long, payment_method: { type: 'us_bank_account' } } },
      'live',
      RAISED,
    )
    expect(a).toMatchObject({ p_kind: 'debit_failed', p_object_id: 'pi_1', p_stripe_invoice_id: 'in_9', p_amount: 1200, p_status: 'failed', p_charge_id: null, p_due_by: null, p_occurred_at: '2026-10-08T15:00:00.000Z' })
    expect(a?.p_reason?.length).toBe(STRIPE_DEBIT_REASON_MAX)
  })

  it('a card that fails, or a payment with no bill, is not a case', () => {
    expect(debitFailedCaseArgs({ id: 'pi_2', amount: 100, invoice: 'in_9', last_payment_error: { message: 'Your card was declined.', payment_method: { type: 'card' } } }, 'live')).toBeNull()
    expect(debitFailedCaseArgs({ id: 'pi_3', amount: 100, invoice: null, last_payment_error: { payment_method: { type: 'us_bank_account' } } }, 'live')).toBeNull()
  })

  it('with no payment method on the error, a payment that only takes a bank debit counts', () => {
    expect(debitFailedCaseArgs({ id: 'pi_4', amount: 100, invoice: { id: 'in_4' }, payment_method_types: ['us_bank_account'] }, 'test')).toMatchObject({ p_stripe_invoice_id: 'in_4' })
    expect(debitFailedCaseArgs({ id: 'pi_5', amount: 100, invoice: 'in_5', payment_method_types: ['card', 'us_bank_account'] }, 'test')).toBeNull()
  })

  it('every dispute reason reads as one plain sentence; an unknown one says so', () => {
    const codes = ['fraudulent', 'unrecognized', 'duplicate', 'product_not_received', 'product_unacceptable', 'credit_not_processed', 'subscription_canceled', 'debit_not_authorized', 'customer_initiated', 'incorrect_account_details', 'insufficient_funds', 'bank_cannot_process', 'general', null]
    for (const code of codes) {
      const words = stripeDisputeReasonWords(code)
      expect(words).toMatch(/^[A-Z].*\.$/)
      expect(helpGuidePlainWordsFailures(`---\ntitle: x\n---\n${words}\n`)).toEqual([])
    }
    expect(stripeDisputeReasonWords('general')).toBe('They gave no reason Stripe could name.')
  })

  it('opens the dispute or the payment in Stripe, test or live', () => {
    expect(stripeCaseDashboardUrl('dispute', 'dp_1', 'test')).toBe('https://dashboard.stripe.com/test/disputes/dp_1')
    expect(stripeCaseDashboardUrl('dispute', 'dp_1', 'live')).toBe('https://dashboard.stripe.com/disputes/dp_1')
    expect(stripeCaseDashboardUrl('debit_failed', 'pi_1', null)).toBe('https://dashboard.stripe.com/payments/pi_1')
  })
})
