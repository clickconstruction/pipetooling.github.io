import { describe, expect, it } from 'vitest'
import { BOOK_PRICE_FRESH_DAYS, bookPartIds, bookPriceRow, invoicePick, isRealPrice, pickBookPrice, priceLookup, priceTitle, priceWords, type BookPriceRow } from './bookPrice'
import { PLACEHOLDER_PRICE } from './materialPriceIndex'

const TODAY = '2026-11-07'
const row = (over: Partial<BookPriceRow>): BookPriceRow => ({ partId: 'p1', supplyHouse: 'Pecan Supply', price: 4.7, checkedOn: '2026-10-03', ...over })

describe('bookPriceRow', () => {
  it('reads the checked day off effective_date first, then the row’s updated day, else never', () => {
    expect(bookPriceRow({ part_id: 'p1', price: 4.7, effective_date: '2026-10-03', updated_at: '2026-09-01T15:00:00Z', supply_houses: { name: 'Pecan Supply' } })).toEqual(row({}))
    expect(bookPriceRow({ part_id: 'p1', price: 4.7, effective_date: null, updated_at: '2026-09-01T15:00:00Z', supply_houses: { name: 'Pecan Supply' } }).checkedOn).toBe('2026-09-01')
    expect(bookPriceRow({ part_id: 'p1', price: 4.7, effective_date: null, updated_at: null, supply_houses: null })).toEqual({ partId: 'p1', supplyHouse: '', price: 4.7, checkedOn: null })
  })
})

describe('pickBookPrice', () => {
  it('takes the price checked most recently, whatever the house', () => {
    const pick = pickBookPrice([row({ supplyHouse: 'Oak Hollow Plumbing Supply', price: 4.1, checkedOn: '2026-06-01' }), row({ price: 4.7, checkedOn: '2026-10-03' })], TODAY)
    expect(pick).toMatchObject({ price: 4.7, from: 'book', supplyHouse: 'Pecan Supply', checkedOn: '2026-10-03', ageDays: 35, stale: false })
  })

  it('breaks a same-day tie on the lower price', () => {
    expect(pickBookPrice([row({ price: 4.7 }), row({ supplyHouse: 'Oak Hollow Plumbing Supply', price: 4.1 })], TODAY)?.price).toBe(4.1)
  })

  it('puts a price never checked after every dated one, and calls it stale', () => {
    expect(pickBookPrice([row({ price: 3.9, checkedOn: null }), row({ price: 4.7, checkedOn: '2026-01-02' })], TODAY)).toMatchObject({ price: 4.7, stale: true, ageDays: 309 })
    expect(pickBookPrice([row({ price: 3.9, checkedOn: null })], TODAY)).toMatchObject({ price: 3.9, stale: true, ageDays: null, checkedOn: null })
  })

  it(`calls a check older than ${BOOK_PRICE_FRESH_DAYS} days stale and one at the edge fresh`, () => {
    expect(pickBookPrice([row({ checkedOn: '2026-08-09' })], TODAY)).toMatchObject({ ageDays: 90, stale: false })
    expect(pickBookPrice([row({ checkedOn: '2026-08-08' })], TODAY)).toMatchObject({ ageDays: 91, stale: true })
  })

  it('returns null for no rows and skips a row with no number', () => {
    expect(pickBookPrice([], TODAY)).toBeNull()
    expect(pickBookPrice([row({ price: Number.NaN })], TODAY)).toBeNull()
  })

  it('never takes a zero or the book’s stand-in for a price (v2.7249)', () => {
    // A row at 0 used to win the same-day tie as the lower price and read as known and fresh.
    expect(pickBookPrice([row({ price: 4.7 }), row({ supplyHouse: 'Oak Hollow Plumbing Supply', price: 0 })], TODAY)).toMatchObject({ price: 4.7, supplyHouse: 'Pecan Supply' })
    // The stand-in, checked today, loses to a real price checked months ago.
    expect(pickBookPrice([row({ price: PLACEHOLDER_PRICE, checkedOn: TODAY }), row({ price: 4.7, checkedOn: '2026-06-01' })], TODAY)).toMatchObject({ price: 4.7, checkedOn: '2026-06-01' })
    // With nothing else, the part has no price at all.
    expect(pickBookPrice([row({ price: 0 })], TODAY)).toBeNull()
    expect(pickBookPrice([row({ price: PLACEHOLDER_PRICE })], TODAY)).toBeNull()
    expect(pickBookPrice([row({ price: 1_250_000 })], TODAY)).toBeNull()
  })

  it('holds the invoice price to the same rule, and one money figure to the next source', () => {
    for (const p of [0, -1, PLACEHOLDER_PRICE, Number.NaN, Number.POSITIVE_INFINITY, null]) expect(invoicePick(p), String(p)).toBeNull()
    expect(invoicePick(0.01)).toMatchObject({ price: 0.01, from: 'invoice' })
    expect(isRealPrice(999_998.99)).toBe(true)
    // A book page that holds only the stand-in reads the invoice price the office typed.
    const price = priceLookup(() => [row({ price: PLACEHOLDER_PRICE })], () => 3.25, TODAY)
    expect(price('id:p1')).toMatchObject({ price: 3.25, from: 'invoice' })
    // And with no invoice price either, it has no price: never a million dollars a piece.
    expect(priceLookup(() => [row({ price: PLACEHOLDER_PRICE })], () => null, TODAY)('id:p1')).toBeNull()
  })
})

