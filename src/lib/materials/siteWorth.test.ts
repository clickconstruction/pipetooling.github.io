import { describe, expect, it } from 'vitest'
import type { PricePick } from './bookPrice'
import { containerLines, type Container, type Movement } from './onSite'
import { orderedPair, tieCanon, type PartTie } from './partTies'
import { rollKey, sitePartRows, type SiteRollupJob } from './siteRollup'
import { bookSearchWords, rowWorth, siteWorth, worthWords } from './siteWorth'

const NOW = new Date('2026-11-12T18:00:00Z')
const book = (price: number, stale = false): PricePick => ({ price, from: 'book', supplyHouse: 'Pecan Supply', checkedOn: stale ? '2026-01-05' : '2026-10-03', ageDays: stale ? 311 : 40, stale })
const invoice = (price: number): PricePick => ({ price, from: 'invoice', supplyHouse: null, checkedOn: null, ageDays: null, stale: false })

// A made-up job: one box per name.
function job(names: Array<[string, number, string?]>): SiteRollupJob {
  const containers: Container[] = names.map((_, i) => ({ id: `b${i}`, jobId: 'ja', label: `R${i + 1}`, kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-01T00:00:00Z' }))
  const movements: Movement[] = names.map(([name, quantity, partId], i) => ({ id: `m${i}`, jobId: 'ja', partId: partId ?? null, partName: name, manufacturer: null, quantity, reason: 'delivered', fromContainerId: null, toContainerId: `b${i}`, note: '', byUserId: null, byName: 'Priya', at: '2026-11-10T12:00:00Z', source: null, itemId: null }))
  return { jobId: 'ja', label: 'J1042', containers, places: [], lines: containerLines(movements) }
}
const site = [job([['3/4 COPPER TEE', 300, 'book-1'], ['2" 90 pvc', 94], ['2 inch 90 PVC', 42], ['Wax ring', 12], ['Old valve', 5, 'book-2'], ['Scrap', 1]])]
const prices = (key: string): PricePick | null => (key === 'id:book-1' ? book(2.18) : key === 'id:book-2' ? book(10, true) : key === 'id:book-9' ? book(1.5) : key === 'text:wax ring' ? invoice(3) : null)

describe('rowWorth', () => {
  const rows = sitePartRows(site, NOW)
  it('a parts-book row reads the book price across all its lines', () => {
    const w = rowWorth(rows.find((r) => r.partId === 'book-1')!, prices)
    expect(w).toMatchObject({ money: 654, lines: 1, pricedLines: 1, staleLines: 0 })
    expect(w.pick?.from).toBe('book')
  })
  it('a typed row reads the invoice price of each line, or nothing', () => {
    expect(rowWorth(rows.find((r) => r.name === 'Wax ring')!, prices)).toMatchObject({ money: 36, pricedLines: 1, pick: { from: 'invoice' } })
    expect(rowWorth(rows.find((r) => r.name === '2" 90 pvc')!, prices)).toMatchObject({ money: 0, lines: 2, pricedLines: 0 })
  })
})

describe('siteWorth: the figure and its cover', () => {
  it('adds what is known, counts the cover and the stale prices, and lists the unpriced rows biggest first', () => {
    const w = siteWorth(sitePartRows(site, NOW), prices)
    expect(w.known).toBe(654 + 36 + 50)
    expect(w.lines).toBe(6)
    expect(w.pricedLines).toBe(3)
    expect(w.staleLines).toBe(1)
    expect(w.unpriced.map((r) => r.name)).toEqual(['2" 90 pvc', 'Scrap'])
    expect(worthWords(w)).toEqual({ big: '$740.00 known', small: '3 of 6 lines have a price · 1 on a price older than 90 days' })
  })
  it('a typed name tied to the parts book takes the book price, and the cover grows', () => {
    const [aKey, bKey] = orderedPair('id:book-9', rollKey({ partId: null, partName: '2" 90 pvc' }))
    const ties: PartTie[] = [{ id: 't1', aKey, bKey, aName: '2 PVC 90 DWV', bName: '2" 90 pvc', verdict: 'same', byName: 'Dana', at: '2026-11-12T10:00:00Z' }]
    const rows = sitePartRows(site, NOW, tieCanon(ties), new Map([['id:book-9', '2 PVC 90 DWV']]))
    const tied = rows.find((r) => r.partId === 'book-9')!
    expect(tied.name).toBe('2 PVC 90 DWV')
    expect(tied.total).toBe(136)
    expect(rowWorth(tied, prices)).toMatchObject({ money: 204, lines: 2, pricedLines: 2 })
    const w = siteWorth(rows, prices)
    expect(w.pricedLines).toBe(5)
    expect(w.unpriced.map((r) => r.name)).toEqual(['Scrap'])
  })
  it('says so when nothing has a price, and never drops the cover', () => {
    expect(worthWords(siteWorth(sitePartRows(site, NOW), () => null))).toEqual({ big: 'No price yet', small: '0 of 6 lines have a price' })
    expect(worthWords({ known: 0, lines: 0, pricedLines: 0, staleLines: 0 }).small).toBe('no line on hand')
    expect(worthWords({ known: 5, lines: 1, pricedLines: 1, staleLines: 0 }).small).toBe('1 of 1 line has a price')
  })
})

describe('bookSearchWords', () => {
  it('sets the inch marks and punctuation aside', () => {
    expect(bookSearchWords('2” 45 pvc')).toEqual(['2', '45', 'pvc'])
    expect(bookSearchWords('3/4" Copper Tee, (bag)')).toEqual(['3/4', 'copper', 'tee', 'bag'])
  })
})

describe('rows left out and rows on an old price (punch list #342)', () => {
  const rows = sitePartRows(site, NOW)
  it('a row set aside as not a part is counted nowhere, and the cover says how many lines were left out', () => {
    const w = siteWorth(rows, prices, (r) => r.name === 'Scrap' || r.name === 'Wax ring')
    expect(w.leftOut.map((r) => r.name)).toEqual(['Wax ring', 'Scrap'])
    expect(w.leftOutLines).toBe(2)
    expect(w.unpriced.map((r) => r.name)).toEqual(['2" 90 pvc'])
    expect(w.known).toBe(704)
    expect(worthWords(w).small).toBe('2 of 4 lines have a price · 1 on a price older than 90 days · 2 left out')
  })
  it('lists the rows on a price older than 90 days', () => {
    expect(siteWorth(rows, prices).stale.map((r) => r.name)).toEqual(['Old valve'])
  })
})
