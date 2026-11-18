import { describe, expect, it } from 'vitest'
import { priceDeleteBlock, scenarioIsCustomerFacing, versionStarringScenario } from './starredScenarioGuard'

const v = (id: string, star: string | null) => ({ id, starred_price_book_version_id: star })

describe('versionStarringScenario', () => {
  it('finds the packet whose ★ is the scenario', () => {
    const versions = [v('pkA', 'scen-1'), v('pkB', 'scen-2')]
    expect(versionStarringScenario(versions, 'scen-2')?.id).toBe('pkB')
  })

  it('finds a star held by a packet OTHER than the viewed one (the BP384 incident shape)', () => {
    // Viewing packet A; the card belongs to packet B and is B's ★.
    const versions = [v('pkA', 'scen-a'), v('pkB', 'scen-b-star')]
    expect(versionStarringScenario(versions, 'scen-b-star')?.id).toBe('pkB')
  })

  it('returns null for a scenario no packet stars', () => {
    const versions = [v('pkA', 'scen-a'), v('pkB', null)]
    expect(versionStarringScenario(versions, 'scen-compare-only')).toBeNull()
  })

  it('returns null for empty/null inputs', () => {
    expect(versionStarringScenario([], 'scen-1')).toBeNull()
    expect(versionStarringScenario([v('pkA', 'scen-1')], null)).toBeNull()
    expect(versionStarringScenario([v('pkA', 'scen-1')], undefined)).toBeNull()
  })
})

describe('scenarioIsCustomerFacing', () => {
  it('true when any packet stars it, even if the viewed ★ is a different scenario', () => {
    expect(
      scenarioIsCustomerFacing({
        scenarioId: 'scen-b-star',
        bidVersions: [v('pkA', 'scen-a'), v('pkB', 'scen-b-star')],
        viewedCustomerFacingId: 'scen-a',
      }),
    ).toBe(true)
  })

  it('true for the bid-level fallback ★ on unsplit bids (no packets)', () => {
    expect(
      scenarioIsCustomerFacing({ scenarioId: 'scen-1', bidVersions: [], viewedCustomerFacingId: 'scen-1' }),
    ).toBe(true)
  })

  it('false for a compare-only scenario', () => {
    expect(
      scenarioIsCustomerFacing({
        scenarioId: 'scen-extra',
        bidVersions: [v('pkA', 'scen-a')],
        viewedCustomerFacingId: 'scen-a',
      }),
    ).toBe(false)
  })
})

describe('priceDeleteBlock', () => {
  const gcNameOf = (versionId: string) => ({ pkA: 'North Builders', pkB: 'South Builders' })[versionId] ?? 'this GC'
  const versions = [v('pkA', 'scen-a-star'), v('pkB', 'scen-b-star')]

  it('a price no letter is built on can be deleted', () => {
    expect(priceDeleteBlock({ bidVersions: versions, pricingId: 'scen-compare', customerFacingPricingId: 'scen-a-star', selectedBidVersionId: 'pkA', gcNameOf })).toBeNull()
  })

  it("the viewed packet's ★ is held with the plain sentence", () => {
    expect(priceDeleteBlock({ bidVersions: versions, pricingId: 'scen-a-star', customerFacingPricingId: 'scen-a-star', selectedBidVersionId: 'pkA', gcNameOf })).toBe(
      "The GC's letter is built on this price — make another price the base first.",
    )
  })

  it("another packet's ★ is held by name (the card row can show it)", () => {
    expect(priceDeleteBlock({ bidVersions: versions, pricingId: 'scen-b-star', customerFacingPricingId: 'scen-a-star', selectedBidVersionId: 'pkA', gcNameOf })).toBe(
      "South Builders's letter is built on this price — star another price for that packet first.",
    )
  })

  it('an unsplit bid with no packets holds its bid-level ★ with the plain sentence', () => {
    expect(priceDeleteBlock({ bidVersions: [], pricingId: 'base', customerFacingPricingId: 'base', selectedBidVersionId: null, gcNameOf })).toBe(
      "The GC's letter is built on this price — make another price the base first.",
    )
    expect(priceDeleteBlock({ bidVersions: [], pricingId: 'alt', customerFacingPricingId: 'base', selectedBidVersionId: null, gcNameOf })).toBeNull()
  })
})
