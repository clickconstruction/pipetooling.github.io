import { describe, expect, it } from 'vitest'

import {
  askedHouseSummary,
  linkDisplayText,
  groupPriceRequests,
  linkHostLabel,
  neededByState,
  normalizePastedLink,
  planOutsideRequests,
  priceRequestSummaryLine,
  quoteCellFor,
  planAskHouses,
  defaultAskHow,
  askButtonLabel,
  requestedYmdOf,
  requestStatusFor,
  requestStatusLabel,
  nudgeStateFor,
  shapePriceRequest,
  showsNudge,
  validateOutsideRequest,
  vendorQuotePageUrl,
  type PriceRequestQuote,
  type PriceRequestRow, } from './bidPriceRequests'

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
    last_reminded_at: null,
    reminder_count: 0,
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
    expect(summary).toEqual({ houses: 3, requests: 4, quotesIn: 2, late: 0 })
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
    expect(priceRequestSummaryLine({ houses: 0, requests: 0, quotesIn: 0, late: 0 })).toBe('no price requests yet')
    expect(priceRequestSummaryLine({ houses: 1, requests: 1, quotesIn: 0, late: 0 })).toBe('1 house · 1 request · no quotes in')
    expect(priceRequestSummaryLine({ houses: 3, requests: 4, quotesIn: 2, late: 0 })).toBe('3 houses · 4 requests · 2 quotes in')
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

describe('linkDisplayText (v2.3195)', () => {
  it('shows the address without the scheme or www, cut with an ellipsis', () => {
    expect(linkDisplayText('https://www.drive.google.com/file/d/1EcQ/view')).toBe('drive.google.com/file/d/1EcQ/view')
    expect(linkDisplayText('http://reece.com/quotes/')).toBe('reece.com/quotes')
    expect(linkDisplayText('https://drive.google.com/file/d/1EcQabcdefghijklmnopqrstuvwxyz0123456789/view', 30)).toBe('drive.google.com/file/d/1EcQa…')
  })
})

describe('nudgeStateFor / showsNudge (v2.3245)', () => {
  const now = Date.parse('2026-09-08T12:00:00Z')
  it('follows the desk rule: app rows with an email, not quoted or closed, rested 24h', () => {
    expect(nudgeStateFor(row('a'), now).ok).toBe(true)
    expect(nudgeStateFor(row('a', { created_at: '2026-09-08T11:00:00Z' }), now).ok).toBe(false)
    expect(nudgeStateFor(row('a', { last_reminded_at: '2026-09-08T02:00:00Z' }), now).ok).toBe(false)
    expect(nudgeStateFor(row('a', { status: 'quoted' }), now)).toEqual({ ok: false, reason: 'already quoted' })
    expect(nudgeStateFor(row('a', { sent_via: 'outside', token: null }), now).ok).toBe(false)
    expect(nudgeStateFor(row('a', { sent_email: null }), now).ok).toBe(false)
  })
  it('only app rows with an email that are still open show the button', () => {
    expect(showsNudge(row('a'))).toBe(true)
    expect(showsNudge(row('a', { status: 'quoted' }))).toBe(false)
    expect(showsNudge(row('a', { status: 'closed' }))).toBe(false)
    expect(showsNudge(row('a', { sent_email: null }))).toBe(false)
    expect(showsNudge(row('a', { sent_via: 'outside' }))).toBe(false)
  })
})

describe('planOutsideRequests (v2.3495)', () => {
  const entry = (supplyHouseId: string, requestedOn = '2026-09-08', requestUrl = '') => ({ supplyHouseId, requestedOn, requestUrl })

  it('needs at least one house', () => {
    expect(planOutsideRequests({ entries: [] })).toEqual({ ok: false, error: 'Pick a supply house.' })
  })

  it('keeps every house, in order, with its own day and its own link', () => {
    const got = planOutsideRequests({
      entries: [
        entry('ferguson', '2026-09-08', 'drive.google.com/file/d/1EcQ'),
        entry('moore', '2026-09-04'),
        entry('winn', '2026-09-08', '  '),
      ],
    })
    expect(got).toEqual({
      ok: true,
      rows: [
        { supplyHouseId: 'ferguson', requestedOn: '2026-09-08', requestUrl: 'https://drive.google.com/file/d/1EcQ' },
        { supplyHouseId: 'moore', requestedOn: '2026-09-04', requestUrl: null },
        { supplyHouseId: 'winn', requestedOn: '2026-09-08', requestUrl: null },
      ],
    })
  })

  it('names the house whose day is missing', () => {
    expect(planOutsideRequests({ entries: [entry('ferguson'), entry('moore', '')] })).toEqual({
      ok: false,
      error: 'When was it requested?',
      atHouseId: 'moore',
    })
  })

  it('names the house whose link is not a link', () => {
    expect(planOutsideRequests({ entries: [entry('ferguson'), entry('moore', '2026-09-04', 'mailto:dan@ferguson.com')] })).toEqual({
      ok: false,
      error: 'Quote link: Paste a web link (https://…).',
      atHouseId: 'moore',
    })
  })

  it('refuses the same house twice in one batch', () => {
    expect(planOutsideRequests({ entries: [entry('ferguson'), entry('ferguson', '2026-09-04')] })).toEqual({
      ok: false,
      error: 'That house is already in this batch.',
      atHouseId: 'ferguson',
    })
  })
})

