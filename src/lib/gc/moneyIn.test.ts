/** Money in on Bill the customer, in words (./moneyIn.ts). */
import { describe, expect, it } from 'vitest'
import { GC_PROMISE_CHANNELS, payDueWords, paymentRefusalWords } from './moneyIn'

describe('money in, in words', () => {
  it('says when a certified bill is due: promised, expected, or late by how many days', () => {
    expect(payDueWords({ on: '2026-10-26', promised: true, daysLate: 0, missed: 0 })).toBe('promised Oct 26')
    expect(payDueWords({ on: '2026-10-26', promised: false, daysLate: 0, missed: 0 })).toBe('expected Oct 26')
    expect(payDueWords({ on: '2026-10-26', promised: true, daysLate: 1, missed: 0 })).toBe('late · promised Oct 26, 1 day ago')
    expect(payDueWords({ on: '2026-10-26', promised: false, daysLate: 3, missed: 0 })).toBe('late · expected Oct 26, 3 days ago')
    expect(payDueWords({ on: null, promised: false, daysLate: 0, missed: 0 })).toBe('no day to expect it yet')
  })

  it('turns each refusal mark_invoice_paid answers into the window\'s words, and keeps one it has not seen', () => {
    expect(paymentRefusalWords('Amount exceeds remaining balance on invoice')).toBe('That is more than is open on the bill.')
    expect(paymentRefusalWords('Invoice already fully paid')).toBe('That bill is paid in full already.')
    expect(paymentRefusalWords('Something new')).toBe('Something new')
  })

  it('offers the four ways they could have told us, each one add_job_payment_promise takes', () => {
    expect(GC_PROMISE_CHANNELS.map((c) => c.value)).toEqual(['phone', 'text', 'email', 'in_person'])
  })
})
