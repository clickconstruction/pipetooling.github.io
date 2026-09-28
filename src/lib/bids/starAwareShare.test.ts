import { describe, expect, it } from 'vitest'

import type { ScenarioInputs } from './loadScenarioInputs'
import {
  buildPricingPrintContext,
  pricingNameOf,
  pricingPrintContextFor,
  scenarioPackageFromInputs,
  shareOverrideForStar,
  starActionReadsViewed,
  starChooserConfirmLabel,
  starChooserNeeded,
  starChooserVerb,
  teamLaborCostForBid,
  type PricingShareInputs,
} from './starAwareShare'

const versions = [
  { id: 'pA', name: 'Base' },
  { id: 'pB', name: 'Alternate 1' },
]

const row = (id: string, fixture: string, count: number) => ({ id, fixture, count, bid_id: 'b1', sequence_order: 0 })

function inputs(over: Partial<PricingShareInputs> = {}): PricingShareInputs {
  return {
    bid: { id: 'b1', selected_price_book_version_id: 'pA' },
    priceBookVersions: versions,
    priceBookEntries: [],
    selectedPricingVersionId: 'pB',
    countRows: [row('c1', 'WC-1', 4)],
    costEstimate: null,
    laborRows: [],
    materialTotalRoughIn: 100,
    materialTotalTopOut: null,
    materialTotalTrimSet: 50,
    laborRate: null,
    fixtureMaterialsFromTakeoff: {},
    assignments: [],
    customPrices: [],
    submissionHides: [],
    taxPercent: 8.25,
    directCostRows: [],
    teamLaborDataForBids: [
      { bidId: 'b9', bidCost: 5 },
      { bidId: 'b1', bidCost: 320 },
    ],
    ...over,
  } as unknown as PricingShareInputs
}

const scenario = (over: Partial<ScenarioInputs> = {}): ScenarioInputs => ({ entries: [], assignments: [], customPrices: [], hides: [], countRows: null, ...over })

describe('pricingNameOf', () => {
  it('names a scenario, and reads an unknown or missing id as an em dash', () => {
    expect(pricingNameOf(versions, 'pB')).toBe('Alternate 1')
    expect(pricingNameOf(versions, 'gone')).toBe('—')
    expect(pricingNameOf(versions, null)).toBe('—')
  })
})

describe('teamLaborCostForBid', () => {
  it('is the bid’s own row, 0 with none, and the later of two rows for one bid', () => {
    const rows = [
      { bidId: 'b1', bidCost: 100 },
      { bidId: 'b2', bidCost: 7 },
      { bidId: 'b1', bidCost: 140 },
    ]
    expect(teamLaborCostForBid(rows, 'b2')).toBe(7)
    expect(teamLaborCostForBid(rows, 'b1')).toBe(140)
    expect(teamLaborCostForBid(rows, 'b3')).toBe(0)
    expect(teamLaborCostForBid([], 'b1')).toBe(0)
  })
})

describe('the ★ decision', () => {
  it('asks only with a ★, a scenario on screen, and the two apart', () => {
    expect(starChooserNeeded('pA', 'pB')).toBe(true)
    expect(starChooserNeeded('pA', 'pA')).toBe(false)
    expect(starChooserNeeded(null, 'pB')).toBe(false)
    expect(starChooserNeeded('pA', null)).toBe(false)
  })

  it('reads what is on screen when the viewed price was picked, the bid has no ★, or the ★ is on screen', () => {
    expect(starActionReadsViewed('viewed', 'pA', 'pB')).toBe(true)
    expect(starActionReadsViewed('star', null, 'pB')).toBe(true)
    expect(starActionReadsViewed('both', 'pA', 'pA')).toBe(true)
    expect(starActionReadsViewed('star', 'pA', 'pB')).toBe(false)
    expect(starActionReadsViewed('both', 'pA', 'pB')).toBe(false)
    // no scenario on screen: the ★ is still another price
    expect(starActionReadsViewed('star', 'pA', null)).toBe(false)
  })
})

describe('buildPricingPrintContext', () => {
  it('is the price view of the inputs, with the bid’s own team labor', () => {
    const ctx = buildPricingPrintContext(inputs())
    expect(ctx.viewModel).toBe('price')
    expect(ctx.teamLaborCost).toBe(320)
    expect(ctx.selectedPricingVersionId).toBe('pB')
    expect(ctx.taxPercent).toBe(8.25)
    expect(ctx.countRows).toHaveLength(1)
    expect('teamLaborDataForBids' in ctx).toBe(false)
  })

  it('reads team labor as 0 when nobody clocked on the bid', () => {
    expect(buildPricingPrintContext(inputs({ teamLaborDataForBids: [] })).teamLaborCost).toBe(0)
  })
})

