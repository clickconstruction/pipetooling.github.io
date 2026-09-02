import { describe, expect, it } from 'vitest'

import { buildQuoteComparison, type CompareQuote } from './quoteCompare'
import type { SpecSectionMatchRule } from '../classifySpecSection'

const RULES: SpecSectionMatchRule[] = [
  { pattern: 'WASTE', matchKind: 'contains', sectionCode: '22 13 16', priority: 200 },
  { pattern: 'WATER', matchKind: 'contains', sectionCode: '22 11 16', priority: 220 },
]

const FERG: CompareQuote = {
  id: 'q1',
  supplyHouseId: 'h-ferg',
  houseName: 'Ferguson',
  receivedAt: '2026-09-01T10:00:00Z',
  validUntil: '2026-10-01',
  lines: [
    { fixture: 'ft of 4IN WASTE', unitPriceEachCents: 1890, cantSupply: false, picked: true },
    { fixture: 'ft of 3/4IN WATER', unitPriceEachCents: 3110, cantSupply: false },
    { fixture: 'WC-1', unitPriceEachCents: null, cantSupply: true },
  ],
}

const WIN: CompareQuote = {
  id: 'q2',
  supplyHouseId: 'h-win',
  houseName: 'Winsupply',
  receivedAt: '2026-09-01T11:00:00Z',
  validUntil: '2026-09-05',
  lines: [
    { fixture: 'ft of 4IN WASTE', unitPriceEachCents: 2050, cantSupply: false },
    { fixture: 'ft of 3/4IN WATER', unitPriceEachCents: 2980, cantSupply: false },
  ],
}

const QTY = new Map([
  ['ft of 4in waste', 752],
  ['ft of 3/4in water', 1782],
  ['wc-1', 4],
])

describe('buildQuoteComparison', () => {
  it('grades per part with a live best flag, D22 sections, and cost-side baseline', () => {
    const c = buildQuoteComparison({
      quotes: [FERG, WIN],
      currentQtyByName: QTY,
      costBaselineEachCentsByName: new Map([['ft of 4in waste', 2042]]),
      lastQuotedEachCentsByName: new Map([['ft of 3/4in water', 3600]]),
      rules: RULES,
      today: '2026-09-02',
    })
    const waste = c.rows.find((r) => r.fixture === 'ft of 4IN WASTE')!
    expect(waste.sectionCode).toBe('22 13 16')
    expect(waste.baselineEachCents).toBe(2042)
    expect(waste.baselineSource).toBe('cost')
    expect(waste.bestHouseId).toBe('h-ferg')
    const water = c.rows.find((r) => r.fixture === 'ft of 3/4IN WATER')!
    expect(water.baselineSource).toBe('last-quoted')
  })

  it('marks expired quotes and excludes them from best, keeping them visible', () => {
    const c = buildQuoteComparison({
      quotes: [FERG, WIN],
      currentQtyByName: QTY,
      today: '2026-09-10', // Winsupply (valid to 09-05) has expired
    })
    const waste = c.rows.find((r) => r.fixture === 'ft of 4IN WASTE')!
    expect(waste.perHouse['h-win']?.expired).toBe(true)
    expect(waste.perHouse['h-win']?.unitPriceEachCents).toBe(2050)
    expect(waste.bestHouseId).toBe('h-ferg')
    expect(c.houses.find((h) => h.supplyHouseId === 'h-win')?.expired).toBe(true)
  })

  it('quantity drift against the RFQ snapshot gets a badge; totals use CURRENT qty', () => {
    const c = buildQuoteComparison({
      quotes: [FERG],
      currentQtyByName: new Map([['ft of 4in waste', 1100]]),
      snapshotQtyByName: new Map([['ft of 4in waste', 752]]),
      today: '2026-09-02',
    })
    const waste = c.rows.find((r) => r.fixture === 'ft of 4IN WASTE')!
    expect(waste.drift).toBe(true)
    expect(c.pickedTotalCents).toBe(1890 * 1100)
  })

  it('apples-to-apples totals cover only lines every house priced', () => {
    const c = buildQuoteComparison({ quotes: [FERG, WIN], currentQtyByName: QTY, today: '2026-09-02' })
    expect(c.commonLineCount).toBe(2) // WC-1 is can't-supply at Ferguson
    const ferg = c.houses.find((h) => h.supplyHouseId === 'h-ferg')!
    expect(ferg.commonLinesTotalCents).toBe(1890 * 752 + 3110 * 1782)
    expect(ferg.quotedLines).toBe(2)
  })

  it('latest quote per house wins', () => {
    const requote: CompareQuote = { ...WIN, id: 'q3', receivedAt: '2026-09-02T09:00:00Z', lines: [{ fixture: 'ft of 4IN WASTE', unitPriceEachCents: 1700, cantSupply: false }] }
    const c = buildQuoteComparison({ quotes: [FERG, WIN, requote], currentQtyByName: QTY, today: '2026-09-02' })
    const waste = c.rows.find((r) => r.fixture === 'ft of 4IN WASTE')!
    expect(waste.perHouse['h-win']?.quoteId).toBe('q3')
    expect(waste.bestHouseId).toBe('h-win')
  })
})

