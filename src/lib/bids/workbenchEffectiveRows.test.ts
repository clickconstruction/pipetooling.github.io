/**
 * The Workbench's effective rows, as `BidsPricingTab` computed them inline at the top of its render
 * before the move (decomposition queue row 1). The bid is the one the tab's render smoke mounts:
 * six water closets saved at $800 (cost $1,899), four lavatories saved at $500 (cost $833), three
 * floor drains with no price and no cost, and a whole-bid cost of $2,732. Every dollar below is
 * what the screen showed for the same state before the move.
 */
import { describe, expect, it } from 'vitest'
import { parsePriceDraft, workbenchEffectiveRow, workbenchEffectiveRows, workbenchEffectiveTotals, type WorkbenchPriceState } from './workbenchEffectiveRows'

const WC = { countRow: { id: 'cr-wc' }, count: 6, cost: 1899, unitPrice: 800, priced: true, fixture: 'Water closet' }
const LAV = { countRow: { id: 'cr-lav' }, count: 4, cost: 833, unitPrice: 500, priced: true, fixture: 'Lavatory' }
const FD = { countRow: { id: 'cr-fd' }, count: 3, cost: 0, unitPrice: 0, priced: false, fixture: 'Floor drain' }
const ROWS = [WC, LAV, FD]
const TOTAL_COST = 2732

const state = (over: Partial<{ preview: Record<string, number> | null; vetoed: string[]; drafts: Record<string, string> }> = {}): WorkbenchPriceState => ({
  preview: over.preview ?? null,
  vetoed: new Set(over.vetoed ?? []),
  drafts: over.drafts ?? {},
})
const totals = (s: WorkbenchPriceState) => workbenchEffectiveTotals(workbenchEffectiveRows(ROWS, s), TOTAL_COST)

describe('parsePriceDraft', () => {
  it('reads dollars with or without the sign and the commas', () => {
    expect(parsePriceDraft('$1,250.50')).toBe(1250.5)
    expect(parsePriceDraft('950')).toBe(950)
    expect(parsePriceDraft('0')).toBe(0)
  })
  it('empty text, a word or a negative is no draft', () => {
    expect(parsePriceDraft('')).toBeNull()
    expect(parsePriceDraft('abc')).toBeNull()
    expect(parsePriceDraft('-5')).toBeNull()
    expect(parsePriceDraft(undefined)).toBeNull()
    expect(parsePriceDraft(null)).toBeNull()
  })
  it('reads the number a text starts with, as the cell always has', () => {
    expect(parsePriceDraft('12abc')).toBe(12)
    expect(parsePriceDraft('1.5.7')).toBe(1.5)
  })
})

describe('workbenchEffectiveRow', () => {
  it('a saved price counts and shows, with its revenue and margin', () => {
    const r = workbenchEffectiveRow(WC, state())
    expect(r).toMatchObject({ effUnit: 800, effRevenue: 4800, isPreview: false, isVetoed: false, displayUnit: 800, displayRevenue: 4800 })
    expect(r.effMargin).toBeCloseTo((4800 - 1899) / 4800, 12)
    expect(r.displayMargin).toBe(r.effMargin)
    // The row's own fields ride along.
    expect(r.fixture).toBe('Water closet')
    expect(r.countRow).toBe(WC.countRow)
  })

  it('a row nothing prices is unpriced: no unit, no revenue, no margin', () => {
    expect(workbenchEffectiveRow(FD, state())).toMatchObject({ effUnit: null, effRevenue: 0, effMargin: null, displayUnit: null, displayRevenue: 0, displayMargin: null })
  })

  it('a saved $0 is a price: a unit of 0, and no margin for want of revenue', () => {
    const free = { ...WC, unitPrice: 0, priced: true }
    expect(workbenchEffectiveRow(free, state())).toMatchObject({ effUnit: 0, effRevenue: 0, effMargin: null, displayUnit: 0 })
  })

  it('a row with a price and no cost basis has revenue and no margin', () => {
    const noCost = { ...FD, unitPrice: 120, priced: true }
    expect(workbenchEffectiveRow(noCost, state())).toMatchObject({ effUnit: 120, effRevenue: 360, effMargin: null })
  })

  it("the solver's proposal counts toward the totals; the row's own cells keep the saved price", () => {
    const r = workbenchEffectiveRow(WC, state({ preview: { 'cr-wc': 900 } }))
    expect(r).toMatchObject({ isPreview: true, isVetoed: false, effUnit: 900, effRevenue: 5400, displayUnit: 800, displayRevenue: 4800 })
    expect(r.effMargin).toBeCloseTo((5400 - 1899) / 5400, 12)
    expect(r.displayMargin).toBeCloseTo((4800 - 1899) / 4800, 12)
  })

  it('a proposal equal to the saved price is no proposal', () => {
    expect(workbenchEffectiveRow(LAV, state({ preview: { 'cr-lav': 500 } }))).toMatchObject({ isPreview: false, effUnit: 500 })
  })

  it('a clicked-off proposal holds the saved price, and still reads as a vetoed preview', () => {
    expect(workbenchEffectiveRow(LAV, state({ preview: { 'cr-lav': 650 }, vetoed: ['cr-lav'] }))).toMatchObject({ isPreview: true, isVetoed: true, effUnit: 500, effRevenue: 2000 })
  })

  it('a veto on a row with no proposal means nothing', () => {
    expect(workbenchEffectiveRow(LAV, state({ vetoed: ['cr-lav'] }))).toMatchObject({ isPreview: false, isVetoed: false, effUnit: 500 })
  })

  it('a proposal prices a row nothing priced', () => {
    expect(workbenchEffectiveRow(FD, state({ preview: { 'cr-fd': 250 } }))).toMatchObject({ isPreview: true, effUnit: 250, effRevenue: 750, displayUnit: null })
  })

  it('a proposal of $0 on a row nothing priced is not read as a proposal', () => {
    // The unpriced row carries unitPrice 0, so a proposed 0 equals it. As it always was.
    expect(workbenchEffectiveRow(FD, state({ preview: { 'cr-fd': 0 } }))).toMatchObject({ isPreview: false, effUnit: null })
  })

  it('a price being typed beats the proposal and the saved price, in the totals and in the cells', () => {
    const r = workbenchEffectiveRow(WC, state({ preview: { 'cr-wc': 900 }, drafts: { 'cr-wc': '$950' } }))
    expect(r).toMatchObject({ isPreview: true, effUnit: 950, effRevenue: 5700, displayUnit: 950, displayRevenue: 5700 })
  })

  it('text that is not a price leaves the saved price in place', () => {
    expect(workbenchEffectiveRow(WC, state({ drafts: { 'cr-wc': 'abc' } }))).toMatchObject({ effUnit: 800, displayUnit: 800 })
  })

  it('a typed price beats a veto too', () => {
    expect(workbenchEffectiveRow(LAV, state({ preview: { 'cr-lav': 650 }, vetoed: ['cr-lav'], drafts: { 'cr-lav': '700' } }))).toMatchObject({ isVetoed: true, effUnit: 700, effRevenue: 2800 })
  })
})