describe('pricingPrintContextFor', () => {
  it('re-aims the context at the scenario and keeps the rows on screen when it has none of its own', () => {
    const ctx = buildPricingPrintContext(inputs())
    const star = pricingPrintContextFor(ctx, 'pA', scenario({ entries: [{ id: 'e1' }] as never, hides: [{ id: 'h1' }] as never }))
    expect(star.selectedPricingVersionId).toBe('pA')
    expect(star.countRows).toBe(ctx.countRows)
    expect(star.priceBookEntries).toEqual([{ id: 'e1' }])
    expect(star.submissionHides).toEqual([{ id: 'h1' }])
    expect(star.assignments).toEqual([])
    // costs are scenario-independent
    expect(star.teamLaborCost).toBe(320)
    expect(star.materialTotalRoughIn).toBe(100)
    // the source context is untouched
    expect(ctx.selectedPricingVersionId).toBe('pB')
  })

  it('prices the scenario’s own count rows when it lives on another bid version — even an empty list', () => {
    const ctx = buildPricingPrintContext(inputs())
    const own = [row('x1', 'LAV-1', 2)] as never
    expect(pricingPrintContextFor(ctx, 'pA', scenario({ countRows: own })).countRows).toBe(own)
    expect(pricingPrintContextFor(ctx, 'pA', scenario({ countRows: [] })).countRows).toEqual([])
  })
})

describe('scenarioPackageFromInputs', () => {
  it('prices the scenario’s typed prices against the rows on screen', () => {
    const pkg = scenarioPackageFromInputs(
      'pA',
      scenario({ customPrices: [{ id: 'cp1', bid_id: 'b1', count_row_id: 'c1', price_book_version_id: 'pA', unit_price: 250 }] as never }),
      inputs(),
    )
    expect(pkg.rows).toEqual([{ fixture: 'WC-1', count: 4, unitPrice: 250, revenue: 1000, omitFromSubmissionDocuments: false }])
    expect(pkg.totalRevenue).toBe(1000)
  })

  it('ignores another scenario’s typed price', () => {
    const pkg = scenarioPackageFromInputs(
      'pA',
      scenario({ customPrices: [{ id: 'cp1', bid_id: 'b1', count_row_id: 'c1', price_book_version_id: 'pB', unit_price: 250 }] as never }),
      inputs(),
    )
    expect(pkg.totalRevenue).toBe(0)
  })

  it('prices the scenario’s own rows when it has them', () => {
    const pkg = scenarioPackageFromInputs(
      'pA',
      scenario({
        countRows: [row('x1', 'LAV-1', 2)] as never,
        customPrices: [{ id: 'cp1', bid_id: 'b1', count_row_id: 'x1', price_book_version_id: 'pA', unit_price: 75 }] as never,
      }),
      inputs(),
    )
    expect(pkg.rows.map((r) => [r.fixture, r.revenue])).toEqual([['LAV-1', 150]])
  })
})

describe('shareOverrideForStar', () => {
  const starPackage = { rows: [{ fixture: 'WC-1', count: 4, unitPrice: 250, revenue: 1000, omitFromSubmissionDocuments: false }], totalRevenue: 1000 }
  const viewedPackage = { rows: [{ fixture: 'WC-1', count: 4, unitPrice: 300, revenue: 1200, omitFromSubmissionDocuments: false }], totalRevenue: 1200 }

  it('sends the ★ alone when the ★ was picked', () => {
    expect(shareOverrideForStar({ starId: 'pA', starPackage, choice: 'star', viewedId: 'pB', viewedPackage, versions })).toEqual({
      pricingId: 'pA',
      name: 'Base',
      rows: starPackage.rows,
      totalRevenue: 1000,
      also: null,
    })
  })

  it('"both" puts the viewed price under the ★', () => {
    const o = shareOverrideForStar({ starId: 'pA', starPackage, choice: 'both', viewedId: 'pB', viewedPackage, versions })
    expect(o.pricingId).toBe('pA')
    expect(o.also).toEqual({ pricingId: 'pB', name: 'Alternate 1', rows: viewedPackage.rows, totalRevenue: 1200 })
  })

  it('"both" with nothing on screen to send is the ★ alone', () => {
    expect(shareOverrideForStar({ starId: 'pA', starPackage, choice: 'both', viewedId: 'pB', viewedPackage: null, versions }).also).toBeNull()
    expect(shareOverrideForStar({ starId: 'pA', starPackage, choice: 'both', viewedId: null, viewedPackage, versions }).also).toBeNull()
  })

  it('names a ★ that is no longer among the scenarios with an em dash', () => {
    expect(shareOverrideForStar({ starId: 'gone', starPackage, choice: 'star', viewedId: 'pB', viewedPackage, versions }).name).toBe('—')
  })
})

describe('the chooser’s words', () => {
  it('has a verb per action', () => {
    expect([starChooserVerb('share'), starChooserVerb('print'), starChooserVerb('csv')]).toEqual(['Send', 'Print', 'Export'])
  })

  it('labels the confirm button by the pick, and says Loading while busy', () => {
    const base = { starName: 'Base', viewedName: 'Alternate 1', busy: false }
    expect(starChooserConfirmLabel({ ...base, action: 'share', choice: 'star' })).toBe('Send ★ Base')
    expect(starChooserConfirmLabel({ ...base, action: 'print', choice: 'viewed' })).toBe('Print Alternate 1')
    expect(starChooserConfirmLabel({ ...base, action: 'share', choice: 'both' })).toBe('Send both')
    expect(starChooserConfirmLabel({ ...base, action: 'csv', choice: 'star', busy: true })).toBe('Loading…')
  })
})
