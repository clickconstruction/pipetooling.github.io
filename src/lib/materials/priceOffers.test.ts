import { describe, expect, it } from 'vitest'
import type { BookPriceRow } from './bookPrice'
import { bookSearchFolded, buildOfferIndex, offerRowsWords, offerTokens, offerWords, rowOffers, siteOffers, type OfferLine, type OfferPart, type OfferSources } from './priceOffers'

const TODAY = '2026-11-13'

// A made-up parts book and a made-up year of bills.
const parts: OfferPart[] = [
  { id: 'p-pvc90', name: '2" PVC DWV 90', manufacturer: 'Charlotte' },
  { id: 'p-cu90', name: '2" COPPER 90 WROT', manufacturer: null },
  { id: 'p-pvc90-3', name: '3" PVC DWV 90', manufacturer: 'Charlotte' },
  { id: 'p-tee', name: '1" PEX TEE BRASS', manufacturer: null },
  { id: 'p-noprice', name: '1" PEX TEE POLY', manufacturer: null },
  { id: 'p-oil', name: 'CUTTING OIL QUART', manufacturer: null },
]
const price = (partId: string, p: number, checkedOn: string | null, supplyHouse = 'Pecan Supply'): BookPriceRow => ({ partId, supplyHouse, price: p, checkedOn })
const prices: BookPriceRow[] = [price('p-pvc90', 2.41, '2026-10-03'), price('p-cu90', 18.6, '2026-09-12'), price('p-pvc90-3', 6.1, '2026-10-03'), price('p-tee', 2.86, '2026-01-05'), price('p-oil', 9, '2026-10-03')]
const line = (id: string, description: string, unitPrice: number, datedOn: string, over: Partial<OfferLine> = {}): OfferLine => ({ id, houseId: 'h1', houseName: 'Pecan Supply', datedOn, houseCode: id.toUpperCase(), description, unit: 'EA', pricingUnit: 'each', unitPrice, quantity: 10, extendedCents: Math.round(unitPrice * 1000), ...over })
const lines: OfferLine[] = [
  line('l1', '2 PVC DWV 90 ELL HXH', 2.18, '2026-10-09', { houseId: 'h2', houseName: 'Cedar Fork Supply' }),
  line('l2', '2 pvc dwv 90 ell HxH', 2.05, '2026-06-01', { houseId: 'h2', houseName: 'Cedar Fork Supply', houseCode: 'OTHER-NO' }),
  line('l3', '1/2 PEX X 1/2 MIP ADAPTER', 312, '2026-09-30', { pricingUnit: 'per_hundred' }),
  line('l4', '1/2 PEX X 1/2 MIP ADAPTER', 3, '2026-09-01', { quantity: -4, extendedCents: -1200, houseCode: 'CR' }),
]
const sources: OfferSources = { parts, prices, lines }
const index = buildOfferIndex(sources, TODAY)
const typed = (name: string) => ({ name, partId: null })

describe('offerTokens', () => {
  it('reads a crew name and a bill line the same way, with the inch mark set aside', () => {
    expect(offerTokens('2" 90 pvc')).toEqual(['2', '90', 'pvc'])
    expect(offerTokens('2 inch 90s PVC')).toEqual(['2', '90', 'pvc'])
    expect(offerTokens('1" pex tees')).toEqual(['1', 'pex', 'tee'])
  })
  it('opens the picker on the folded words, a size by size written as the book writes it', () => {
    expect(bookSearchFolded('1" pex tees')).toBe('1 pex tee')
    expect(bookSearchFolded('4 x 3 wyes')).toBe('4x3 wye')
  })
})

describe('rowOffers', () => {
  it('a name with no material gets a list, never one answer', () => {
    const offers = rowOffers(typed('2" 90'), index)
    expect(offers.map((o) => o.key)).toEqual(['book:p-pvc90', 'book:p-cu90', 'bill:l1'])
    expect(offers.filter((o) => o.kind === 'book').map((o) => (o.kind === 'book' ? o.pick.price : 0))).toEqual([2.41, 18.6])
  })
  it('a name with its material narrows to that material', () => {
    expect(rowOffers(typed('2 inch 90 pvc'), index).map((o) => o.key)).toEqual(['book:p-pvc90', 'bill:l1'])
  })
  it('a different size is never offered', () => {
    expect(rowOffers(typed('4" 90 pvc'), index)).toEqual([])
    expect(rowOffers(typed('3" 90 pvc'), index).map((o) => o.key)).toEqual(['book:p-pvc90-3'])
  })
  it('a name of one word is offered nothing', () => {
    expect(rowOffers(typed('Oil'), index)).toEqual([])
  })
  it('a parts-book part with no price in the book is not an offer, and a stale one says so', () => {
    const offers = rowOffers(typed('1" pex tees'), index)
    expect(offers.map((o) => o.key)).toEqual(['book:p-tee'])
    expect(offers[0]).toMatchObject({ kind: 'book', pick: { stale: true } })
  })
  it('a bill priced by the hundred is offered at its price for one, and a credit is not a price', () => {
    const offers = rowOffers(typed('1/2" pex mip adapters'), index)
    expect(offers).toHaveLength(1)
    expect(offers[0]).toMatchObject({ kind: 'bill', lineId: 'l3', priceEach: 3.12, bills: 1 })
  })
  it('one offer per house and wording: the newest line, with how many lines read the same', () => {
    const bill = rowOffers(typed('2 pvc 90'), index).find((o) => o.kind === 'bill')
    expect(bill).toMatchObject({ lineId: 'l1', priceEach: 2.18, bills: 2, houseName: 'Cedar Fork Supply' })
  })
  it('a row that is already a parts-book part is offered bills only', () => {
    expect(rowOffers({ name: '2" PVC DWV 90', partId: 'p-pvc90' }, index).map((o) => o.kind)).toEqual(['bill'])
  })
})

describe('the words', () => {
  it('an offer always says Offer, its source and its day', () => {
    const [book, , bill] = rowOffers(typed('2" 90'), index)
    expect(offerWords(book!, TODAY)).toEqual({ name: '2" PVC DWV 90', from: 'Offer · parts book · checked Oct 3', price: '$2.41' })
    expect(offerWords(bill!, TODAY)).toEqual({ name: '2 PVC DWV 90 ELL HXH', from: 'Offer · a bill · Cedar Fork Supply · Oct 9 · sold by EA', price: '$2.18 each' })
  })
  it('counts the rows with an offer, never dollars', () => {
    const rows = [{ key: 'a', ...typed('2" 90') }, { key: 'b', ...typed('Scrap') }, { key: 'c', ...typed('1" pex tees') }]
    const found = siteOffers(rows, index)
    expect([...found.keys()]).toEqual(['a', 'c'])
    expect(offerRowsWords(found.size)).toBe('2 rows have an offer')
    expect(offerRowsWords(1)).toBe('1 row has an offer')
    expect(offerRowsWords(0)).toBe('')
  })
})
