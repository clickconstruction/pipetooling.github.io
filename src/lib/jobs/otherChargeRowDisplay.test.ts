import { describe, expect, it } from 'vitest'
import {
  moneyDraftForEditing,
  splitEstimateDescription,
  splitMoneyForDisplay,
  splitMoneyString,
} from './otherChargeRowDisplay'

describe('splitMoneyForDisplay', () => {
  it('splits dollars with commas from the two-digit cents', () => {
    expect(splitMoneyForDisplay(39796.7)).toEqual({ whole: '39,796', cents: '.70' })
    expect(splitMoneyForDisplay(1250)).toEqual({ whole: '1,250', cents: '.00' })
    expect(splitMoneyForDisplay(384.6)).toEqual({ whole: '384', cents: '.60' })
    expect(splitMoneyForDisplay(0.05)).toEqual({ whole: '0', cents: '.05' })
  })

  it('zero, negatives and non-finite input', () => {
    expect(splitMoneyForDisplay(0)).toEqual({ whole: '0', cents: '.00' })
    expect(splitMoneyForDisplay(-12.5)).toEqual({ whole: '-12', cents: '.50' })
    expect(splitMoneyForDisplay(Number.NaN)).toEqual({ whole: '0', cents: '.00' })
  })
})

describe('splitMoneyString', () => {
  it('reads a formatted total, with or without a sign or dollar sign', () => {
    expect(splitMoneyString('14,115.35')).toEqual({ whole: '14,115', cents: '.35' })
    expect(splitMoneyString('−40.00')).toEqual({ whole: '−40', cents: '.00' })
    expect(splitMoneyString('$1,250.00')).toEqual({ whole: '$1,250', cents: '.00' })
  })

  it('passes anything that is not money through as null', () => {
    expect(splitMoneyString('—')).toBeNull()
    expect(splitMoneyString('…')).toBeNull()
    expect(splitMoneyString('8.0 h')).toBeNull()
    expect(splitMoneyString('1,250')).toBeNull()
    expect(splitMoneyString('')).toBeNull()
  })
})

describe('splitEstimateDescription', () => {
  it('takes the ESTIMATE prefix off for the chip and keeps it for the data', () => {
    expect(splitEstimateDescription('ESTIMATE — Office overhead Q3 share')).toEqual({
      estimate: true,
      prefix: 'ESTIMATE — ',
      rest: 'Office overhead Q3 share',
    })
    expect(splitEstimateDescription('ESTIMATE: scaffold')).toEqual({ estimate: true, prefix: 'ESTIMATE: ', rest: 'scaffold' })
    expect(splitEstimateDescription('ESTIMATE - dumpster')).toEqual({ estimate: true, prefix: 'ESTIMATE - ', rest: 'dumpster' })
    expect(splitEstimateDescription('ESTIMATE')).toEqual({ estimate: true, prefix: 'ESTIMATE', rest: '' })
  })

  it('reads the prefix in any case, as the batch function does', () => {
    expect(splitEstimateDescription('Estimate — typed by hand')).toEqual({ estimate: true, prefix: 'Estimate — ', rest: 'typed by hand' })
    expect(splitEstimateDescription('estimate: lift')).toEqual({ estimate: true, prefix: 'estimate: ', rest: 'lift' })
  })

  it('leaves every other description alone, including ESTIMATED', () => {
    expect(splitEstimateDescription('Permit fee')).toEqual({ estimate: false, prefix: '', rest: 'Permit fee' })
    expect(splitEstimateDescription('ESTIMATED cost of the lift')).toEqual({ estimate: false, prefix: '', rest: 'ESTIMATED cost of the lift' })
    expect(splitEstimateDescription('An ESTIMATE later')).toEqual({ estimate: false, prefix: '', rest: 'An ESTIMATE later' })
    expect(splitEstimateDescription('')).toEqual({ estimate: false, prefix: '', rest: '' })
  })
})

describe('moneyDraftForEditing', () => {
  it('shows the plain digits with the cents, no commas, and nothing for zero', () => {
    expect(moneyDraftForEditing(39796.7)).toBe('39796.70')
    expect(moneyDraftForEditing(2100)).toBe('2100.00')
    expect(moneyDraftForEditing(0)).toBe('')
    expect(moneyDraftForEditing(Number.NaN)).toBe('')
  })
})
