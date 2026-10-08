import { describe, expect, it } from 'vitest'
import {
  BID_HISTORY_DEFAULT_BID_COLUMNS,
  BID_HISTORY_PAGE,
  bidHistoryAuthors,
  bidHistoryByDay,
  bidHistoryCaption,
  bidHistoryColumnName,
  bidHistoryDayLabel,
  bidHistoryLines,
  bidHistoryRowFromRpc,
  bidHistoryTabOf,
  bidHistoryValueWords,
  bidHistoryWho,
  bidHistoryWholeActions,
  filterBidHistory,
  groupBidHistory,
  type BidHistoryRow,
} from './bidHistory'

// Made-up people and bids, never real ones.
let n = 0
function row(over: Partial<BidHistoryRow>): BidHistoryRow {
  n += 1
  return {
    source: 'ledger',
    id: n,
    archiveId: null,
    bidId: 'bid-1',
    bidNumber: 'B494',
    table: 'bids_count_rows',
    recordId: `r-${n}`,
    countRowId: null,
    op: 'insert',
    changed: ['fixture', 'count'],
    oldValues: null,
    newValues: { fixture: 'Lav-1', count: 4 },
    label: 'Lav-1',
    changedBy: 'u-ann',
    changedByName: 'Ann',
    changedAt: '2026-10-08T15:00:00.000Z',
    action: null,
    byApp: null,
    ...over,
  }
}
const at = (s: number) => new Date(Date.parse('2026-10-08T15:00:00.000Z') + s * 1000).toISOString()

describe('bidHistoryRowFromRpc', () => {
  it('camel-cases the RPC row and reads the archive and the ledger alike', () => {
    expect(
      bidHistoryRowFromRpc({
        source: 'archive', id: null, archive_id: 'a1', bid_id: 'b', bid_number: null, table_name: 'bids_count_rows', record_id: 'r',
        count_row_id: 'r', op: 'delete', changed: ['fixture'], old_values: { fixture: 'SUMP' }, new_values: null, label: 'SUMP',
        changed_by: null, changed_by_name: null, changed_at: '2026-10-01T00:00:00Z', action: null, by_app: null,
      }),
    ).toMatchObject({ source: 'archive', archiveId: 'a1', op: 'delete', oldValues: { fixture: 'SUMP' }, newValues: null, label: 'SUMP' })
  })
})

describe('where a change belongs and what it is called', () => {
  it('puts each table under its tab, and a bids row under its first column’s', () => {
    expect(bidHistoryTabOf({ table: 'bids_count_rows', changed: [] })).toBe('counts')
    expect(bidHistoryTabOf({ table: 'bid_takeoff_stage_splits', changed: [] })).toBe('takeoffs')
    expect(bidHistoryTabOf({ table: 'bid_count_row_custom_prices', changed: [] })).toBe('pricing')
    expect(bidHistoryTabOf({ table: 'cost_estimate_labor_rows_unmatched', changed: [] })).toBe('labor')
    expect(bidHistoryTabOf({ table: 'cost_estimate_permit_rows', changed: [] })).toBe('labor')
    expect(bidHistoryTabOf({ table: 'bid_sov_lines', changed: [] })).toBe('cover-letter')
    expect(bidHistoryTabOf({ table: 'bid_versions', changed: [] })).toBe('versions')
    expect(bidHistoryTabOf({ table: 'bids', changed: ['cover_letter_terms'] })).toBe('cover-letter')
    expect(bidHistoryTabOf({ table: 'bids', changed: ['selected_price_book_version_id'] })).toBe('pricing')
    expect(bidHistoryTabOf({ table: 'bids', changed: ['bid_value'] })).toBe('edit-bid')
  })

  it('names columns in words', () => {
    expect(bidHistoryColumnName('unit_price')).toBe('price')
    expect(bidHistoryColumnName('customer_id')).toBe('GC')
    expect(bidHistoryColumnName('some_new_field_id')).toBe('some new field')
  })

  it('words values by what they are', () => {
    expect(bidHistoryValueWords('unit_price', 9800)).toBe('$9,800')
    expect(bidHistoryValueWords('unit_price', '10300.5')).toBe('$10,300.50')
    expect(bidHistoryValueWords('unit_materials_cents', 370000)).toBe('$3,700')
    expect(bidHistoryValueWords('rough_in_hrs_per_unit', 1.5)).toBe('1.5 h')
    expect(bidHistoryValueWords('bid_due_date', '2026-10-03')).toBe('Oct 3')
    expect(bidHistoryValueWords('estimator_id', 'u-1')).toBe('a pick')
    expect(bidHistoryValueWords('count', 4)).toBe('4')
    expect(bidHistoryValueWords('notes', 'Call the GC')).toBe('“Call the GC”')
    expect(bidHistoryValueWords('notes', null)).toBe('—')
    expect(bidHistoryValueWords('include_payment_schedule', true)).toBe('yes')
  })

  it('keeps Edit Bid to the default columns and counts the rest', () => {
    expect(BID_HISTORY_DEFAULT_BID_COLUMNS).toContain('bid_value')
    expect(BID_HISTORY_DEFAULT_BID_COLUMNS).not.toContain('selected_bid_version_id')
    const lines = bidHistoryLines(row({
      table: 'bids', op: 'update', label: null, changed: ['bid_value', 'selected_bid_version_id', 'sov_shape'],
      oldValues: { bid_value: 0 }, newValues: { bid_value: 2146000 },
    }))
    expect(lines.map((l) => `${l.subject} · ${l.detail}`)).toEqual(['Bid · value · $0 → $2,146,000', 'Bid · 2 other fields'])
  })
})

