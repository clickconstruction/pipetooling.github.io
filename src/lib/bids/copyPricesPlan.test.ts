/**
 * Copy prices, the part between the reads and the writes, as `BidsPricingTab` ran it inline before
 * the move (decomposition queue row 1). The last block prices a real source with
 * `scenarioPricingRows` and pairs the rows with `rekeyRowMap`, as the tab does, so the dollars that
 * land on each row are pinned end to end.
 */
import { describe, expect, it } from 'vitest'
import { copyPricesCrossesVersions, copyPricesOutcomeWords, copyPricesPlan } from './copyPricesPlan'
import { rekeyRowMap } from './rekeyClonedPricing'
import { scenarioPricingRows } from './scenarioPricingRows'

const row = (id: string, unitPrice: number, priced = true) => ({ countRow: { id }, priced, unitPrice })

describe('copyPricesCrossesVersions', () => {
  it('a source on another version crosses', () => {
    expect(copyPricesCrossesVersions('ver-a', 'ver-b')).toBe(true)
    expect(copyPricesCrossesVersions('ver-a', null)).toBe(true)
  })
  it('a source on the version on screen, or with no version, does not', () => {
    expect(copyPricesCrossesVersions('ver-b', 'ver-b')).toBe(false)
    expect(copyPricesCrossesVersions(null, null)).toBe(false)
    // An unversioned source under a versioned bid prices the rows on screen as they are.
    expect(copyPricesCrossesVersions(null, 'ver-b')).toBe(false)
  })
})

describe('copyPricesPlan', () => {
  it('on the same version every priced row lands on its own row, in order', () => {
    expect(copyPricesPlan([row('wc', 800), row('lav', 500)], null)).toEqual({
      writes: [
        { targetRowId: 'wc', unitPrice: 800 },
        { targetRowId: 'lav', unitPrice: 500 },
      ],
      dropped: 0,
    })
  })
  it('a row nothing prices is skipped and not counted as dropped', () => {
    expect(copyPricesPlan([row('wc', 800), row('fd', 0, false)], null)).toEqual({ writes: [{ targetRowId: 'wc', unitPrice: 800 }], dropped: 0 })
  })
  it('a saved $0 is a price and copies like any other', () => {
    expect(copyPricesPlan([row('demo', 0)], null)).toEqual({ writes: [{ targetRowId: 'demo', unitPrice: 0 }], dropped: 0 })
  })
  it('across versions a price lands on its row\'s counterpart, and one with none is dropped', () => {
    const map = new Map([['wc-a', 'wc-b']])
    expect(copyPricesPlan([row('wc-a', 800), row('lav-a', 500), row('fd-a', 0, false)], map)).toEqual({
      writes: [{ targetRowId: 'wc-b', unitPrice: 800 }],
      dropped: 1,
    })
  })
  it('across versions with no pair at all nothing is written', () => {
    expect(copyPricesPlan([row('wc-a', 800), row('lav-a', 500)], new Map())).toEqual({ writes: [], dropped: 2 })
  })
  it('no rows is nothing to do', () => {
    expect(copyPricesPlan([], null)).toEqual({ writes: [], dropped: 0 })
  })
})

describe('copyPricesOutcomeWords', () => {
  it('some copied and some dropped is said in full, as information', () => {
    expect(copyPricesOutcomeWords(3, 2, 'Base price')).toEqual({ message: 'Copied 3 prices from "Base price" — 2 had no matching row in this packet\'s counts.', tone: 'info' })
    expect(copyPricesOutcomeWords(1, 1, 'Base price').message).toBe('Copied 1 price from "Base price" — 1 had no matching row in this packet\'s counts.')
  })
  it('all copied is a success, with the count', () => {
    expect(copyPricesOutcomeWords(12, 0, 'Base price')).toEqual({ message: 'Copied 12 prices from "Base price".', tone: 'success' })
    expect(copyPricesOutcomeWords(1, 0, 'Base price').message).toBe('Copied 1 price from "Base price".')
  })
  it('none matched is an error that says nothing was copied', () => {
    expect(copyPricesOutcomeWords(0, 4, 'Base price')).toEqual({ message: '"Base price" prices matched none of this packet\'s count rows — nothing copied.', tone: 'error' })
  })
  it('a source with no prices is an error that says so', () => {
    expect(copyPricesOutcomeWords(0, 0, 'Base price')).toEqual({ message: '"Base price" has no prices to copy.', tone: 'error' })
  })
})

describe('one copy, from the source\'s prices to the rows they land on', () => {
  // GC A's base price: water closets at $800 from a custom price, lavatories at $500 from its book, a floor drain nothing prices.
  const SOURCE_ROWS = [
    { id: 'wc-a', fixture: 'Water closet', count: 6, group_tag: null },
    { id: 'lav-a', fixture: 'Lavatory', count: 4, group_tag: null },
    { id: 'fd-a', fixture: 'Floor drain', count: 3, group_tag: null },
  ]
  const priced = scenarioPricingRows({
    scenarioId: 'price-a',
    countRows: SOURCE_ROWS,
    entries: [{ id: 'entry-lav', version_id: 'price-a', fixture_type_id: 'ft-lav', rough_in_price: 200, top_out_price: 150, trim_set_price: 150, total_price: 500, fixture_types: { name: 'Lavatory' } }],
    assignments: [{ count_row_id: 'lav-a', price_book_entry_id: 'entry-lav', price_book_version_id: 'price-a', is_fixed_price: false, unit_price_override: null }],
    customPrices: [{ count_row_id: 'wc-a', price_book_version_id: 'price-a', unit_price: 800 }],
  } as unknown as Parameters<typeof scenarioPricingRows>[0])

  it('the source prices as $800 and $500, and the floor drain as nothing', () => {
    expect(priced.rows.map((r) => [r.countRow.id, r.priced, r.unitPrice])).toEqual([
      ['wc-a', true, 800],
      ['lav-a', true, 500],
      ['fd-a', false, 0],
    ])
  })

  it('copied within the version: $800 on the water closets and $500 on the lavatories', () => {
    const plan = copyPricesPlan(priced.rows, null)
    expect(plan).toEqual({
      writes: [
        { targetRowId: 'wc-a', unitPrice: 800 },
        { targetRowId: 'lav-a', unitPrice: 500 },
      ],
      dropped: 0,
    })
    expect(copyPricesOutcomeWords(plan.writes.length, plan.dropped, 'Base price').message).toBe('Copied 2 prices from "Base price".')
  })

  it("copied to GC B, whose counts have no lavatory: $800 lands on B's water closets and one price is dropped", () => {
    const TARGET_ROWS = [
      { id: 'wc-b', fixture: 'water closet', group_tag: null },
      { id: 'fd-b', fixture: 'Floor drain', group_tag: null },
    ]
    const map = rekeyRowMap(
      SOURCE_ROWS.map((r) => ({ id: r.id, fixture: r.fixture, group_tag: r.group_tag })),
      TARGET_ROWS,
      [],
    )
    const plan = copyPricesPlan(priced.rows, map)
    expect(plan).toEqual({ writes: [{ targetRowId: 'wc-b', unitPrice: 800 }], dropped: 1 })
    expect(copyPricesOutcomeWords(plan.writes.length, plan.dropped, 'Base price')).toEqual({
      message: 'Copied 1 price from "Base price" — 1 had no matching row in this packet\'s counts.',
      tone: 'info',
    })
  })
})
