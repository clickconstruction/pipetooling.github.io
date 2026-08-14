import { describe, expect, it } from 'vitest'
import {
  allStripeAllocationsAutoClose,
  arStripeAutoCloseCandidates,
  type ArStripeAutoCloseTarget,
} from './arStripeAutoClose'

function targets(entries: Record<string, ArStripeAutoCloseTarget>): Map<string, ArStripeAutoCloseTarget> {
  return new Map(Object.entries(entries))
}

const STRIPE_600: ArStripeAutoCloseTarget = {
  stripeHosted: true,
  remaining: 600,
  invoiceId: 'inv-1',
  label: 'Invoice #2 · Stripe',
}
const PLAIN_400: ArStripeAutoCloseTarget = {
  stripeHosted: false,
  remaining: 400,
  invoiceId: 'inv-2',
  label: 'Invoice #3',
}

describe('arStripeAutoCloseCandidates', () => {
  it('returns an exact-match Stripe-hosted allocation', () => {
    const out = arStripeAutoCloseCandidates(
      [{ kind: 'billed', targetKey: 'a', amount: 600 }],
      targets({ a: STRIPE_600 }),
    )
    expect(out).toEqual([{ invoiceId: 'inv-1', amountDollars: 600, label: 'Invoice #2 · Stripe' }])
  })

  it('ignores partial coverage, non-Stripe targets, payment-kind lines, and empty lines', () => {
    const out = arStripeAutoCloseCandidates(
      [
        { kind: 'billed', targetKey: 'a', amount: 599.98 },
        { kind: 'billed', targetKey: 'b', amount: 400 },
        { kind: 'payment', targetKey: 'p1', amount: 600 },
        { kind: 'billed', targetKey: null, amount: 600 },
        { kind: 'billed', targetKey: 'a', amount: NaN },
      ],
      targets({ a: STRIPE_600, b: PLAIN_400 }),
    )
    expect(out).toEqual([])
  })

  it('sums multiple lines against the same invoice before comparing', () => {
    const out = arStripeAutoCloseCandidates(
      [
        { kind: 'billed', targetKey: 'a', amount: 200 },
        { kind: 'billed', targetKey: 'a', amount: 400 },
      ],
      targets({ a: STRIPE_600 }),
    )
    expect(out).toHaveLength(1)
    expect(out[0]!.amountDollars).toBe(600)
  })

  it('tolerates sub-cent float drift', () => {
    const out = arStripeAutoCloseCandidates(
      [{ kind: 'billed', targetKey: 'a', amount: 0.1 + 0.2 }],
      targets({ a: { ...STRIPE_600, remaining: 0.3 } }),
    )
    expect(out).toHaveLength(1)
  })

  it('rejects a full-cent mismatch', () => {
    const out = arStripeAutoCloseCandidates(
      [{ kind: 'billed', targetKey: 'a', amount: 599.99 }],
      targets({ a: STRIPE_600 }),
    )
    expect(out).toEqual([])
  })
})

describe('allStripeAllocationsAutoClose', () => {
  it('true when every Stripe line is exactly covered', () => {
    expect(
      allStripeAllocationsAutoClose(
        [
          { kind: 'billed', targetKey: 'a', amount: 600 },
          { kind: 'billed', targetKey: 'b', amount: 100 },
        ],
        targets({ a: STRIPE_600, b: PLAIN_400 }),
      ),
    ).toBe(true)
  })

  it('false when a Stripe line is partial', () => {
    expect(
      allStripeAllocationsAutoClose(
        [{ kind: 'billed', targetKey: 'a', amount: 500 }],
        targets({ a: STRIPE_600 }),
      ),
    ).toBe(false)
  })

  it('false when no Stripe line is present at all', () => {
    expect(
      allStripeAllocationsAutoClose(
        [{ kind: 'billed', targetKey: 'b', amount: 400 }],
        targets({ b: PLAIN_400 }),
      ),
    ).toBe(false)
  })
})