describe('bidHistoryLines', () => {
  it('a price changed', () => {
    const [l] = bidHistoryLines(row({ table: 'bid_count_row_custom_prices', op: 'update', changed: ['unit_price'], oldValues: { unit_price: 9800 }, newValues: { unit_price: 10300 } }))
    expect(`${l!.subject} · ${l!.detail}`).toBe('Lav-1 · price · $9,800 → $10,300')
    expect(l!.column).toBe('unit_price')
  })
  it('a row added or removed, with its lead value', () => {
    expect(bidHistoryLines(row({}))[0]!.detail).toBe('added · count 4')
    expect(bidHistoryLines(row({ op: 'delete', oldValues: { fixture: 'SUMP', count: 2 }, newValues: null, label: 'SUMP' }))[0]!.detail).toBe('removed · count 2')
  })
  it('a row from the archive says how long it is kept', () => {
    const [l] = bidHistoryLines(row({ source: 'archive', id: null, archiveId: 'a1', op: 'delete', oldValues: { fixture: 'SUMP', count: 2 }, newValues: null, label: 'SUMP' }))
    expect(l!.detail).toBe('removed · kept 90 days · count 2')
    expect(l!.fromArchive).toBe(true)
  })
})

describe('groupBidHistory — actions, not rows', () => {
  it('one person’s burst is one action; a pause over five seconds starts another', () => {
    const rows = [row({ changedAt: at(0) }), row({ changedAt: at(2) }), row({ changedAt: at(6) }), row({ changedAt: at(20) })]
    const actions = groupBidHistory(rows)
    expect(actions.map((a) => a.rows.length)).toEqual([1, 3])
    expect(actions[0]!.startedAt).toBe(at(20))
  })

  it('another person, another tag, another bid or the archive each start their own action', () => {
    const rows = [
      row({ changedAt: at(0) }),
      row({ changedAt: at(1), changedBy: 'u-ben', changedByName: 'Ben' }),
      row({ changedAt: at(2), changedBy: 'u-ben', changedByName: 'Ben', action: 'counts-import' }),
      row({ changedAt: at(3), changedBy: 'u-ben', changedByName: 'Ben', action: 'counts-import', bidId: 'bid-2', bidNumber: 'B377' }),
      row({ changedAt: at(4), changedBy: 'u-ben', changedByName: 'Ben', action: 'counts-import', bidId: 'bid-2', bidNumber: 'B377', source: 'archive', id: null, archiveId: 'a9' }),
    ]
    expect(groupBidHistory(rows)).toHaveLength(5)
  })

  it('an import of 23 rows reads as one action, with the adopted bid’s number', () => {
    const rows = Array.from({ length: 23 }, (_, i) => row({ changedAt: at(i * 0.3), action: 'counts-import', byApp: false, bidId: 'bid-2', bidNumber: 'B377' }))
    const [a] = groupBidHistory(rows)
    expect(a!.caption).toBe('Imported 23 rows from CountTooling')
    expect(a!.bidNumber).toBe('B377')
    expect(a!.who).toBe('Ann')
  })
})