describe('priceLookup', () => {
  const book = new Map<string, BookPriceRow[]>([
    ['fresh', [row({ partId: 'fresh', price: 4.7, checkedOn: '2026-10-03' })]],
    ['old', [row({ partId: 'old', price: 18.6, checkedOn: '2026-05-01' })]],
  ])
  const invoice = new Map<string, number>([
    ['id:fresh', 4.2],
    ['id:old', 17.9],
    ['text:wax ring', 2.1],
  ])
  const lookup = priceLookup((id) => book.get(id) ?? [], (k) => invoice.get(k) ?? null, TODAY)

  it('prefers a fresh book price to the invoice’s', () => {
    expect(lookup('id:fresh')).toMatchObject({ price: 4.7, from: 'book', stale: false })
  })

  it('falls back to the invoice price when the book’s is older than 90 days', () => {
    expect(lookup('id:old')).toMatchObject({ price: 17.9, from: 'invoice', stale: false, checkedOn: null })
  })

  it('shows a stale book price, flagged, when no invoice price was read', () => {
    const only = priceLookup((id) => book.get(id) ?? [], () => null, TODAY)
    expect(only('id:old')).toMatchObject({ price: 18.6, from: 'book', stale: true, ageDays: 190 })
  })

  it('prices a part with no book page off the invoice, and a typed name only ever off the invoice', () => {
    expect(lookup('id:unknown')).toBeNull()
    expect(lookup('text:wax ring')).toMatchObject({ price: 2.1, from: 'invoice' })
    const bookOnly = priceLookup(() => [row({ partId: 'x' })], () => null, TODAY)
    expect(bookOnly('text:wax ring')).toBeNull()
  })
})

describe('the words beside the money', () => {
  it('names the book and the checked day, the age when stale, the invoice otherwise', () => {
    expect(priceWords(pickBookPrice([row({ checkedOn: '2026-10-03' })], TODAY)!, TODAY)).toBe('parts book · checked Oct 3')
    expect(priceWords(pickBookPrice([row({ checkedOn: '2025-07-01' })], TODAY)!, TODAY)).toBe('parts book · checked Jul 1, 2025, 494 days ago')
    expect(priceWords(pickBookPrice([row({ checkedOn: null })], TODAY)!, TODAY)).toBe('parts book · never checked')
    expect(priceWords(priceLookup(() => [], () => 2.1, TODAY)('text:wax ring')!, TODAY)).toBe('invoice price')
  })

  it('writes the title with the supply house', () => {
    expect(priceTitle(pickBookPrice([row({ checkedOn: '2026-10-03' })], TODAY)!, TODAY)).toBe('Pecan Supply’s price, checked Oct 3.')
    expect(priceTitle(pickBookPrice([row({ checkedOn: '2026-05-01' })], TODAY)!, TODAY)).toBe('Pecan Supply’s price, checked May 1, older than 90 days.')
    expect(priceTitle(pickBookPrice([row({ supplyHouse: '', checkedOn: null })], TODAY)!, TODAY)).toBe('The parts book’s price, never checked.')
    expect(priceTitle(priceLookup(() => [], () => 2.1, TODAY)('text:wax ring')!, TODAY)).toBe('The price typed off the invoice that landed the part.')
  })
})

describe('bookPartIds', () => {
  it('lists each book part once and leaves typed names out', () => {
    expect(bookPartIds([{ partId: 'a' }, { partId: null }, { partId: 'a' }, { partId: 'b' }])).toEqual(['a', 'b'])
  })
})
