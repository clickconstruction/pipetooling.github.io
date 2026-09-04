import { describe, expect, it } from 'vitest'
import type { TakeoffFixtureHistoryRow } from '../../types/database-functions'
import { buildCopyFromBidPreview, groupFixtureHistory, pickSameAsChips } from './takeoffFixtureHistory'

function row(p: Partial<TakeoffFixtureHistoryRow> & { key: string; bid_id: string }): TakeoffFixtureHistoryRow {
  return {
    bid_number: p.bid_id.replace('b', ''),
    project_name: null,
    sent_on: '2026-08-01',
    outcome: null,
    count_row_id: `${p.bid_id}-${p.key}`,
    fixture: p.key,
    line_count: 1,
    per_unit_cost: 10,
    lines: [],
    ...p,
  }
}

const rows: TakeoffFixtureHistoryRow[] = [
  row({ key: 's', bid_id: 'b383', sent_on: '2026-08-28', outcome: 'lost', line_count: 5 }),
  row({ key: 's', bid_id: 'b370', sent_on: '2026-08-14', outcome: 'won', line_count: 4 }),
  row({ key: 's', bid_id: 'b343', sent_on: '2026-07-30', outcome: 'won', line_count: 5 }),
  row({ key: 'wc', bid_id: 'b383', sent_on: '2026-08-28', outcome: 'lost', line_count: 2 }),
  row({ key: 'fd', bid_id: 'b370', sent_on: '2026-08-14', outcome: 'won', line_count: 1 }),
]

describe('groupFixtureHistory', () => {
  it('keeps the RPC order within each key', () => {
    const g = groupFixtureHistory(rows)
    expect([...g.keys()]).toEqual(['s', 'wc', 'fd'])
    expect(g.get('s')?.map((r) => r.bid_id)).toEqual(['b383', 'b370', 'b343'])
  })
})

describe('pickSameAsChips', () => {
  it('takes the most recent rows and promotes a won bid to the front', () => {
    const s = groupFixtureHistory(rows).get('s')!
    expect(pickSameAsChips(s).map((r) => r.bid_id)).toEqual(['b370', 'b383'])
    expect(pickSameAsChips(s, 3).map((r) => r.bid_id)).toEqual(['b370', 'b383', 'b343'])
  })

  it('leaves the order alone when the first is already won, and handles empties', () => {
    expect(pickSameAsChips([rows[1]!, rows[0]!]).map((r) => r.bid_id)).toEqual(['b370', 'b383'])
    expect(pickSameAsChips([])).toEqual([])
    expect(pickSameAsChips(rows, 0)).toEqual([])
  })
})

describe('buildCopyFromBidPreview', () => {
  const countRows = [
    { id: 'r-s1', fixture: 'S-1' },
    { id: 'r-s2', fixture: 'S-2' },
    { id: 'r-wc', fixture: 'WC-12' },
    { id: 'r-fd', fixture: 'fd-2' },
    { id: 'r-wb', fixture: 'WB-1' },
  ]

  it('ranks source bids by how many uncosted fixtures they can fill, then recency', () => {
    const c = buildCopyFromBidPreview(countRows, ['r-s1', 'r-s2', 'r-wc', 'r-fd', 'r-wb'], rows)
    expect(c.map((x) => [x.bidId, x.fills.length, x.lineCount])).toEqual([
      ['b383', 3, 12],
      ['b370', 3, 9],
      ['b343', 2, 10],
    ])
    expect(c[0]?.fills.map((f) => f.countRowId)).toEqual(['r-s1', 'r-s2', 'r-wc'])
  })

  it('only fills uncosted rows and ignores fixtures with no history', () => {
    const c = buildCopyFromBidPreview(countRows, ['r-wb', 'r-fd'], rows)
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ bidId: 'b370', fills: [{ countRowId: 'r-fd' }] })
    expect(buildCopyFromBidPreview(countRows, [], rows)).toEqual([])
  })
})
