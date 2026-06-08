import { describe, expect, it } from 'vitest'
import type { JobPaymentRow } from './fetchJobPaymentsForJobLedger'
import { paymentsToActivityItems } from './jobThreadPaymentActivity'

const row = (over: Partial<JobPaymentRow>): JobPaymentRow =>
  ({
    id: 'p1',
    amount: 2500,
    created_at: '2026-06-03T15:00:00Z',
    paid_on: '2026-06-02',
    note: null,
    payment_type: 'check',
    reference_number: '1041',
    ...over,
  }) as JobPaymentRow

describe('paymentsToActivityItems', () => {
  it('formats amount + type + ref, financial, paid_on drives sort', () => {
    const [it0] = paymentsToActivityItems([row({ id: 'x' })])
    expect(it0!.event.type).toBe('payment_added')
    expect(it0!.event.dedupeKey).toBe('ev:payment:x')
    expect(it0!.event.summary).toBe('Payment $2,500.00 (check · 1041)')
    expect(it0!.event.financial).toBe(true)
    expect(it0!.event.occurredAt).toBe(new Date('2026-06-02T12:00:00').toISOString())
  })

  it('falls back to created_at when no paid_on; omits qualifier when no type/ref', () => {
    const [it0] = paymentsToActivityItems([
      row({ paid_on: null, payment_type: null, reference_number: null, amount: 100 }),
    ])
    expect(it0!.event.occurredAt).toBe('2026-06-03T15:00:00Z')
    expect(it0!.event.summary).toBe('Payment $100.00')
  })
})
