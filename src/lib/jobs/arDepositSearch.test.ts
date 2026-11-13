import { describe, expect, it } from 'vitest'
import { arSearchFallThrough, matchesArDepositSearch, normalizeArDepositQuery, type ArDepositSearchSlice } from './arDepositSearch'

const row = (id: string, o: Partial<ArDepositSearchSlice> = {}): ArDepositSearchSlice => ({
  mercury_transaction_id: id,
  counterparty_name: null,
  note: null,
  external_memo: null,
  amount: null,
  posted_at: null,
  ...o,
})
const day = (iso: string) => iso.slice(0, 10)

// The rows of 2026-09-30: Lowbe's $6,077.51 was applied (out of To match); Lowbeck $5,622.49 sat in the pile.
const lobers = row('lobers', { counterparty_name: 'Lowbe’s Construction Co', amount: '6077.5100', posted_at: '2026-09-28T22:01:16Z' })
const lowbeck = row('lowbeck', { counterparty_name: 'Lowbeck', amount: '5622.4900', posted_at: '2026-09-28T22:01:16Z' })
const marcos = row('marcos', { counterparty_name: 'Marcos Bakery', amount: 762.12, note: 'J1029', posted_at: '2026-09-30T14:00:00Z' })

describe('matchesArDepositSearch', () => {
  it('reads the counterparty, note, memo, amount with commas and the posted day', () => {
    expect(matchesArDepositSearch(lobers, 'lowbe', day)).toBe(true)
    expect(matchesArDepositSearch(lobers, '6,077.51', day)).toBe(true)
    expect(matchesArDepositSearch(marcos, 'j1029', day)).toBe(true)
    expect(matchesArDepositSearch(row('m', { external_memo: 'Kestrin RR' }), 'kestrin', day)).toBe(true)
    expect(matchesArDepositSearch(lobers, '2026-09-28', day)).toBe(true)
    expect(matchesArDepositSearch(lobers, 'southern', day)).toBe(false)
  })
  it('an amount typed without commas does not match the formatted figure, as before', () => {
    // The modal formats amounts with thousands commas; "6077.51" matches "6,077.51" only through the search box's own words.
    expect(matchesArDepositSearch(lobers, '6077.51', day)).toBe(false)
  })
  it('an empty query matches everything; a formatter that throws is a non-match on the date only', () => {
    expect(matchesArDepositSearch(lobers, '', day)).toBe(true)
    expect(matchesArDepositSearch(lobers, 'lowbe', () => { throw new Error('bad date') })).toBe(true)
    expect(normalizeArDepositQuery('  Lowbe ')).toBe('lowbe')
  })
})

describe('arSearchFallThrough', () => {
  const postedLabel = day
  it('no query: the visible list, untouched, nothing elsewhere', () => {
    const r = arSearchFallThrough({ query: '', visible: [lowbeck, marcos], hidden: [lobers], postedLabel })
    expect(r.hits.map((x) => x.mercury_transaction_id)).toEqual(['lowbeck', 'marcos'])
    expect(r.elsewhere).toEqual([])
    expect(r.heading).toBeNull()
    expect(r.empty).toBeNull()
  })
  it('the cheque already applied: nothing on To match, found in All', () => {
    const r = arSearchFallThrough({ query: '6,077.51', visible: [lowbeck, marcos], hidden: [lobers, lowbeck], postedLabel })
    expect(r.hits).toEqual([])
    expect(r.elsewhere.map((x) => x.mercury_transaction_id)).toEqual(['lobers'])
    expect(r.heading).toBe('Nothing to match · found in All')
    expect(r.empty).toBeNull()
  })
  it('a payer with rows in both lists: hits first, the rest under "Also found in All", never a row twice', () => {
    const r = arSearchFallThrough({ query: 'lowbe', visible: [lowbeck, marcos], hidden: [lobers, lowbeck], postedLabel })
    expect(r.hits.map((x) => x.mercury_transaction_id)).toEqual(['lowbeck'])
    expect(r.elsewhere.map((x) => x.mercury_transaction_id)).toEqual(['lobers'])
    expect(r.heading).toBe('Also found in All')
  })
  it('nothing anywhere says so; before the All rows land it says only that the pile has nothing', () => {
    expect(arSearchFallThrough({ query: 'southern', visible: [lowbeck], hidden: [lobers], postedLabel }).empty).toBe('nowhere')
    expect(arSearchFallThrough({ query: 'southern', visible: [lowbeck], hidden: null, postedLabel }).empty).toBe('unsearched')
  })
  it('on the All list itself (hidden null) the search is the plain filter', () => {
    const r = arSearchFallThrough({ query: 'marcos', visible: [lobers, lowbeck, marcos], hidden: null, postedLabel })
    expect(r.hits.map((x) => x.mercury_transaction_id)).toEqual(['marcos'])
    expect(r.elsewhere).toEqual([])
    expect(r.heading).toBeNull()
  })
})
