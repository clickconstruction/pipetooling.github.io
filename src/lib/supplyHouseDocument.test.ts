import { describe, expect, it } from 'vitest'
import { isSupplyCredit, SUPPLY_CREDIT_NOT_ON_STEP, SUPPLY_CREDIT_NOT_LINKABLE } from './supplyHouseDocument'

describe('isSupplyCredit (v2.3501)', () => {
  it('is true only for a negative amount', () => {
    expect(isSupplyCredit(-888.1)).toBe(true)
    expect(isSupplyCredit(-0.01)).toBe(true)
    expect(isSupplyCredit(888.1)).toBe(false)
    expect(isSupplyCredit(0)).toBe(false)
  })

  it('treats a rounding-sized negative as zero, not as a credit', () => {
    expect(isSupplyCredit(-0.001)).toBe(false)
  })

  it('handles the shapes PostgREST hands back', () => {
    expect(isSupplyCredit(null)).toBe(false)
    expect(isSupplyCredit(undefined)).toBe(false)
  })
})

describe('the two refusals', () => {
  it('say what the paper is and why it is refused', () => {
    for (const msg of [SUPPLY_CREDIT_NOT_ON_STEP, SUPPLY_CREDIT_NOT_LINKABLE]) {
      expect(msg).toContain('credit memo')
      expect(msg.length).toBeGreaterThan(40)
    }
    expect(SUPPLY_CREDIT_NOT_LINKABLE).toContain('twice')
  })
})