describe('freight (Rung B, v2.2643)', () => {
  const mk = (id: string, houseId: string, freight: number | null | undefined, picked = false) => ({
    id,
    supplyHouseId: houseId,
    houseName: houseId,
    receivedAt: '2026-09-01T00:00:00Z',
    freightCents: freight,
    lines: [{ fixture: 'WC-1', unitPriceEachCents: 10000, cantSupply: false, picked }],
  })
  const qty = new Map([['wc-1', 2]])

  it('house summaries carry freight and the freight-in common total', () => {
    const c = buildQuoteComparison({ quotes: [mk('a', 'ferguson', 8500), mk('b', 'moore', 0)], currentQtyByName: qty })
    const ferguson = c.houses.find((h) => h.supplyHouseId === 'ferguson')!
    const moore = c.houses.find((h) => h.supplyHouseId === 'moore')!
    expect(ferguson.freightCents).toBe(8500)
    expect(ferguson.commonWithFreightCents).toBe(20000 + 8500)
    expect(moore.freightCents).toBe(0)
    expect(moore.commonWithFreightCents).toBe(20000)
  })

  it('unstated freight stays null (not free) but ranks as zero', () => {
    const c = buildQuoteComparison({ quotes: [mk('a', 'winn', null)], currentQtyByName: qty })
    expect(c.houses[0]?.freightCents).toBeNull()
    expect(c.houses[0]?.commonWithFreightCents).toBe(20000)
  })

  it('picked totals add freight once per picked house only', () => {
    const c = buildQuoteComparison({
      quotes: [mk('a', 'ferguson', 8500, true), mk('b', 'moore', 4000, false)],
      currentQtyByName: qty,
    })
    expect(c.pickedTotalCents).toBe(20000)
    expect(c.pickedFreight).toEqual([{ supplyHouseId: 'ferguson', houseName: 'ferguson', freightCents: 8500 }])
    expect(c.pickedTotalWithFreightCents).toBe(28500)
  })
})

describe('lots (Rung G, v2.2655)', () => {
  it('a picked lot adds its total once across all member lines', () => {
    const q = {
      id: 'q1',
      supplyHouseId: 'ferguson',
      houseName: 'Ferguson',
      receivedAt: '2026-09-01T00:00:00Z',
      lines: [
        { fixture: 'WC-1', unitPriceEachCents: null, cantSupply: false, picked: true, lotId: 'L1', lotTotalCents: 1840000 },
        { fixture: 'WC-2', unitPriceEachCents: null, cantSupply: false, picked: true, lotId: 'L1', lotTotalCents: 1840000 },
        { fixture: 'FCO', unitPriceEachCents: 11600, cantSupply: false, picked: true },
      ],
    }
    const c = buildQuoteComparison({
      quotes: [q],
      currentQtyByName: new Map([
        ['wc-1', 4],
        ['wc-2', 4],
        ['fco', 5],
      ]),
    })
    expect(c.pickedTotalCents).toBe(1840000 + 11600 * 5)
    expect(c.pickedFreight.map((f) => f.supplyHouseId)).toEqual(['ferguson'])
  })
  it('lot lines never win per-line stars (no unit price)', () => {
    const q = {
      id: 'q1',
      supplyHouseId: 'ferguson',
      houseName: 'Ferguson',
      receivedAt: '2026-09-01T00:00:00Z',
      lines: [{ fixture: 'WC-1', unitPriceEachCents: null, cantSupply: false, lotId: 'L1', lotTotalCents: 1000 }],
    }
    const c = buildQuoteComparison({ quotes: [q], currentQtyByName: new Map([['wc-1', 4]]) })
    expect(c.rows[0]?.bestHouseId).toBeNull()
    expect(c.rows[0]?.perHouse['ferguson']?.lotTotalCents).toBe(1000)
  })
})