describe('workbenchEffectiveTotals — the bar', () => {
  it('as saved: $6,800 revenue, $4,068 profit, 59.8%, both costed rows priced', () => {
    const t = totals(state())
    expect(t.effRevenue).toBe(6800)
    expect(t.effProfit).toBe(4068)
    expect(t.effMargin).toBeCloseTo(4068 / 6800, 12)
    expect(t.previewCount).toBe(0)
    expect(t.vetoCount).toBe(0)
    expect(t.costed.map((r) => r.countRow.id)).toEqual(['cr-wc', 'cr-lav'])
    expect(t.pricedCount).toBe(2)
    expect(t.unpricedCost).toBe(0)
  })

  it('a solve that proposes $900, $500 and $250: $8,150 and $5,418, two proposals (the $500 is the saved price)', () => {
    const t = totals(state({ preview: { 'cr-wc': 900, 'cr-lav': 500, 'cr-fd': 250 } }))
    expect(t.effRevenue).toBe(8150)
    expect(t.effProfit).toBe(5418)
    expect(t.effMargin).toBeCloseTo(5418 / 8150, 12)
    expect(t.previewCount).toBe(2)
    expect(t.vetoCount).toBe(0)
  })

  it('the same solve with the lavatories at $650 clicked off: still $8,150, two proposals and one veto', () => {
    const t = totals(state({ preview: { 'cr-wc': 900, 'cr-lav': 650, 'cr-fd': 250 }, vetoed: ['cr-lav'] }))
    expect(t.effRevenue).toBe(8150)
    expect(t.effProfit).toBe(5418)
    expect(t.previewCount).toBe(2)
    expect(t.vetoCount).toBe(1)
  })

  it('$1,000 typed on the water closets: $8,000 and $5,268 before anything is saved', () => {
    const t = totals(state({ drafts: { 'cr-wc': '$1,000' } }))
    expect(t.effRevenue).toBe(8000)
    expect(t.effProfit).toBe(5268)
    expect(t.previewCount).toBe(0)
  })

  it('$120 typed on the floor drains: $7,160 and $4,428', () => {
    const t = totals(state({ drafts: { 'cr-fd': '120' } }))
    expect(t.effRevenue).toBe(7160)
    expect(t.effProfit).toBe(4428)
  })

  it('a proposal with $950 typed over it: $8,450 and $5,718', () => {
    const t = totals(state({ preview: { 'cr-wc': 900, 'cr-fd': 250 }, drafts: { 'cr-wc': '950' } }))
    expect(t.effRevenue).toBe(8450)
    expect(t.effProfit).toBe(5718)
    expect(t.previewCount).toBe(2)
  })

  it('a costed row with no price is counted as unpriced, with its cost', () => {
    const rows = [WC, { ...LAV, priced: false, unitPrice: 0 }, FD]
    const t = workbenchEffectiveTotals(workbenchEffectiveRows(rows, state()), TOTAL_COST)
    expect(t.pricedCount).toBe(1)
    expect(t.unpricedCost).toBe(833)
    expect(t.effRevenue).toBe(4800)
    expect(t.effProfit).toBe(2068)
  })

  it('no revenue is no margin, and the whole cost is the loss', () => {
    const t = workbenchEffectiveTotals(workbenchEffectiveRows([FD], state()), TOTAL_COST)
    expect(t.effRevenue).toBe(0)
    expect(t.effProfit).toBe(-2732)
    expect(t.effMargin).toBeNull()
    expect(t.costed).toEqual([])
  })

  it('revenue under the cost is a negative profit and a negative margin', () => {
    const t = workbenchEffectiveTotals(workbenchEffectiveRows([{ ...WC, unitPrice: 100 }], state()), TOTAL_COST)
    expect(t.effRevenue).toBe(600)
    expect(t.effProfit).toBe(-2132)
    expect(t.effMargin).toBeCloseTo(-2132 / 600, 12)
  })
})
