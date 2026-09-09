import { describe, expect, it } from 'vitest'

import {
  groupPriceRequests,
  linkHostLabel,
  neededByState,
  normalizePastedLink,
  priceRequestSummaryLine,
  quoteCellFor,
  requestedYmdOf,
  shapePriceRequest,
  validateOutsideRequest,
  vendorQuotePageUrl,
  type PriceRequestQuote,
  type PriceRequestRow,
} from './bidPriceRequests'

const isoToYmd = (iso: string) => iso.slice(0, 10)
const TODAY = '2026-09-08'

function row(id: string, extra: Partial<PriceRequestRow> = {}): PriceRequestRow {
  return {
    id,
    sent_via: 'app',
    supply_house_id: 'ferguson',
    sent_to: 'Ferguson',
    sent_email: 'rep@ferguson.com',
    status: 'sent',
    token: `tok-${id}`,
    created_at: '2026-09-02T15:00:00Z',
    created_by: 'u-wendi',
    viewed_at: null,
    needed_by: null,
    requested_on: null,
    request_url: null,
    quote_url: null,
    ...extra,
  }
}

const HOUSES = [
  { id: 'ferguson', name: 'Ferguson' },
  { id: 'moore', name: 'Moore Supply' },
]

describe('vendorQuotePageUrl / requestedYmdOf', () => {
  it('builds the vendor page from the token and skips blank tokens', () => {
    expect(vendorQuotePageUrl('abc')).toBe('https://clicktooling.com/q/abc')
    expect(vendorQuotePageUrl('  ')).toBeNull()
    expect(vendorQuotePageUrl(null)).toBeNull()
  })
  it('reads requested_on for outside rows and the created day otherwise', () => {
    expect(requestedYmdOf(row('a', { sent_via: 'outside', requested_on: '2026-09-03' }), isoToYmd)).toBe('2026-09-03')
    expect(requestedYmdOf(row('b', { sent_via: 'outside', requested_on: null }), isoToYmd)).toBe('2026-09-02')
    expect(requestedYmdOf(row('c', { requested_on: '2026-01-01' }), isoToYmd)).toBe('2026-09-02')
  })
})

describe('neededByState', () => {
  it('is none without a date, met once a quote is in, late past today, waiting otherwise', () => {
    expect(neededByState(row('a'), false, TODAY)).toEqual({ kind: 'none' })
    expect(neededByState(row('a', { needed_by: '2026-09-05' }), true, TODAY)).toEqual({ kind: 'met', ymd: '2026-09-05' })
    expect(neededByState(row('a', { needed_by: '2026-09-05' }), false, TODAY)).toEqual({ kind: 'late', ymd: '2026-09-05' })
    expect(neededByState(row('a', { needed_by: '2026-09-09' }), false, TODAY)).toEqual({ kind: 'waiting', ymd: '2026-09-09' })
    expect(neededByState(row('a', { needed_by: TODAY }), false, TODAY)).toEqual({ kind: 'waiting', ymd: TODAY })
  })
})

describe('quoteCellFor', () => {
  const quotes: PriceRequestQuote[] = [
    { id: 'q-old', rfq_id: 'a', supply_house_id: 'ferguson', received_at: '2026-09-03T10:00:00Z', valid_until: null, line_count: 12 },
    { id: 'q-new', rfq_id: 'a', supply_house_id: 'ferguson', received_at: '2026-09-04T10:00:00Z', valid_until: '2026-10-02', line_count: 41 },
  ]
  it('prefers the newest plugged-in quote, then a pasted link, then none', () => {
    expect(quoteCellFor(row('a', { quote_url: 'https://x' }), quotes)).toMatchObject({ kind: 'plugged', quoteId: 'q-new', lineCount: 41 })
    expect(quoteCellFor(row('b', { quote_url: 'https://drive.google.com/file/d/1' }), quotes)).toEqual({ kind: 'link', url: 'https://drive.google.com/file/d/1' })
    expect(quoteCellFor(row('c'), quotes)).toEqual({ kind: 'none' })
  })
})

describe('shapePriceRequest', () => {
  it('gives app rows a vendor page and no edit; outside rows the reverse', () => {
    const app = shapePriceRequest(row('a'), [], TODAY, isoToYmd)
    expect(app.vendorPageUrl).toBe('https://clicktooling.com/q/tok-a')
    expect(app.editable).toBe(false)
    const out = shapePriceRequest(row('o', { sent_via: 'outside', token: null, requested_on: '2026-09-03', request_url: 'https://drive.google.com/x' }), [], TODAY, isoToYmd)
    expect(out.vendorPageUrl).toBeNull()
    expect(out.editable).toBe(true)
    expect(out.requestedYmd).toBe('2026-09-03')
  })
})

