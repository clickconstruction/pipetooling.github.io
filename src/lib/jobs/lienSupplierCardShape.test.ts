import { describe, expect, it } from 'vitest'
import { LIEN_SUPPLIERS_STACK_BELOW_PX, lienSuppliersStacked } from './lienSupplierCardShape'

describe('the supply houses card’s shape by its own width (v2.7446)', () => {
  it('a phone stacks its rows whatever the card measures', () => {
    expect(lienSuppliersStacked(true, 0)).toBe(true)
    expect(lienSuppliersStacked(true, 900)).toBe(true)
  })
  it('a computer keeps the table from 600 px of card and stacks under it', () => {
    expect(LIEN_SUPPLIERS_STACK_BELOW_PX).toBe(600)
    // The pane beside the list in a 1,024 px window, and the office's 700 to 756 px pane.
    expect(lienSuppliersStacked(false, 621)).toBe(false)
    expect(lienSuppliersStacked(false, 665)).toBe(false)
    expect(lienSuppliersStacked(false, 600)).toBe(false)
    // A tablet's pane, and the narrowest two-column pane.
    expect(lienSuppliersStacked(false, 599)).toBe(true)
    expect(lienSuppliersStacked(false, 365)).toBe(true)
    expect(lienSuppliersStacked(false, 257)).toBe(true)
  })
  it('an unmeasured card keeps the table', () => {
    expect(lienSuppliersStacked(false, 0)).toBe(false)
  })
})
