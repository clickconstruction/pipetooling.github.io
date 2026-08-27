import { describe, expect, it } from 'vitest'
import { cellEditSeed, impliedUnitPrice } from './workbenchCellSolve'

describe('impliedUnitPrice', () => {
  it('revenue divides across the count', () => {
    expect(impliedUnitPrice('revenue', '1600', 8, 736.8)).toBe(200)
    expect(impliedUnitPrice('revenue', '$1,600.00', 8, 736.8)).toBe(200)
  })

  it('profit adds the row cost back before dividing', () => {
    // cost 1420.80 + profit 1421.20 = 2842 revenue over 12 units
    expect(impliedUnitPrice('profit', '1421.20', 12, 1420.8)).toBe(236.83)
    // negative profit still prices (selling below cost), as long as the unit stays positive
    expect(impliedUnitPrice('profit', '-420.80', 12, 1420.8)).toBe(83.33)
    expect(impliedUnitPrice('profit', '-2000', 12, 1420.8)).toBeNull()
  })

  it('margin solves cost/(1−m) and refuses 95%+', () => {
    // 118.40/unit cost × 12 = 1420.80; 50% margin → 2841.60 revenue → 236.80/unit
    expect(impliedUnitPrice('margin', '50', 12, 1420.8)).toBe(236.8)
    expect(impliedUnitPrice('margin', '50%', 12, 1420.8)).toBe(236.8)
    expect(impliedUnitPrice('margin', '0', 12, 1420.8)).toBe(118.4)
    expect(impliedUnitPrice('margin', '-25', 12, 1420.8)).toBe(94.72)
    expect(impliedUnitPrice('margin', '95', 12, 1420.8)).toBeNull()
    expect(impliedUnitPrice('margin', '120', 12, 1420.8)).toBeNull()
  })

  it('profit and margin need a row cost; every field needs a count and a parseable positive result', () => {
    expect(impliedUnitPrice('profit', '100', 4, 0)).toBeNull()
    expect(impliedUnitPrice('margin', '40', 4, 0)).toBeNull()
    expect(impliedUnitPrice('revenue', '100', 0, 50)).toBeNull()
    expect(impliedUnitPrice('revenue', 'abc', 4, 50)).toBeNull()
    expect(impliedUnitPrice('revenue', '0', 4, 50)).toBeNull()
    expect(impliedUnitPrice('revenue', '-100', 4, 50)).toBeNull()
  })
})

describe('cellEditSeed', () => {
  it('opens each editor with the number that cell currently shows', () => {
    expect(cellEditSeed('revenue', 165, 12, 1420.8)).toBe('1980')
    expect(cellEditSeed('profit', 165, 12, 1420.8)).toBe('559.2')
    expect(cellEditSeed('margin', 165, 12, 1420.8)).toBe('28')
  })

  it('unpriced rows open empty', () => {
    expect(cellEditSeed('revenue', null, 12, 1420.8)).toBe('')
  })
})
