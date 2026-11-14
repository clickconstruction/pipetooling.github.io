import { describe, expect, it } from 'vitest'
import type { BookPriceRow } from './bookPrice'
import { priceWords } from './bookPrice'
import { tieCanon, type PartTie } from './partTies'
import { isLeftOut, latestSitePrices, ownRowKey, rowSitePrices, sitePick, sitePriceLookup, sitePriceWords, type SitePrice } from './sitePrices'

const TODAY = '2026-11-13'
let n = 0
function answer(rowKey: string, over: Partial<SitePrice> = {}): SitePrice {
  n += 1
  return { id: `s${n}`, rowKey, rowName: rowKey, kind: 'price', unitPrice: 3.12, source: 'bill', sourceLineId: 'l1', sourceWords: 'Pecan Supply', pricedOn: '2026-09-30', byName: 'Dana', at: `2026-11-13T15:00:${String(n).padStart(2, '0')}Z`, ...over }
}
const bookRow = (partId: string, price: number, checkedOn: string): BookPriceRow => ({ partId, supplyHouse: 'Pecan Supply', price, checkedOn })
const tie = (aKey: string, bKey: string): PartTie => ({ id: `${aKey}|${bKey}`, aKey, bKey, aName: aKey, bName: bKey, verdict: 'same', byName: 'Dana', at: '2026-11-13T12:00:00Z' })

function lookup(args: { book?: Record<string, BookPriceRow[]>; invoice?: Record<string, number>; site?: SitePrice[]; ties?: PartTie[] }) {
  const latest = latestSitePrices(args.site ?? [])
  return sitePriceLookup({ book: (id) => args.book?.[id] ?? [], invoice: (k) => args.invoice?.[k] ?? null, site: (k) => latest.get(k), canon: tieCanon(args.ties ?? []), today: TODAY })
}

describe('a site’s own price in the one rule', () => {
  it('a typed name reads the price accepted for its row, however the line was spelled', () => {
    expect(ownRowKey('text:1/2" pex male adapters')).toBe('words:1/2" adapter male pex')
    const exact = lookup({ site: [answer(ownRowKey('text:1/2" pex male adapters'))] })
    // A bare 1/2 is not read as 1/2 inch: that name is another row, with no price.
    expect(exact('text:pex 1/2 male adapter')).toBeNull()
    expect(exact('text:1/2 inch PEX male adapter')).toMatchObject({ price: 3.12, from: 'site', via: 'bill', supplyHouse: 'Pecan Supply', checkedOn: '2026-09-30', stale: false })
  })
  it('a fresh parts-book price comes first, and the site’s price outranks a stale one', () => {
    const site = [answer('id:p1', { unitPrice: 5.35, pricedOn: '2026-10-28' })]
    expect(lookup({ site, book: { p1: [bookRow('p1', 4.9, '2026-10-03')] } })('id:p1')).toMatchObject({ from: 'book', price: 4.9 })
    expect(lookup({ site, book: { p1: [bookRow('p1', 4.9, '2026-07-14')] } })('id:p1')).toMatchObject({ from: 'site', price: 5.35 })
    expect(lookup({ book: { p1: [bookRow('p1', 4.9, '2026-07-14')] } })('id:p1')).toMatchObject({ from: 'book', stale: true })
  })
  it('the site’s price outranks the invoice price kept on this device', () => {
    const key = 'text:lav sink, white'
    expect(lookup({ invoice: { [key]: 120 } })(key)).toMatchObject({ from: 'invoice', price: 120 })
    expect(lookup({ invoice: { [key]: 120 }, site: [answer(ownRowKey(key), { unitPrice: 148, source: 'typed', sourceWords: '', sourceLineId: null, pricedOn: TODAY })] })(key)).toMatchObject({ from: 'site', via: 'typed', price: 148 })
  })
  it('a typed name tied to a parts-book part reads that part’s price, on any screen', () => {
    const own = ownRowKey('text:1" pex tees')
    const price = lookup({ ties: [tie('id:tee', own)], book: { tee: [bookRow('tee', 2.86, '2026-10-03')] } })
    expect(price('text:1" pex tees')).toMatchObject({ from: 'book', price: 2.86 })
  })
  it('Just price: a parts-book part’s price without the tie keeps the row its own, dated the book’s check', () => {
    const own = ownRowKey('text:1" pex tees')
    const just = answer(own, { unitPrice: 2.86, source: 'book', sourceLineId: null, sourceWords: '1" PEX TEE BRASS', pricedOn: '2026-10-03' })
    const pick = lookup({ site: [just] })('text:1" pex tees')
    expect(pick).toMatchObject({ price: 2.86, from: 'site', via: 'book', bookPart: '1" PEX TEE BRASS', supplyHouse: null, checkedOn: '2026-10-03', stale: false })
    expect(priceWords(pick!, TODAY)).toBe('the parts book’s price for 1" PEX TEE BRASS · checked Oct 3')
    expect(sitePriceWords(just, TODAY)).toBe('$2.86 for one · the parts book’s price for 1" PEX TEE BRASS · checked Oct 3 · by Dana, Nov 13')
    // A book price last checked long ago is an old price here too.
    expect(priceWords(sitePick({ ...just, pricedOn: '2026-02-04' }, TODAY)!, TODAY)).toBe('the parts book’s price for 1" PEX TEE BRASS · checked Feb 4, 282 days ago')
  })
  it('a price past 90 days stays a price and is flagged, as a book price is', () => {
    const old = sitePick(answer('words:x y', { pricedOn: '2026-02-04' }), TODAY)
    expect(old).toMatchObject({ price: 3.12, stale: true, ageDays: 282 })
    expect(priceWords(old!, TODAY)).toBe('Pecan Supply’s bill · Feb 4, 282 days ago')
  })
  it('the newest answer of a row is the one read, and a row left out has no price', () => {
    const key = 'words:fitting odd of tote'
    const first = answer(key, { unitPrice: 1 })
    const out = answer(key, { kind: 'left_out', unitPrice: null })
    expect(lookup({ site: [first, out] })('text:tote of odd fittings')).toBeNull()
    expect(isLeftOut({ key, memberKeys: [key] }, [first, out])).toBe(true)
    expect(isLeftOut({ key, memberKeys: [key] }, [first])).toBe(false)
    expect(rowSitePrices({ key, memberKeys: [key] }, [first, out]).map((p) => p.id)).toEqual([out.id, first.id])
  })
})

describe('the words', () => {
  it('says where a price came from, who accepted it and when', () => {
    expect(sitePriceWords(answer('words:a b'), TODAY)).toBe('$3.12 for one · Pecan Supply’s bill · Sep 30 · by Dana, Nov 13')
    expect(sitePriceWords(answer('words:a b', { source: 'typed', sourceWords: '', unitPrice: 148, pricedOn: TODAY }), TODAY)).toBe('$148.00 for one · typed · Nov 13 · by Dana, Nov 13')
    expect(sitePriceWords(answer('words:a b', { kind: 'left_out', unitPrice: null }), TODAY)).toBe('Left out, not a part · by Dana, Nov 13')
    expect(priceWords(sitePick(answer('words:a b', { source: 'typed', sourceWords: '', pricedOn: TODAY }), TODAY)!, TODAY)).toBe('typed by Dana · Nov 13')
  })
})
