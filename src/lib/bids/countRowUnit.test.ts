import { describe, expect, it } from 'vitest'
import { classifyCountRowUnit, effectiveCountUnit, formatUnitTotals, sumByUnit, summarizeRowsByUnit } from './countRowUnit'

describe('classifyCountRowUnit', () => {
  it('reads the CountTooling export prefixes', () => {
    expect(classifyCountRowUnit('ft of 2in Copper')).toBe('ft')
    expect(classifyCountRowUnit('px of 2in Copper')).toBe('px')
    expect(classifyCountRowUnit('[Rough-In] ft of 4in PVC')).toBe('ft')
    expect(classifyCountRowUnit('[Rough-In] WC')).toBe('ea')
    expect(classifyCountRowUnit('WC')).toBe('ea')
  })

  it('reads the hand-entry variants seen in prod', () => {
    expect(classifyCountRowUnit('feet of sewer')).toBe('ft')
    expect(classifyCountRowUnit('Feet of Water Service Line')).toBe('ft')
    expect(classifyCountRowUnit('FEET OF 2" COPPER')).toBe('ft')
    expect(classifyCountRowUnit('LF of trench')).toBe('ft')
    expect(classifyCountRowUnit('1/2" PEX BLUE PER FT')).toBe('ft')
    expect(classifyCountRowUnit('ft of measure')).toBe('ft')
    expect(classifyCountRowUnit('square feet of Digging')).toBe('sqft')
    expect(classifyCountRowUnit('sq ft of slab')).toBe('sqft')
  })

  it('stays tight: fixture tags and un-prefixed pipe names are each', () => {
    expect(classifyCountRowUnit('FT-1')).toBe('ea')
    expect(classifyCountRowUnit('FT SEWER LINE')).toBe('ea')
    expect(classifyCountRowUnit('2" HDPE pipe')).toBe('ea')
    expect(classifyCountRowUnit('feet 36" Plastic riser pipe')).toBe('ea')
    expect(classifyCountRowUnit('Offtake')).toBe('ea')
    expect(classifyCountRowUnit('')).toBe('ea')
    expect(classifyCountRowUnit(null)).toBe('ea')
  })
})

describe('effectiveCountUnit', () => {
  it('prefers an explicit unit, falls back to the name, ignores junk', () => {
    expect(effectiveCountUnit({ fixture: 'ft of X', unit: 'ea' })).toBe('ea')
    expect(effectiveCountUnit({ fixture: '2in copper', unit: 'ft' })).toBe('ft')
    expect(effectiveCountUnit({ fixture: 'ft of X', unit: null })).toBe('ft')
    expect(effectiveCountUnit({ fixture: 'ft of X', unit: 'bogus' })).toBe('ft')
    expect(effectiveCountUnit({ fixture: 'WC' })).toBe('ea')
  })
})

describe('sumByUnit / formatUnitTotals / summarizeRowsByUnit', () => {
  const rows = [
    { fixture: 'WC', count: 12 },
    { fixture: 'Lav', count: '6' },
    { fixture: 'ft of 2in Copper', count: 148.5 },
    { fixture: 'ft of 4in PVC', count: 60 },
    { fixture: 'px of 1in Gas', count: 367 },
  ]

  it('never sums feet into counts', () => {
    const t = sumByUnit(rows)
    expect(t.ea).toEqual({ items: 2, total: 18 })
    expect(t.ft).toEqual({ items: 2, total: 208.5 })
    expect(t.px).toEqual({ items: 1, total: 367 })
    expect(t.sqft).toEqual({ items: 0, total: 0 })
  })

  it('formats compact totals, omitting empty buckets', () => {
    expect(formatUnitTotals(sumByUnit(rows))).toBe('18 ea · 208.5 ft · 367 px')
    expect(formatUnitTotals(sumByUnit([{ fixture: 'WC', count: 3 }]))).toBe('3 ea')
    expect(formatUnitTotals(sumByUnit([]))).toBe('0')
  })

  it('summarizes for the import toast', () => {
    expect(summarizeRowsByUnit(rows)).toBe('2 counts (18 ea) · 2 line types (208.5 ft) · 1 unscaled run (367 px)')
    expect(summarizeRowsByUnit([{ fixture: 'WC', count: 1122 }, { fixture: 'ft of x', count: 444.74 }])).toBe('1 count (1,122 ea) · 1 line type (444.74 ft)')
  })

  it('ignores non-numeric counts in totals but still counts the item', () => {
    expect(sumByUnit([{ fixture: 'WC', count: 'abc' }]).ea).toEqual({ items: 1, total: 0 })
  })
})
