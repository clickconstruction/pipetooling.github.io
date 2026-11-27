/**
 * The labor line of a row's split is what is left, on the screen too (finding 346, punch list #46). Three lines
 * rounded one at a time need not add to the row. The labor line shows the row's own figure, as the screen rounds
 * it, less the other lines as the screen rounds them. Every figure here is made up.
 */
import { describe, expect, it } from 'vitest'
import { formatCurrency } from '../format'
import { laborLeftToTheCent, rowPriceSplit } from './rowPriceSplit'

/** A figure as the screen shows it, in whole cents. */
const shown = (v: number) => Math.round(Number(formatCurrency(Math.abs(v)).replace(/,/g, '')) * 100) * (v < 0 ? -1 : 1)

describe('laborLeftToTheCent', () => {
  it('the row that was walked: a unit price a cent over, and a revenue a cent under', () => {
    // Three at 5,600.00. Material is 2,584.87 a unit plus 50%: 3,877.305, a third of a cent off.
    const s = rowPriceSplit({ price: 16800, materialCost: 7754.61, markup: 0.5, taxPercent: 8.25, kind: 'fixture', typed: null })
    const n = 3
    // Rounded one at a time, the three unit prices add to 5,600.01 and the three revenues to 16,799.99.
    expect(shown(s.material / n) + shown(s.tax / n) + shown(s.labor / n)).toBe(560001)
    expect(shown(s.material) + shown(s.tax) + shown(s.labor)).toBe(1679999)
    // What is left, to the cent: labor reads 1,402.81 a unit, not 1,402.82, and 4,208.46, not 4,208.45.
    const unit = laborLeftToTheCent(16800 / n, [s.material / n, s.tax / n])
    const revenue = laborLeftToTheCent(16800, [s.material, s.tax])
    expect(unit).toBe(1402.81)
    expect(revenue).toBe(4208.46)
    expect(shown(s.material / n) + shown(s.tax / n) + shown(unit)).toBe(560000)
    expect(shown(s.material) + shown(s.tax) + shown(revenue)).toBe(1680000)
  })

  it('a row whose lines already add up reads as it did', () => {
    // Six at 800: 300.00, 24.75 and 475.25 a unit.
    const s = rowPriceSplit({ price: 4800, materialCost: 1200, markup: 0.5, taxPercent: 8.25, kind: 'fixture', typed: null })
    expect(laborLeftToTheCent(800, [s.material / 6, s.tax / 6])).toBe(475.25)
    expect(laborLeftToTheCent(4800, [s.material, s.tax])).toBe(2851.5)
  })

  it('adds to the row on every row of a sweep, whichever way the lines round', () => {
    let over = 0
    let under = 0
    for (let i = 0; i < 4000; i++) {
      const n = 1 + (i % 9)
      const unitPrice = 50 + ((i * 37) % 9000) + ((i * 13) % 100) / 100
      const materialCost = n * (10 + ((i * 53) % 4000) + ((i * 7) % 100) / 100)
      const price = Math.round(unitPrice * n * 100) / 100
      const s = rowPriceSplit({ price, materialCost, markup: [0.5, 0.35, 0.6][i % 3]!, taxPercent: 8.25, kind: 'fixture', typed: null })
      const naive = shown(s.material / n) + shown(s.tax / n) + shown(s.labor / n) - shown(price / n)
      if (naive > 0) over++
      if (naive < 0) under++
      const pairs: Array<[number, number, number]> = [
        [price / n, s.material / n, s.tax / n],
        [price, s.material, s.tax],
      ]
      for (const [row, a, b] of pairs) {
        const labor = laborLeftToTheCent(row, [a, b])
        expect(shown(a) + shown(b) + shown(labor), `row ${i}`).toBe(shown(row))
        // Never more than a cent or two from the unrounded remainder: it mends rounding and nothing else.
        expect(Math.abs(labor - (row - a - b))).toBeLessThan(0.016)
      }
    }
    // The sweep holds rows that round each way, so the rule is tried on both.
    expect(over).toBeGreaterThan(50)
    expect(under).toBeGreaterThan(50)
  })

  it('labor that goes under stays under, to the cent', () => {
    // Material typed at 5,000 on a 4,800 row.
    const s = rowPriceSplit({ price: 4800, materialCost: 1200, markup: 0.5, taxPercent: 8.25, kind: 'fixture', typed: { material: 5000 } })
    expect(laborLeftToTheCent(4800, [s.material, s.tax])).toBe(-612.5)
    expect(laborLeftToTheCent(800, [s.material / 6, s.tax / 6])).toBe(-102.08)
  })

  it('answers a clean number of cents, never a float tail, and takes no lines at all', () => {
    expect(laborLeftToTheCent(0.3, [0.1, 0.1])).toBe(0.1)
    expect(laborLeftToTheCent(1402.8173, [])).toBe(1402.82)
  })
})
