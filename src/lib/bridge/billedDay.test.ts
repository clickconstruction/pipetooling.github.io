import { describe, expect, it } from 'vitest'
import { invoiceBilledYmd } from './billedDay'

describe('invoiceBilledYmd (v2.5833)', () => {
  it('reads the day a bill went out when it was sent', () => {
    expect(invoiceBilledYmd({ sent_to_customer_at: '2026-10-07T18:00:00+00:00', billed_at: '2026-09-24T18:00:00+00:00' })).toBe('2026-10-07')
  })

  it('reads the day a bill was marked billed when it never went out through the app', () => {
    // A pay application on the GC's portal, marked billed by hand: $103,386 on Sep 24, no send.
    expect(invoiceBilledYmd({ sent_to_customer_at: null, billed_at: '2026-09-24T18:00:00+00:00' })).toBe('2026-09-24')
  })

  it('is null for a draft with neither', () => {
    expect(invoiceBilledYmd({ sent_to_customer_at: null, billed_at: null })).toBeNull()
    expect(invoiceBilledYmd({ sent_to_customer_at: '', billed_at: null })).toBeNull()
  })
})
