import { describe, expect, it } from 'vitest'
import { summarizeTakeoffCoverage } from './takeoffCoverage'
import { fixtureUnitCosts, rfqScopeForZeroPrice, zeroPriceQueue } from './takeoffCostRail'
import { summarizeOrderRounding } from './takeoffOrderRounding'

const rows = [
  { id: 'wc', fixture: 'WC-12', count: 2, unit: null },
  { id: 'l', fixture: 'L-4', count: 2, unit: null },
  { id: 'water', fixture: 'ft of 3/4in water', count: 148.5, unit: 'ft' },
]
const lines = [
  { id: 'a', countRowId: 'wc', partId: 'p-toilet', quantity: 1, unitPrice: 0, sourceMaterialPartPriceId: null, sourceTemplateId: null },
  { id: 'b', countRowId: 'wc', partId: 'p-wax', quantity: 1, unitPrice: 4.12, sourceMaterialPartPriceId: 'x', sourceTemplateId: null },
  { id: 'c', countRowId: 'l', partId: 'p-toilet', quantity: 2, unitPrice: 0, sourceMaterialPartPriceId: null, sourceTemplateId: null },
  { id: 'd', countRowId: 'l', partId: null, quantity: 1, unitPrice: 0, sourceMaterialPartPriceId: null, sourceTemplateId: 'tpl' },
  { id: 'e', countRowId: 'water', partId: 'p-copper', quantity: 1, unitPrice: 4.42, sourceMaterialPartPriceId: 'y', sourceTemplateId: null },
  { id: 'orphan', countRowId: 'gone', partId: 'p-toilet', quantity: 1, unitPrice: 0, sourceMaterialPartPriceId: null, sourceTemplateId: null },
]
const names = new Map([['p-toilet', 'K-25077-0 KINGSTON'], ['p-wax', 'DOUBLE WAX RING']])

describe('zeroPriceQueue', () => {
  it('lists $0 part lines with their fixture, skipping bundles and orphans', () => {
    const q = zeroPriceQueue(rows, lines, names)
    expect(q.map((x) => [x.lineId, x.fixture, x.partName, x.quantity])).toEqual([
      ['a', 'WC-12', 'K-25077-0 KINGSTON', 1],
      ['c', 'L-4', 'K-25077-0 KINGSTON', 2],
    ])
  })
})

describe('rfqScopeForZeroPrice', () => {
  it('makes one scope line per fixture and a note that sums parts by name', () => {
    const scope = rfqScopeForZeroPrice(zeroPriceQueue(rows, lines, names))
    expect(scope.lines).toEqual([
      { fixture: 'WC-12', count: 2, unit: null },
      { fixture: 'L-4', count: 2, unit: null },
    ])
    // v2.3409: the bid's need — 1 × 2 on WC-12 plus 2 × 2 on L-4 — not the per-fixture quantities
    expect(scope.text).toBe('Please quote these parts (no catalog price on file):\n• K-25077-0 KINGSTON × 6')
  })

  it('v2.3409: a part sold in packs is quoted at its ordered quantity', () => {
    const q = zeroPriceQueue(
      [{ id: 'w', fixture: 'ft of 3/4in water', count: 105, unit: 'ft' }],
      [{ id: 'z', countRowId: 'w', partId: 'p-cu', quantity: 1, unitPrice: 0, sourceMaterialPartPriceId: null, sourceTemplateId: null, orderIncrement: 20, orderIncrementUnit: 'ft_stick' }],
      new Map([['p-cu', '3/4" Type L Copper']]),
    )
    const rounding = summarizeOrderRounding([{ id: 'w', count: 105 }], [{ countRowId: 'w', partId: 'p-cu', quantity: 1, unitPrice: 0, orderIncrement: 20, orderIncrementUnit: 'ft_stick' }])
    expect(rfqScopeForZeroPrice(q, rounding).text).toBe('Please quote these parts (no catalog price on file):\n• 3/4" Type L Copper × 120 ft (105 ft needed · 20 ft sticks)')
  })

  it('v2.3414: pieces sold in packs quote as packs — 13 nuts in packs of 5 is 15', () => {
    const q = zeroPriceQueue(
      [{ id: 'wc', fixture: 'WC-12', count: 13, unit: null }],
      [{ id: 'n', countRowId: 'wc', partId: 'p-nut', quantity: 1, unitPrice: 0, sourceMaterialPartPriceId: null, sourceTemplateId: null, orderIncrement: 5, orderIncrementUnit: 'pack' }],
      new Map([['p-nut', '3/8" Brass flare nut']]),
    )
    const rounding = summarizeOrderRounding([{ id: 'wc', count: 13 }], [{ countRowId: 'wc', partId: 'p-nut', quantity: 1, unitPrice: 0, orderIncrement: 5, orderIncrementUnit: 'pack' }])
    expect(rfqScopeForZeroPrice(q, rounding).text).toBe('Please quote these parts (no catalog price on file):\n• 3/8" Brass flare nut × 15 (13 needed · packs of 5)')
  })

  it('is empty-safe', () => {
    expect(rfqScopeForZeroPrice([])).toEqual({ lines: [], text: 'Please quote these parts (no catalog price on file):' })
  })
})

describe('fixtureUnitCosts', () => {
  it('lists costed fixtures in row order with incomplete flags', () => {
    const cov = summarizeTakeoffCoverage(rows, lines)
    expect(fixtureUnitCosts(rows, cov)).toEqual([
      { countRowId: 'wc', fixture: 'WC-12', unitCost: 4.12, total: 8.24, incomplete: true },
      { countRowId: 'l', fixture: 'L-4', unitCost: 0, total: 0, incomplete: true },
      { countRowId: 'water', fixture: 'ft of 3/4in water', unitCost: 4.42, total: 656.37, incomplete: false },
    ])
  })
})
