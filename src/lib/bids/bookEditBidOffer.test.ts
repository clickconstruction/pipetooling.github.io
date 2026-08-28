import { describe, it, expect } from 'vitest'
import { planBookEditBidOffer, type BookEntryPrices } from './bookEditBidOffer'

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