describe('bidHistoryWholeActions — the action at a page’s edge', () => {
  // ZZ Test's case: a removal of 8 count rows and the 72 rows that hung on them, then 979 single
  // changes, one a minute. Newest first, as the read returns them: the first page holds the 979 and
  // the removal's newest 21 rows; the older page holds its other 59.
  const removal = Array.from({ length: 80 }, (_, i) =>
    row({
      source: 'archive', id: null, archiveId: `a-${i}`, op: 'delete', changedAt: at(i * 0.01),
      ...(i % 10 === 0 ? { label: `Fixture ${i / 10 + 1}` } : { table: 'bids_takeoff_rough_part_lines', label: 'P-trap' }),
    }))
  const singles = Array.from({ length: 979 }, (_, k) =>
    row({ op: 'update', changed: ['count'], oldValues: { count: 1 }, newValues: { count: 2 }, changedAt: at(60 * (k + 1)), changedBy: 'u-ben', changedByName: 'Ben' }))
  const read = [...removal, ...singles].sort((a, b) => b.changedAt.localeCompare(a.changedAt))
  const firstPage = read.slice(0, BID_HISTORY_PAGE)
  const olderPage = read.slice(BID_HISTORY_PAGE)

  it('a full page holds back its oldest action: it may go on past the edge, so it is not captioned as whole', () => {
    const cut = groupBidHistory(firstPage)
    expect(cut[cut.length - 1]!.rows).toHaveLength(21)
    const drawn = bidHistoryWholeActions(cut, true)
    expect(drawn).toHaveLength(979)
    expect(drawn.some((a) => a.fromArchive || a.caption.startsWith('Removed'))).toBe(false)
  })

  it('the older page makes it whole, captioned from all its rows', () => {
    const whole = bidHistoryWholeActions(groupBidHistory([...firstPage, ...olderPage]), false)
    expect(whole).toHaveLength(980)
    expect(whole[979]!.rows).toHaveLength(80)
    expect(whole[979]!.caption).toBe('Removed 8 count rows and what hung on them')
    expect(whole.some((a) => a.continues)).toBe(false)
  })

  it('a full page that is one action is drawn, marked as going on', () => {
    const big = Array.from({ length: BID_HISTORY_PAGE }, (_, i) => row({ action: 'counts-import', byApp: false, changedAt: at(-i * 0.001) }))
    const drawn = bidHistoryWholeActions(groupBidHistory(big), true)
    expect(drawn).toHaveLength(1)
    expect(drawn[0]!.continues).toBe(true)
  })

  it('a last page holds nothing back', () => {
    const actions = groupBidHistory([row({ changedAt: at(0) }), row({ changedAt: at(60) })])
    expect(bidHistoryWholeActions(actions, false)).toEqual(actions)
  })
})

describe('an action across tabs', () => {
  it('is a Counts action when a count row is in it, else the tab most rows are on', () => {
    const removed = groupBidHistory([
      row({ op: 'delete', label: 'SUMP', changedAt: at(0) }),
      row({ op: 'delete', table: 'bids_takeoff_rough_part_lines', label: 'P-trap', changedAt: at(0) }),
      row({ op: 'delete', table: 'bids_takeoff_rough_part_lines', label: 'Carrier', changedAt: at(0) }),
    ])
    expect(removed[0]!.tab).toBe('counts')
    const mixed = groupBidHistory([
      row({ table: 'bid_count_row_custom_prices', op: 'update', changed: ['unit_price'], changedAt: at(0) }),
      row({ table: 'bid_count_row_custom_prices', op: 'update', changed: ['unit_price'], changedAt: at(1) }),
      row({ table: 'cost_estimate_labor_rows', op: 'update', changed: ['rough_in_hrs_per_unit'], changedAt: at(2) }),
    ])
    expect(mixed[0]!.tab).toBe('pricing')
  })
})

describe('bidHistoryCaption', () => {
  it('a count row removed with what hung on it', () => {
    expect(bidHistoryCaption([
      row({ op: 'delete', label: 'SUMP' }),
      row({ op: 'delete', table: 'bid_count_row_custom_prices', label: 'SUMP' }),
      row({ op: 'delete', table: 'cost_estimate_labor_rows', label: 'SUMP' }),
    ])).toBe('Removed SUMP and what hung on it')
    expect(bidHistoryCaption([row({ op: 'delete', label: 'SUMP' })])).toBe('Removed SUMP')
  })
  it('prices changed', () => {
    const p = (v: number) => row({ table: 'bid_count_row_custom_prices', op: 'update', changed: ['unit_price'], oldValues: { unit_price: 1 }, newValues: { unit_price: v } })
    expect(bidHistoryCaption([p(2), p(3), p(4)])).toBe('Changed 3 prices')
    expect(bidHistoryCaption([p(2)])).toBe('Changed Lav-1 price')
  })
  it('an Edit Bid save names the default columns it touched', () => {
    expect(bidHistoryCaption([row({ table: 'bids', op: 'update', label: null, changed: ['bid_due_date', 'bid_value'] })])).toBe('Edit Bid · due and value')
    expect(bidHistoryCaption([row({ table: 'bids', op: 'update', label: null, changed: ['selected_bid_version_id'] })])).toBe('Edit Bid · active version')
    expect(bidHistoryCaption([row({ table: 'bids', op: 'update', label: null, changed: ['sov_shape'] })])).toBe('Edit Bid · sov shape')
  })
  it('the app’s own labor work, by its tag', () => {
    expect(bidHistoryCaption([row({ table: 'cost_estimate_labor_rows', op: 'delete', action: 'labor-park', byApp: true }), row({ table: 'cost_estimate_labor_rows_unmatched', op: 'insert', action: 'labor-park', byApp: true })])).toBe('Set aside 1 labor row no fixture claims')
    expect(bidHistoryCaption([row({ table: 'cost_estimate_labor_rows', op: 'insert', action: 'labor-take-back', byApp: true })])).toBe('Took back 1 labor row set aside before')
    expect(bidHistoryCaption([row({ action: 'labor-sync', byApp: true })])).toBe('Labor matched to the counts')
    expect(bidHistoryCaption([row({ op: 'delete', action: 'counts-clear-all' }), row({ op: 'delete', action: 'counts-clear-all' })])).toBe('Cleared all counts (2 count rows)')
  })
  it('a put back names the value, by its tag', () => {
    const p = () => row({ table: 'bid_count_row_custom_prices', op: 'update', changed: ['unit_price'], action: 'put-back', byApp: false })
    expect(bidHistoryCaption([p()])).toBe('Put back Lav-1 price')
    expect(bidHistoryCaption([row({ table: 'bids', op: 'update', label: null, changed: ['bid_value'], action: 'put-back', byApp: false })])).toBe('Put back Bid value')
    expect(bidHistoryCaption([p(), p()])).toBe('Put back 2 values')
  })
  it('rows added on one table', () => {
    expect(bidHistoryCaption([row({}), row({})])).toBe('Added 2 count rows')
    expect(bidHistoryCaption([row({ table: 'bid_sov_lines', label: 'Underground' })])).toBe('Added Underground')
  })
})

