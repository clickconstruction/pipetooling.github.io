import { describe, expect, it } from 'vitest'
import { chargeMaterials, chargedAtMarkup, marginOfMarkup, type MaterialLineInput } from './materialsCharged'
import { moneyParts, moneyWords } from './moneyParts'

const inv = (id: string, label: string, cost: number, more: Partial<MaterialLineInput> = {}): MaterialLineInput => ({ id, kind: 'supply_invoice', label, dateKey: '2026-04-16', cost, ...more })

describe('materials charged (punch list #254)', () => {
  it('charges every line at cost plus the markup, to the cent, and totals cost, markup and charged', () => {
    const r = chargeMaterials([inv('1', 'A supply house · invoice 1001', 1896.67), inv('2', 'A supply house · invoice 3003', 1620.38)], 25)
    expect(r.lines.map((l) => [l.charged, l.markup])).toEqual([[2370.84, 474.17], [2025.48, 405.1]])
    expect(r.totals).toEqual({ lines: 2, cost: 3517.05, markup: 879.27, charged: 4396.32, passedThrough: 0, leftOff: 0 })
    expect(r.why).toBeNull()
    expect(chargedAtMarkup(806.98, 25)).toBe(1008.73)
  })

  it('passes a line through at cost or leaves it off when an adjustment says so, and keeps what was left off for the office', () => {
    const r = chargeMaterials([inv('1', 'A rental yard · invoice 2002', 1323.08, { passThrough: true }), inv('2', 'A supply house · invoice 4004', 58.25), inv('3', 'A parts store · card', 619.85, { leftOff: true })], 25)
    expect(r.lines.map((l) => [l.id, l.charged, l.passedThrough])).toEqual([['1', 1323.08, true], ['2', 72.81, false]])
    expect(r.leftOff.map((l) => l.id)).toEqual(['3'])
    expect(r.totals).toMatchObject({ lines: 2, passedThrough: 1, leftOff: 1, charged: 1395.89 })
  })

  it('with no markup set, charges every line at cost and says why', () => {
    const r = chargeMaterials([inv('1', 'Ferguson', 100)], null)
    expect(r.lines[0]).toMatchObject({ charged: 100, markup: 0, passedThrough: false })
    expect(r.totals.passedThrough).toBe(0)
    expect(r.why).toBe('No markup on materials is set, so every material line is at cost.')
    expect(chargeMaterials([], null).why).toBeNull()
  })

  it('words the margin a markup makes: 25% over cost is a 20% margin on the sale', () => {
    expect(marginOfMarkup(25)).toBe(20)
    expect(marginOfMarkup(50)).toBe(33.3)
    expect(marginOfMarkup(0)).toBe(0)
  })
})

describe('money parts (the cents smaller than the dollars)', () => {
  it('splits a figure into its sign, dollars and cents', () => {
    expect(moneyParts(250537.73)).toEqual({ sign: '', dollars: '$250,537', cents: '.73', words: '$250,537.73' })
    expect(moneyParts(-537.73)).toEqual({ sign: '−', dollars: '$537', cents: '.73', words: '−$537.73' })
    expect(moneyParts(8)).toEqual({ sign: '', dollars: '$8', cents: '.00', words: '$8.00' })
    expect(moneyParts(0.005)).toMatchObject({ cents: '.01' })
    expect(moneyWords(Number.NaN)).toBe('$0.00')
  })
})
