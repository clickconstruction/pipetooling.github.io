import { describe, it, expect } from 'vitest'
import { planBookEditBidOffer, planSiblingCarry, type BookEntryPrices } from './bookEditBidOffer'

const prices = (total: number, rough = 0, top = 0, trim = 0): BookEntryPrices => ({
  rough_in_price: rough,
  top_out_price: top,
  trim_set_price: trim,
  total_price: total,
})

const WATER = 'fixture-water-line'
const base = {
  fixtureTypeId: WATER,
  fixtureName: 'Ft of Water Line',
  hasActiveBidPricing: true,
  editedBookFeedsThisBid: true,
}

describe('planBookEditBidOffer', () => {
  it('offers to carry the edit across when the bid copy is stale — Wendi 12 → 13', () => {
    expect(
      planBookEditBidOffer({
        ...base,
        book: prices(13),
        bidEntries: [{ id: 'bid-entry', fixture_type_id: WATER, ...prices(12) }],
      }),
    ).toEqual({ kind: 'update', bidEntryId: 'bid-entry', fixtureName: 'Ft of Water Line', bidTotal: 12, bookTotal: 13 })
  })

  it('offers to add when the bid copy has never heard of the fixture', () => {
    // "feet of water line" lives only in the Default template — searching the bid's book for it
    // turns up nothing, which is the "it isnt coming up when im trying to add it in" half.
    expect(
      planBookEditBidOffer({ ...base, fixtureName: 'feet of water line', book: prices(13), bidEntries: [] }),
    ).toEqual({ kind: 'add', fixtureName: 'feet of water line', bookTotal: 13 })
  })

  it('says nothing when the bid copy already agrees', () => {
    expect(
      planBookEditBidOffer({
        ...base,
        book: prices(13),
        bidEntries: [{ id: 'bid-entry', fixture_type_id: WATER, ...prices(13) }],
      }),
    ).toBeNull()
  })

  it('notices a stage-price difference even when the totals match', () => {
    expect(
      planBookEditBidOffer({
        ...base,
        book: prices(13, 13, 0, 0),
        bidEntries: [{ id: 'bid-entry', fixture_type_id: WATER, ...prices(13, 0, 13, 0) }],
      }),
    ).toMatchObject({ kind: 'update', bidEntryId: 'bid-entry' })
  })

  it('says nothing when no bid is open — the common case for a book edit', () => {
    expect(
      planBookEditBidOffer({ ...base, hasActiveBidPricing: false, book: prices(13), bidEntries: [] }),
    ).toBeNull()
  })

  it('ignores other fixtures in the bid copy', () => {
    expect(
      planBookEditBidOffer({
        ...base,
        book: prices(13),
        bidEntries: [{ id: 'other', fixture_type_id: 'fixture-waste-line', ...prices(99) }],
      }),
    ).toEqual({ kind: 'add', fixtureName: 'Ft of Water Line', bookTotal: 13 })
  })

  it('picks the first disagreeing duplicate when a copy holds the fixture twice', () => {
    expect(
      planBookEditBidOffer({
        ...base,
        book: prices(13),
        bidEntries: [
          { id: 'agrees', fixture_type_id: WATER, ...prices(13) },
          { id: 'stale', fixture_type_id: WATER, ...prices(12) },
        ],
      }),
    ).toMatchObject({ kind: 'update', bidEntryId: 'stale' })
  })

  it('says nothing when every duplicate already agrees', () => {
    expect(
      planBookEditBidOffer({
        ...base,
        book: prices(13),
        bidEntries: [
          { id: 'a', fixture_type_id: WATER, ...prices(13) },
          { id: 'b', fixture_type_id: WATER, ...prices(13) },
        ],
      }),
    ).toBeNull()
  })

  it('says nothing for a blank fixture name', () => {
    expect(planBookEditBidOffer({ ...base, fixtureName: '   ', book: prices(13), bidEntries: [] })).toBeNull()
  })

  it('compares numerically — a string price from the wire is not a difference', () => {
    expect(
      planBookEditBidOffer({
        ...base,
        book: prices(13),
        bidEntries: [
          { id: 'bid-entry', fixture_type_id: WATER, ...(prices('13' as unknown as number) as BookEntryPrices) },
        ],
      }),
    ).toBeNull()
  })
})

// v2.2445: an update is a same-book sync; an add is an import from any book.
describe('cross-book gating', () => {
  it('never offers an update from a book this bid does not price from', () => {
    expect(
      planBookEditBidOffer({
        ...base,
        editedBookFeedsThisBid: false,
        book: prices(6150),
        bidEntries: [{ id: 'bid-entry', fixture_type_id: WATER, ...prices(1500) }],
      }),
    ).toBeNull()
  })

  it('still offers an add from a foreign book — the Default-book import case', () => {
    expect(
      planBookEditBidOffer({ ...base, editedBookFeedsThisBid: false, book: prices(13), bidEntries: [] }),
    ).toEqual({ kind: 'add', fixtureName: 'Ft of Water Line', bookTotal: 13 })
  })
})

// v2.2445: "on this bid" covers the bid's other price options that inherited the same stale value.
describe('planSiblingCarry', () => {
  it('carries to siblings holding the identical stale prices — BP384: three copies, all $12', () => {
    expect(
      planSiblingCarry({
        stale: prices(12),
        siblingEntries: [
          { id: 'e-planhub', version_id: 'p-planhub', ...prices(12) },
          { id: 'e-ve', version_id: 'p-ve', ...prices(12) },
        ],
      }),
    ).toEqual({ entryIds: ['e-planhub', 'e-ve'], pricingIds: ['p-planhub', 'p-ve'] })
  })

  it('leaves a deliberately re-priced sibling alone', () => {
    expect(
      planSiblingCarry({
        stale: prices(12),
        siblingEntries: [
          { id: 'e-inherited', version_id: 'p-a', ...prices(12) },
          { id: 'e-veed', version_id: 'p-b', ...prices(9.5) },
        ],
      }),
    ).toEqual({ entryIds: ['e-inherited'], pricingIds: ['p-a'] })
  })

  it('a stage-price difference is a deliberate change too', () => {
    expect(
      planSiblingCarry({
        stale: prices(12, 12, 0, 0),
        siblingEntries: [{ id: 'e', version_id: 'p', ...prices(12, 0, 12, 0) }],
      }),
    ).toEqual({ entryIds: [], pricingIds: [] })
  })

  it('dedupes pricing ids when a copy holds the fixture twice', () => {
    expect(
      planSiblingCarry({
        stale: prices(12),
        siblingEntries: [
          { id: 'e1', version_id: 'p-a', ...prices(12) },
          { id: 'e2', version_id: 'p-a', ...prices(12) },
        ],
      }),
    ).toEqual({ entryIds: ['e1', 'e2'], pricingIds: ['p-a'] })
  })

  it('empty siblings carry nothing', () => {
    expect(planSiblingCarry({ stale: prices(12), siblingEntries: [] })).toEqual({ entryIds: [], pricingIds: [] })
  })
})