describe('who', () => {
  it('names the person, the app, the robot, or someone', () => {
    expect(bidHistoryWho({ changedBy: 'u', changedByName: 'Ann', byApp: false, action: null })).toBe('Ann')
    expect(bidHistoryWho({ changedBy: 'u', changedByName: 'Ann', byApp: true, action: 'labor-sync' })).toBe('the app')
    expect(bidHistoryWho({ changedBy: null, changedByName: null, byApp: false, action: 'robot-paste' })).toBe('the robot')
    expect(bidHistoryWho({ changedBy: 'u', changedByName: null, byApp: null, action: null })).toBe('someone')
    expect(bidHistoryWho({ changedBy: null, changedByName: null, byApp: null, action: null })).toBe('the app')
  })
})

describe('filters, search and days', () => {
  const actions = groupBidHistory([
    row({ changedAt: at(0) }),
    row({ changedAt: at(30), table: 'bid_count_row_custom_prices', op: 'update', changed: ['unit_price'], oldValues: { unit_price: 9800 }, newValues: { unit_price: 10300 }, changedBy: 'u-ben', changedByName: 'Ben' }),
    row({ changedAt: at(60), table: 'cost_estimate_labor_rows', action: 'labor-sync', byApp: true, label: 'WC' }),
  ])

  it('by tab, by person, by the app', () => {
    expect(filterBidHistory(actions, { tab: 'pricing', whoId: null, search: '' }).map((a) => a.who)).toEqual(['Ben'])
    expect(filterBidHistory(actions, { tab: null, whoId: 'u-ann', search: '' }).map((a) => a.tab)).toEqual(['counts'])
    expect(filterBidHistory(actions, { tab: null, whoId: 'app', search: '' }).map((a) => a.caption)).toEqual(['Labor matched to the counts'])
  })

  it('searches names and values', () => {
    expect(filterBidHistory(actions, { tab: null, whoId: null, search: '10,300' }).map((a) => a.who)).toEqual(['Ben'])
    expect(filterBidHistory(actions, { tab: null, whoId: null, search: 'lav-1' })).toHaveLength(2)
  })

  it('lists who wrote, most first, the app apart', () => {
    expect(bidHistoryAuthors(actions).map((x) => x.who)).toEqual(['Ann', 'Ben', 'the app and robots'])
  })

  it('heads each day in words, in the company’s time', () => {
    const now = new Date('2026-10-08T20:00:00Z')
    expect(bidHistoryDayLabel('2026-10-08T15:00:00Z', now)).toBe('Today')
    expect(bidHistoryDayLabel('2026-10-07T15:00:00Z', now)).toBe('Yesterday')
    expect(bidHistoryDayLabel('2026-10-05T15:00:00Z', now)).toBe('Monday')
    expect(bidHistoryDayLabel('2026-09-29T15:00:00Z', now)).toBe('Tue, Sep 29')
    // 03:00 UTC on Oct 8 is still Oct 7 in Texas.
    expect(bidHistoryDayLabel('2026-10-08T03:00:00Z', now)).toBe('Yesterday')
    expect(bidHistoryByDay(actions, now).map((d) => [d.day, d.actions.length])).toEqual([['Today', 3]])
  })
})
