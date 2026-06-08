import { describe, expect, it } from 'vitest'
import type { JobStripeEmailSendRow } from './fetchJobStripeEmailSendsForJobLedger'
import { stripeEmailSendsToActivityItems } from './jobThreadInvoiceEmailActivity'

const row = (over: Partial<JobStripeEmailSendRow>): JobStripeEmailSendRow => ({
  id: 'e1',
  jobs_ledger_invoice_id: 'inv1',
  sent_at: '2026-06-03T15:00:00Z',
  ...over,
})

describe('stripeEmailSendsToActivityItems', () => {
  it('maps sends to financial email events and skips null sent_at', () => {
    const items = stripeEmailSendsToActivityItems([row({ id: 'a' }), row({ id: 'b', sent_at: null })])
    expect(items.map((i) => i.event.dedupeKey)).toEqual(['ev:stripeemail:a'])
    expect(items[0]!.event.type).toBe('invoice_stripe_email_sent')
    expect(items[0]!.event.financial).toBe(true)
    expect(items[0]!.event.summary).toContain('emailed')
  })
})
