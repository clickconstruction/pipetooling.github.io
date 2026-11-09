import { describe, expect, it } from 'vitest'
import { IN_KIND_PAYMENT_TYPE, PAYMENT_KIND_CHOICES, inKindMemoMissing, inKindWindowNote, isInKindPayment, isInKindPaymentType } from './inKindPayment'
import { isCheckPayment } from './checkClearing'
import { instrumentWord } from './billsAndPayments'

describe('the kind (v2.6816)', () => {
  it('is offered beside the cash kinds, before Other', () => {
    expect(PAYMENT_KIND_CHOICES).toEqual(['Cash', 'Check', 'Wire', 'ACH', 'Card (external)', 'In kind', 'Other'])
    expect(IN_KIND_PAYMENT_TYPE).toBe('In kind')
  })
  it('reads the word however the office spells it, and nothing else', () => {
    for (const t of ['In kind', 'in kind', 'in-kind', 'IN KIND', 'inkind', 'Rent credit (in kind)', ' in kind ']) {
      expect(isInKindPaymentType(t), t).toBe(true)
    }
    for (const t of ['Cash', 'Check', 'Other', 'kind of a check', 'Kind', 'Skin kind', '', null, undefined]) {
      expect(isInKindPaymentType(t), String(t)).toBe(false)
    }
    expect(isInKindPayment({ payment_type: 'In kind' })).toBe(true)
    expect(isInKindPayment({ payment_type: null })).toBe(false)
  })
  it('is never a check, so the drawer and the clearing wait never see it', () => {
    expect(isCheckPayment({ payment_type: 'In kind' })).toBe(false)
  })
  it('is its own instrument word, so a chip can say it', () => {
    expect(instrumentWord('In kind')).toBe('in kind')
    expect(instrumentWord('in-kind')).toBe('in kind')
  })
})

describe('the memo', () => {
  it('is asked for on an in-kind row and on no other', () => {
    expect(inKindMemoMissing({ payment_type: 'In kind', note: null })).toBe(true)
    expect(inKindMemoMissing({ payment_type: 'In kind', note: '   ' })).toBe(true)
    expect(inKindMemoMissing({ payment_type: 'In kind', note: 'Rent credit, March 2026' })).toBe(false)
    expect(inKindMemoMissing({ payment_type: 'Cash', note: null })).toBe(false)
  })
})

describe('the words under the kind', () => {
  it('say what it counts as, and what Stripe does on each path', () => {
    const plain = inKindWindowNote({ stripeHosted: false, planKind: null })
    expect(plain).toContain('never counted as money in the bank')
    expect(plain).not.toMatch(/stripe/i)
    expect(inKindWindowNote({ stripeHosted: true, planKind: 'part' })).toContain('credit line')
    expect(inKindWindowNote({ stripeHosted: true, planKind: 'full' })).toContain('pay link stops working')
    for (const kind of [null, 'part', 'full']) {
      expect(inKindWindowNote({ stripeHosted: true, planKind: kind })).not.toMatch(/cash|received/i)
    }
  })
})
