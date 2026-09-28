import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { PaymentRow } from './jobFormTypes'
import {
  mergePaymentRowUpdate,
  paymentRemoveRefusalWords,
  paymentRemoveWritesNow,
  paymentRowsAfterRemove,
  planPaymentRemoveRequest,
  removePaymentReply,
} from './jobFormPaymentActions'

const pay = (over: Partial<PaymentRow> & { id: string }): PaymentRow => ({
  amount: 100,
  paid_on: '2026-09-01',
  sent_on: null,
  note: null,
  payment_type: 'check',
  reference_number: null,
  invoice_id: null,
  mercury_transaction_id: null,
  ...over,
})
/** A job with one plain invoice and one Stripe bill. */
const job = {
  id: 'job-1',
  invoices: [
    { id: 'inv-plain', status: 'billed', amount: 500, stripe_invoice_id: null },
    { id: 'inv-stripe', status: 'billed', amount: 500, stripe_invoice_id: 'in_123', stripe_invoice_status: 'open' },
  ],
} as unknown as JobWithDetails

const manual = pay({ id: 'p-manual' })
const bank = pay({ id: 'p-bank', mercury_transaction_id: 'mtx-1' })
const onInvoice = pay({ id: 'p-inv', invoice_id: 'inv-plain' })
const onStripe = pay({ id: 'p-stripe', invoice_id: 'inv-stripe' })
const blank = (): PaymentRow => pay({ id: 'fresh', amount: 0, paid_on: null, payment_type: null })

describe('mergePaymentRowUpdate', () => {
  it('a manual line takes the whole edit', () => {
    expect(mergePaymentRowUpdate(manual, { amount: 250, paid_on: '2026-09-09', note: 'deposit' }, job)).toMatchObject({ amount: 250, paid_on: '2026-09-09', note: 'deposit' })
  })

  it('a bank-matched line keeps its amount, date and links; the rest of the edit lands', () => {
    const out = mergePaymentRowUpdate(bank, { amount: 1, paid_on: '2020-01-01', mercury_transaction_id: null, invoice_id: 'inv-plain', note: 'n', reference_number: '1042' }, job)
    expect(out).toMatchObject({ amount: 100, paid_on: '2026-09-01', mercury_transaction_id: 'mtx-1', invoice_id: null, note: 'n', reference_number: '1042' })
  })

  it('a line on a Stripe bill is frozen the same way; one on a plain invoice is not', () => {
    expect(mergePaymentRowUpdate(onStripe, { amount: 1, invoice_id: null }, job)).toMatchObject({ amount: 100, invoice_id: 'inv-stripe' })
    expect(mergePaymentRowUpdate(onInvoice, { amount: 1 }, job).amount).toBe(1)
  })

  it('with no job open nothing reads as a Stripe bill', () => {
    expect(mergePaymentRowUpdate(onStripe, { amount: 1 }, null).amount).toBe(1)
  })
})

describe('paymentRowsAfterRemove', () => {
  it('drops a manual line', () => {
    expect(paymentRowsAfterRemove([manual, bank], 'p-manual', job, blank).map((r) => r.id)).toEqual(['p-bank'])
  })

  it('an emptied list is one fresh line', () => {
    expect(paymentRowsAfterRemove([manual], 'p-manual', job, blank).map((r) => r.id)).toEqual(['fresh'])
  })

  it('hands back the same list for a linked line or one that is not there', () => {
    const rows = [manual, bank, onInvoice, onStripe]
    for (const id of ['p-bank', 'p-inv', 'p-stripe', 'p-missing']) expect(paymentRowsAfterRemove(rows, id, job, blank)).toBe(rows)
  })
})

describe('planPaymentRemoveRequest', () => {
  const saved = new Set(['p-manual', 'p-bank', 'p-inv', 'p-stripe'])
  const none = new Set<string>()

  it('refuses a bank-matched line and a line on a Stripe bill, saved or not', () => {
    expect(planPaymentRemoveRequest(bank, job, saved)).toBe('mercury-linked')
    expect(planPaymentRemoveRequest(bank, job, none)).toBe('mercury-linked')
    expect(planPaymentRemoveRequest(onStripe, job, saved)).toBe('stripe-bill')
  })

  it('a bank-matched line on a Stripe bill reads as the bank’s', () => {
    expect(planPaymentRemoveRequest(pay({ id: 'p-both', mercury_transaction_id: 'mtx-2', invoice_id: 'inv-stripe' }), job, saved)).toBe('mercury-linked')
  })

  it('opens the confirm for a manual line, saved or typed just now', () => {
    expect(planPaymentRemoveRequest(manual, job, saved)).toBe('confirm')
    expect(planPaymentRemoveRequest(manual, job, none)).toBe('confirm')
    expect(planPaymentRemoveRequest(manual, null, none)).toBe('confirm')
  })

  it('a line on a plain invoice: the confirm when it is saved, a refusal when it is not', () => {
    expect(planPaymentRemoveRequest(onInvoice, job, saved)).toBe('confirm')
    expect(planPaymentRemoveRequest(onInvoice, job, none)).toBe('invoice-linked')
    expect(planPaymentRemoveRequest(onInvoice, null, saved)).toBe('invoice-linked')
  })
})

describe('paymentRemoveRefusalWords', () => {
  it('says where each kind is removed instead', () => {
    expect(paymentRemoveRefusalWords('mercury-linked')).toContain('Bank Payments workflow')
    expect(paymentRemoveRefusalWords('stripe-bill')).toContain('Use Stripe reversal flows.')
    expect(paymentRemoveRefusalWords('invoice-linked')).toContain('Outstanding billing or the mark-paid flow')
  })
})

describe('paymentRemoveWritesNow', () => {
  const saved = new Set(['p-manual', 'p-bank', 'p-inv', 'p-stripe'])

  it('a saved manual line, or a saved line on a plain invoice, writes at once', () => {
    expect(paymentRemoveWritesNow(manual, job, saved)).toBe(true)
    expect(paymentRemoveWritesNow(onInvoice, job, saved)).toBe(true)
  })

  it('an unsaved line only leaves the form; a bank-matched line or one on a Stripe bill never writes here', () => {
    expect(paymentRemoveWritesNow(manual, job, new Set())).toBe(false)
    expect(paymentRemoveWritesNow(bank, job, saved)).toBe(false)
    expect(paymentRemoveWritesNow(onStripe, job, saved)).toBe(false)
  })
})

describe('removePaymentReply', () => {
  it('a non-empty error is a refusal', () => {
    expect(removePaymentReply({ error: 'Payment not found' })).toEqual({ kind: 'error', message: 'Payment not found' })
    expect(removePaymentReply({ error: 'Denied', warning: 'ignored' })).toEqual({ kind: 'error', message: 'Denied' })
  })

  it('a warning is a removal with a caveat', () => {
    expect(removePaymentReply({ ok: true, warning: 'Job moved back to Billed' })).toEqual({ kind: 'warning', message: 'Job moved back to Billed' })
  })

  it('anything else went through', () => {
    for (const raw of [{ ok: true }, { error: '' }, { error: 42 }, null, undefined, 'ok', { bank_failed: true, marked_returned: true }]) {
      expect(removePaymentReply(raw)).toEqual({ kind: 'ok' })
    }
  })
})
