import { describe, expect, it } from 'vitest'

import { cardFigures, cardOwnedByVersion, cardRevenue, cardsRowMode, cardsRowScenarios, copySourceFor } from './pricingCardsRow'

const s = (id: string, sort_order: number, bid_version_id: string | null) => ({ id, name: id.toUpperCase(), sort_order, bid_version_id })

describe('cardsRowScenarios', () => {
  it('shows the prices on the version on screen, in sort order', () => {
    const versions = [s('b', 2, 'v1'), s('x', 0, 'v2'), s('a', 1, 'v1')]
    expect(cardsRowScenarios({ priceBookVersions: versions, selectedBidVersionId: 'v1', selectedPricingVersionId: 'a' }).map((v) => v.id)).toEqual(['a', 'b'])
  })

  it('an unversioned bid shows its unversioned prices', () => {
    const versions = [s('a', 1, null), s('x', 0, 'v2')]
    expect(cardsRowScenarios({ priceBookVersions: versions, selectedBidVersionId: null, selectedPricingVersionId: 'a' }).map((v) => v.id)).toEqual(['a'])
  })

  it('when scoping empties the row, every price shows', () => {
    const versions = [s('b', 2, 'v9'), s('a', 1, 'v8')]
    expect(cardsRowScenarios({ priceBookVersions: versions, selectedBidVersionId: 'v1', selectedPricingVersionId: null }).map((v) => v.id)).toEqual(['a', 'b'])
  })

  it('with no price of its own but one open, that one shows as Standard prices; with none open, nothing', () => {
    expect(cardsRowScenarios({ priceBookVersions: [], selectedBidVersionId: 'v1', selectedPricingVersionId: 'shared' })).toEqual([{ id: 'shared', name: 'Standard prices', sort_order: 0 }])
    expect(cardsRowScenarios({ priceBookVersions: [], selectedBidVersionId: 'v1', selectedPricingVersionId: null })).toEqual([])
  })

  it('does not reorder the list it was handed', () => {
    const versions = [s('b', 2, 'v1'), s('a', 1, 'v1')]
    cardsRowScenarios({ priceBookVersions: versions, selectedBidVersionId: 'v1', selectedPricingVersionId: null })
    expect(versions.map((v) => v.id)).toEqual(['b', 'a'])
  })
})

describe('cardOwnedByVersion', () => {
  it("a split bid owns only its version's prices; the fallback row's others are not its own", () => {
    expect(cardOwnedByVersion(s('a', 0, 'v1'), 'v1')).toBe(true)
    expect(cardOwnedByVersion(s('x', 0, 'v2'), 'v1')).toBe(false)
    expect(cardOwnedByVersion(s('legacy', 0, null), 'v1')).toBe(false)
  })

  it('an unsplit bid owns its unversioned prices and the shared book standing in as Standard prices', () => {
    expect(cardOwnedByVersion(s('a', 0, null), null)).toBe(true)
    expect(cardOwnedByVersion({ id: 'tmpl' } as { id: string; bid_version_id?: string | null }, null)).toBe(true)
  })
})

describe('cardRevenue / cardFigures', () => {
  const args = { selectedPricingVersionId: 'a', effRevenue: 1200, scenarioRevenue: { a: 999, b: 800 } }

  it('the open price reads the live total; another its loaded revenue; one still loading reads null', () => {
    expect(cardRevenue('a', args)).toBe(1200)
    expect(cardRevenue('b', args)).toBe(800)
    expect(cardRevenue('c', args)).toBeNull()
  })

  it('margin over revenue; unpriced only at exactly $0, never while loading', () => {
    expect(cardFigures(1000, 600)).toEqual({ margin: 0.4, unpriced: false })
    expect(cardFigures(0, 600)).toEqual({ margin: null, unpriced: true })
    expect(cardFigures(null, 600)).toEqual({ margin: null, unpriced: false })
  })
})

describe('cardsRowMode', () => {
  it('nothing to show is none', () => {
    expect(cardsRowMode({ scenarioCount: 0, alternateCount: 0, bidVersionCount: 1, soloRevenue: null })).toBe('none')
  })

  it('one price, one GC: the band — or no band while unpriced; a price still loading keeps the band', () => {
    expect(cardsRowMode({ scenarioCount: 1, alternateCount: 0, bidVersionCount: 1, soloRevenue: 900 })).toBe('solo')
    expect(cardsRowMode({ scenarioCount: 1, alternateCount: 0, bidVersionCount: 0, soloRevenue: 0 })).toBe('soloUnpriced')
    expect(cardsRowMode({ scenarioCount: 1, alternateCount: 0, bidVersionCount: 1, soloRevenue: null })).toBe('solo')
  })

  it('a second price, a second GC, or only alternates is the tray', () => {
    expect(cardsRowMode({ scenarioCount: 2, alternateCount: 0, bidVersionCount: 1, soloRevenue: 0 })).toBe('row')
    expect(cardsRowMode({ scenarioCount: 1, alternateCount: 0, bidVersionCount: 2, soloRevenue: 0 })).toBe('row')
    expect(cardsRowMode({ scenarioCount: 0, alternateCount: 1, bidVersionCount: 2, soloRevenue: null })).toBe('row')
  })
})

describe('copySourceFor', () => {
  const scenarios = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  const rev: Record<string, number> = { a: 0, b: 500, c: 700 }
  const revenueOf = (id: string) => rev[id] ?? null

  it('the ★ price when it is priced and not the one open', () => {
    expect(copySourceFor({ scenarios, starredId: 'c', viewingId: 'a', revenueOf })?.id).toBe('c')
  })

  it('else the first other priced one — the ★ open, the ★ unpriced, or no ★', () => {
    expect(copySourceFor({ scenarios, starredId: 'c', viewingId: 'c', revenueOf })?.id).toBe('b')
    expect(copySourceFor({ scenarios, starredId: 'a', viewingId: 'a', revenueOf })?.id).toBe('b')
    expect(copySourceFor({ scenarios, starredId: null, viewingId: 'b', revenueOf })?.id).toBe('c')
  })

  it('none when nothing else is priced (a price still loading does not count)', () => {
    expect(copySourceFor({ scenarios: [{ id: 'a' }, { id: 'z' }], starredId: 'z', viewingId: 'a', revenueOf })).toBeNull()
  })
})