describe('askedHouseSummary (v2.3495)', () => {
  it('counts each house and keeps its newest day, skipping house-less rows', () => {
    const rows = [
      row('f1', { created_at: '2026-09-02T15:00:00Z' }),
      row('f2', { created_at: '2026-09-06T15:00:00Z' }),
      row('m1', { sent_via: 'outside', token: null, supply_house_id: 'moore', sent_to: null, requested_on: '2026-09-03' }),
      row('gone', { supply_house_id: null, sent_to: 'Winn Supply', token: 'tok-gone' }),
    ]
    const { groups } = groupPriceRequests(rows, [], HOUSES, TODAY, isoToYmd)
    const asked = askedHouseSummary(groups)
    expect(asked.get('ferguson')).toEqual({ count: 2, lastYmd: '2026-09-06' })
    expect(asked.get('moore')).toEqual({ count: 1, lastYmd: '2026-09-03' })
    expect(asked.size).toBe(2)
  })

  it('is empty on a bid that has asked nobody', () => {
    expect(askedHouseSummary([]).size).toBe(0)
  })
})


describe('PR 2 — the card\'s how (v2.3526)', () => {
  const app = (id: string, email = 'dan@ferguson.com') => ({ supplyHouseId: id, requestedOn: '2026-09-16', requestUrl: '', how: 'app' as const, email })
  const out = (id: string, url = '') => ({ supplyHouseId: id, requestedOn: '2026-09-16', requestUrl: url, how: 'outside' as const, email: '' })

  it('splits the block into app-sent and hand-sent, each side in order', () => {
    const p = planAskHouses([app('ferg'), out('nws', 'https://drive.google.com/x'), app('moore', 'rep@moore.com')])
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.app).toEqual([{ supplyHouseId: 'ferg', email: 'dan@ferguson.com' }, { supplyHouseId: 'moore', email: 'rep@moore.com' }])
    expect(p.outside).toEqual([{ supplyHouseId: 'nws', requestedOn: '2026-09-16', requestUrl: 'https://drive.google.com/x' }])
  })

  it('refuses an app-sent house with no usable address, and names it', () => {
    const p = planAskHouses([out('nws'), app('ferg', '')])
    expect(p.ok).toBe(false)
    if (p.ok) return
    expect(p.atHouseId).toBe('ferg')
    expect(p.error).toContain('I’ll send it')
  })

  it('keeps the hand-sent rules word for word (a bad link, a duplicate house)', () => {
    const bad = planAskHouses([app('ferg'), out('nws', 'not a link')])
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.atHouseId).toBe('nws')
    const dup = planAskHouses([app('ferg'), out('ferg')])
    expect(dup.ok).toBe(false)
    if (!dup.ok) expect(dup.error).toContain('already in this batch')
    expect(planAskHouses([]).ok).toBe(false)
  })

  it('defaults to the app when the rep has an address, else to I’ll send it', () => {
    expect(defaultAskHow('dan@ferguson.com')).toBe('app')
    expect(defaultAskHow('')).toBe('outside')
    expect(defaultAskHow(null)).toBe('outside')
    expect(defaultAskHow('not-an-email')).toBe('outside')
  })

  it('labels the button by what the press will do', () => {
    expect(askButtonLabel([])).toBe('Add request')
    expect(askButtonLabel([out('a')])).toBe('Add request')
    expect(askButtonLabel([out('a'), out('b')])).toBe('Add 2 requests')
    expect(askButtonLabel([app('a')])).toBe('Ask by email')
    expect(askButtonLabel([app('a'), app('b'), app('c')])).toBe('Ask 3 houses')
    expect(askButtonLabel([app('a'), out('b')])).toBe('Ask 2 houses · 1 by email')
  })
})

describe('requestStatusFor / requestStatusLabel (PR 3, v2.3572)', () => {
  it('quote in beats everything; late counts the days past needed-by; no needed-by reads waiting, never blank', () => {
    const quoted = shapePriceRequest(row('q', { needed_by: '2026-09-01', quote_url: 'https://drive.google.com/x' }), [], TODAY, isoToYmd)
    expect(requestStatusFor(quoted, TODAY)).toEqual({ kind: 'quoted' })
    const late = shapePriceRequest(row('l', { needed_by: '2026-09-01' }), [], TODAY, isoToYmd)
    expect(requestStatusFor(late, TODAY)).toEqual({ kind: 'late', days: 7 })
    expect(requestStatusLabel(requestStatusFor(late, TODAY))).toBe('late 7d')
    const waiting = shapePriceRequest(row('w', { needed_by: '2026-09-20' }), [], TODAY, isoToYmd)
    expect(requestStatusFor(waiting, TODAY)).toEqual({ kind: 'waiting' })
    const none = shapePriceRequest(row('n', { sent_via: 'outside', requested_on: '2026-09-05' }), [], TODAY, isoToYmd)
    expect(requestStatusLabel(requestStatusFor(none, TODAY))).toBe('waiting')
  })

  it('the summary counts late rows and the line says so', () => {
    const { summary } = groupPriceRequests(
      [row('a', { needed_by: '2026-09-01' }), row('b', { needed_by: '2026-09-01', quote_url: 'https://x.test/q' }), row('c', { supply_house_id: 'moore' })],
      [],
      HOUSES,
      TODAY,
      isoToYmd,
    )
    expect(summary).toEqual({ houses: 2, requests: 3, quotesIn: 1, late: 1 })
    expect(priceRequestSummaryLine(summary)).toBe('2 houses · 3 requests · 1 quote in · 1 late')
  })
})