describe('groupPriceRequests', () => {
  const rows = [
    row('f1', { created_at: '2026-09-02T15:00:00Z', needed_by: '2026-09-05' }),
    row('f2', { created_at: '2026-09-06T15:00:00Z', needed_by: '2026-09-09' }),
    row('m1', { sent_via: 'outside', token: null, supply_house_id: 'moore', sent_to: null, requested_on: '2026-09-03', request_url: 'https://drive.google.com/a', quote_url: 'https://drive.google.com/b', needed_by: '2026-09-05' }),
    row('draft', { status: 'draft', supply_house_id: 'moore' }),
    row('gone', { supply_house_id: null, sent_to: 'Winn Supply', token: 'tok-gone' }),
  ]
  const quotes: PriceRequestQuote[] = [{ id: 'q1', rfq_id: 'f1', supply_house_id: 'ferguson', received_at: '2026-09-04T10:00:00Z', valid_until: null, line_count: 41 }]

  it('groups by house alphabetically with newest requests first, skips drafts, keeps house-less rows by name', () => {
    const { groups, summary } = groupPriceRequests(rows, quotes, HOUSES, TODAY, isoToYmd)
    expect(groups.map((g) => g.houseName)).toEqual(['Ferguson', 'Moore Supply', 'Winn Supply'])
    expect(groups[0]!.requests.map((r) => r.row.id)).toEqual(['f2', 'f1'])
    expect(groups[1]!.requests.map((r) => r.row.id)).toEqual(['m1'])
    expect(groups[2]!.houseId).toBeNull()
    expect(summary).toEqual({ houses: 3, requests: 4, quotesIn: 2 })
  })

  it('marks needed-by from the quote state', () => {
    const { groups } = groupPriceRequests(rows, quotes, HOUSES, TODAY, isoToYmd)
    const [f2, f1] = groups[0]!.requests
    expect(f1!.neededBy).toEqual({ kind: 'met', ymd: '2026-09-05' })
    expect(f2!.neededBy).toEqual({ kind: 'waiting', ymd: '2026-09-09' })
    expect(groups[1]!.requests[0]!.neededBy).toEqual({ kind: 'met', ymd: '2026-09-05' })
  })
})

describe('priceRequestSummaryLine', () => {
  it('reads naturally at every count', () => {
    expect(priceRequestSummaryLine({ houses: 0, requests: 0, quotesIn: 0 })).toBe('no price requests yet')
    expect(priceRequestSummaryLine({ houses: 1, requests: 1, quotesIn: 0 })).toBe('1 house · 1 request · no quotes in')
    expect(priceRequestSummaryLine({ houses: 3, requests: 4, quotesIn: 2 })).toBe('3 houses · 4 requests · 2 quotes in')
  })
})

describe('linkHostLabel / normalizePastedLink', () => {
  it('names Google products and falls back to the host', () => {
    expect(linkHostLabel('https://drive.google.com/file/d/1')).toBe('Drive')
    expect(linkHostLabel('https://docs.google.com/spreadsheets/d/1')).toBe('Sheets')
    expect(linkHostLabel('https://docs.google.com/document/d/1')).toBe('Docs')
    expect(linkHostLabel('https://www.dropbox.com/s/x')).toBe('Dropbox')
    expect(linkHostLabel('https://ferguson.com/quote/9')).toBe('ferguson.com')
    expect(linkHostLabel('not a url')).toBe('link')
  })
  it('normalizes a pasted link and rejects non-web schemes', () => {
    expect(normalizePastedLink('  drive.google.com/file/d/1  ')).toEqual({ url: 'https://drive.google.com/file/d/1' })
    expect(normalizePastedLink('')).toEqual({ url: null })
    expect(normalizePastedLink('mailto:x@y.com').error).toBeTruthy()
    expect(normalizePastedLink('not a url at all').error).toBeTruthy()
  })
})

describe('validateOutsideRequest', () => {
  it('needs a house and a date; links are optional but must be links', () => {
    expect(validateOutsideRequest({ supplyHouseId: null, requestedOn: TODAY, requestUrl: '', quoteUrl: '' })).toEqual({ ok: false, error: 'Pick a supply house.' })
    expect(validateOutsideRequest({ supplyHouseId: 'moore', requestedOn: '', requestUrl: '', quoteUrl: '' })).toEqual({ ok: false, error: 'When was it requested?' })
    expect(validateOutsideRequest({ supplyHouseId: 'moore', requestedOn: TODAY, requestUrl: '', quoteUrl: '' })).toEqual({ ok: true, requestUrl: null, quoteUrl: null })
    expect(validateOutsideRequest({ supplyHouseId: 'moore', requestedOn: TODAY, requestUrl: 'drive.google.com/a', quoteUrl: 'mailto:x' })).toMatchObject({ ok: false })
    expect(validateOutsideRequest({ supplyHouseId: 'moore', requestedOn: TODAY, requestUrl: 'drive.google.com/a', quoteUrl: '' })).toEqual({ ok: true, requestUrl: 'https://drive.google.com/a', quoteUrl: null })
  })
})
