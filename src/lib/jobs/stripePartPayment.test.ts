import { describe, expect, it } from 'vitest'
import {
  stripeCreditLineText,
  stripePartPaymentNote,
  stripePaymentBlocker,
  stripePaymentButtonLabel,
  stripePaymentPlan,
} from './stripePartPayment'

describe('stripePaymentPlan', () => {
  it('reads the typed amount against the open balance', () => {
    expect(stripePaymentPlan('', 1500)).toEqual({ kind: 'empty' })
    expect(stripePaymentPlan('0', 1500)).toEqual({ kind: 'empty' })
    expect(stripePaymentPlan('abc', 1500)).toEqual({ kind: 'empty' })
    expect(stripePaymentPlan('1,500', 1500)).toEqual({ kind: 'full', amount: 1500 })
    expect(stripePaymentPlan(1500.004, 1500)).toEqual({ kind: 'full', amount: 1500 })
    expect(stripePaymentPlan('1000', 1500)).toEqual({ kind: 'part', amount: 1000, staysDue: 500 })
    expect(stripePaymentPlan('1500.01', 1500)).toEqual({ kind: 'over', remaining: 1500 })
  })

  it('keeps cents honest on the remainder', () => {
    expect(stripePaymentPlan('0.1', 0.3)).toEqual({ kind: 'part', amount: 0.1, staysDue: 0.2 })
  })
})

describe('words', () => {
  const part = stripePaymentPlan('1000', 1500)
  it('names the credit line the customer will read', () => {
    expect(stripeCreditLineText('Cash', '2026-09-21', 1000)).toBe('Cash received Sep 21 · $1,000.00')
    expect(stripeCreditLineText('Check', '2026-09-21', 1000, '1234')).toBe('Check #1234 received Sep 21 · $1,000.00')
    expect(stripeCreditLineText('', 'today', 5)).toBe('Payment received today · $5.00')
  })

  it('explains a part payment and labels the button with both numbers', () => {
    if (part.kind !== 'part') throw new Error('expected part')
    expect(stripePartPaymentNote(part, 'Cash received Sep 21 · $1,000.00')).toBe(
      'Part payment. Stripe lowers the bill to $500.00 due. The pay link shows the new balance with a line that reads “Cash received Sep 21 · $1,000.00”. The rest can be paid online, or recorded here later.',
    )
    expect(stripePaymentButtonLabel(part)).toBe('Record $1,000.00 · $500.00 stays due')
    expect(stripePaymentButtonLabel(stripePaymentPlan('1500', 1500))).toBe('Record $1,500.00')
    expect(stripePaymentButtonLabel(stripePaymentPlan('', 1500))).toBe('Confirm')
  })

  it('blocks empty and over, never full or part', () => {
    expect(stripePaymentBlocker(stripePaymentPlan('', 1500))).toMatch(/greater than 0/)
    expect(stripePaymentBlocker(stripePaymentPlan('2000', 1500))).toMatch(/more than the \$1,500\.00 open/)
    expect(stripePaymentBlocker(stripePaymentPlan('1500', 1500))).toBeNull()
    expect(stripePaymentBlocker(part)).toBeNull()
  })
})
