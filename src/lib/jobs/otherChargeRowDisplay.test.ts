import { describe, expect, it } from 'vitest'
import {
  moneyDraftForEditing,
  splitEstimateDescription,
} from './otherChargeRowDisplay'

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
