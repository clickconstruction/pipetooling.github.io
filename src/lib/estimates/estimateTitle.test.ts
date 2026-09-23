import { describe, expect, it } from 'vitest'
import { defaultEstimateTitle, isAppDefaultEstimateTitle, isGenericEstimateTitle } from './estimateTitle'

describe('defaultEstimateTitle', () => {
  it('names the customer, or the placeholder when there is none', () => {
    expect(defaultEstimateTitle('Kimberly Coe')).toBe('Estimate for Kimberly Coe')
    expect(defaultEstimateTitle('  Kimberly Coe  ')).toBe('Estimate for Kimberly Coe')
    expect(defaultEstimateTitle('')).toBe('Estimate for customer')
    expect(defaultEstimateTitle('Kimberly Coe', true)).toBe('Change Order for Kimberly Coe')
    expect(defaultEstimateTitle('   ', true)).toBe('Change Order for customer')
  })
})

describe('isGenericEstimateTitle', () => {
  it('is true only for the placeholders', () => {
    for (const t of ['', '  ', 'New estimate', 'Estimate', 'Change order', 'Estimate for customer', 'Change Order for customer']) {
      expect(isGenericEstimateTitle(t)).toBe(true)
    }
    expect(isGenericEstimateTitle('Estimate for Kimberly Coe')).toBe(false)
    expect(isGenericEstimateTitle('Second-floor rough-in')).toBe(false)
  })
})

describe('isAppDefaultEstimateTitle', () => {
  it('recognises the placeholders and the "for <customer>" defaults, in any case', () => {
    expect(isAppDefaultEstimateTitle('Estimate for Kimberly Coe')).toBe(true)
    expect(isAppDefaultEstimateTitle('  estimate for Kim Coe ')).toBe(true)
    expect(isAppDefaultEstimateTitle('Change Order for Kimberly Coe')).toBe(true)
    expect(isAppDefaultEstimateTitle('Estimate for customer')).toBe(true)
    expect(isAppDefaultEstimateTitle('')).toBe(true)
    expect(isAppDefaultEstimateTitle(null)).toBe(true)
    expect(isAppDefaultEstimateTitle(undefined)).toBe(true)
  })
  it('is false for a title someone typed for the work', () => {
    expect(isAppDefaultEstimateTitle('Second-floor rough-in')).toBe(false)
    expect(isAppDefaultEstimateTitle('Coe — water heater')).toBe(false)
    expect(isAppDefaultEstimateTitle('Estimate forwarding fix')).toBe(false)
    expect(isAppDefaultEstimateTitle('Estimates for Kimberly Coe')).toBe(false)
  })
})
