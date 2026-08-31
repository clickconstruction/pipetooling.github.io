import { describe, expect, it } from 'vitest'
import { referenceGrade, referenceQualityFlags } from './referenceGrade'

describe('referenceGrade', () => {
  const p = (hasPlans: boolean, hasValue: boolean, hasCounts: boolean, hasPricing: boolean) => ({ hasPlans, hasValue, hasCounts, hasPricing })

  it('grades the five tiers', () => {
    expect(referenceGrade(p(true, true, true, true))).toBe('A')
    expect(referenceGrade(p(true, true, false, false))).toBe('B')
    expect(referenceGrade(p(true, true, true, false))).toBe('B')
    expect(referenceGrade(p(true, false, true, true))).toBe('C')
    expect(referenceGrade(p(true, false, false, false))).toBe('D')
    expect(referenceGrade(p(false, true, true, true))).toBe('X')
  })
})

describe('referenceQualityFlags', () => {
  const base = { bid_value: 123456.78, outcome: 'won', loss_category: null, when: '2026-08-01' }
  const today = '2026-09-01'

  it('a fresh, precise, won reference is gate-eligible', () => {
    expect(referenceQualityFlags(base, today)).toMatchObject({ roundValue: false, weakLoss: false, lossUncategorized: false, stale: false, gateEligible: true })
  })

  it('round-to-$100 values are flagged (BT-11 b34)', () => {
    expect(referenceQualityFlags({ ...base, bid_value: 33500 }, today)).toMatchObject({ roundValue: true, gateEligible: false })
    expect(referenceQualityFlags({ ...base, bid_value: 33512 }, today).roundValue).toBe(false)
  })

  it('no_bid / project_died losses are weak; uncategorized losses flagged separately', () => {
    expect(referenceQualityFlags({ ...base, bid_value: 615268.06, outcome: 'lost', loss_category: 'no_bid' }, today)).toMatchObject({ weakLoss: true, gateEligible: false })
    expect(referenceQualityFlags({ ...base, bid_value: 615268.06, outcome: 'lost', loss_category: 'price' }, today)).toMatchObject({ weakLoss: false, gateEligible: true })
    expect(referenceQualityFlags({ ...base, bid_value: 615268.06, outcome: 'lost', loss_category: null }, today)).toMatchObject({ lossUncategorized: true, gateEligible: false })
  })

  it('references older than ~6 months are stale (BT-11)', () => {
    expect(referenceQualityFlags({ ...base, when: '2025-11-01' }, today)).toMatchObject({ stale: true, gateEligible: false })
  })
})
