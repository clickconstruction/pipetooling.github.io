import { describe, expect, it } from 'vitest'
import { makeFakeRowCapSupabase } from '../../test/fakeRowCapSupabase'
import { documentsBidCountLinesByBid, loadDocumentsBidCountRows } from './documentsBidCountLines'

// 200 bids x 12 count rows = 2,400 rows. One 150-bid chunk alone is 1,800, past the 1,000-row cap.
const bidIds = Array.from({ length: 200 }, (_, i) => `bid-${String(i).padStart(3, '0')}`)
const countRows = bidIds.flatMap((bid_id, b) =>
  Array.from({ length: 12 }, (_, j) => ({ id: `row-${b}-${j}`, bid_id, bid_version_id: null, fixture: `Fixture ${j}`, count: j + 1 })),
)
const versions = bidIds.map((bid_id, b) => ({ id: `ver-${b}`, bid_id, sort_order: 0 }))

describe('loadDocumentsBidCountRows', () => {
  it('pages past the 1,000-row cap, so the last bid on the list keeps its rows', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ bids_count_rows: countRows, bid_versions: versions })
    const read = await loadDocumentsBidCountRows(client, bidIds)
    expect(read.countRows).toHaveLength(2400)
    expect(read.versions).toHaveLength(200)
    expect(read.countRows.filter((r) => r.bid_id === 'bid-199')).toHaveLength(12)
    // The old read was one un-ranged request, which answers with the first 1,000 rows and no error.
    expect(calls.every((c) => c.range != null)).toBe(true)
    expect(calls.every((c) => c.in?.[0] === 'bid_id' && c.in[1].length <= 150)).toBe(true)
  })

  it('orders each read so its pages cannot shuffle: the last key is id', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ bids_count_rows: countRows, bid_versions: versions })
    await loadDocumentsBidCountRows(client, bidIds)
    for (const c of calls.filter((x) => x.table === 'bids_count_rows')) expect(c.order).toEqual(['sequence_order', 'id'])
    for (const c of calls.filter((x) => x.table === 'bid_versions')) expect(c.order).toEqual(['sort_order', 'id'])
  })

  it('reads nothing for no bids', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ bids_count_rows: countRows, bid_versions: versions })
    expect(await loadDocumentsBidCountRows(client, [])).toEqual({ countRows: [], versions: [] })
    expect(calls).toHaveLength(0)
  })

  it('throws when a page fails, so a failure never reads as no count rows', async () => {
    const { client } = makeFakeRowCapSupabase({ bids_count_rows: countRows, bid_versions: versions }, { failOnCall: 3 })
    await expect(loadDocumentsBidCountRows(client, bidIds)).rejects.toThrow()
  })
})

describe('documentsBidCountLinesByBid', () => {
  const row = (bid_id: string, bid_version_id: string | null, fixture: string | null, count: number | string | null) => ({ bid_id, bid_version_id, fixture, count })

  it('shows the saved version when a bid has one', () => {
    const lines = documentsBidCountLinesByBid(
      [{ id: 'a', selected_bid_version_id: 'v2' }],
      [{ id: 'v1', bid_id: 'a' }, { id: 'v2', bid_id: 'a' }],
      [row('a', 'v1', 'Sink', 1), row('a', 'v2', 'Sink', 4), row('a', 'v2', 'Toilet', 2), row('a', null, 'Tub', 9)],
    )
    expect(lines.get('a')).toEqual([{ fixture: 'Sink', count: 4 }, { fixture: 'Toilet', count: 2 }])
  })

  it('falls back to the first version, then to the rows with no version', () => {
    const lines = documentsBidCountLinesByBid(
      [{ id: 'a', selected_bid_version_id: null }, { id: 'b', selected_bid_version_id: null }],
      [{ id: 'v1', bid_id: 'a' }, { id: 'v2', bid_id: 'a' }],
      [row('a', 'v2', 'Sink', 4), row('a', 'v1', 'Sink', 1), row('a', null, 'Tub', 9), row('b', null, 'Tub', 3), row('b', 'vX', 'Sink', 7)],
    )
    expect(lines.get('a')).toEqual([{ fixture: 'Sink', count: 1 }])
    expect(lines.get('b')).toEqual([{ fixture: 'Tub', count: 3 }])
  })

  it('keeps the rows in the order they were read, reads a count as a number and a missing fixture as blank', () => {
    const lines = documentsBidCountLinesByBid(
      [{ id: 'a', selected_bid_version_id: null }],
      [],
      [row('a', null, 'Second', '2'), row('a', null, null, 5), row('a', null, 'First', 1)],
    )
    expect(lines.get('a')).toEqual([{ fixture: 'Second', count: 2 }, { fixture: '', count: 5 }, { fixture: 'First', count: 1 }])
  })

  it('leaves a bid with no row of its version off the map, and a row of a bid not listed too', () => {
    const lines = documentsBidCountLinesByBid([{ id: 'a', selected_bid_version_id: 'v1' }], [{ id: 'v1', bid_id: 'a' }], [row('a', null, 'Tub', 1), row('zz', 'v9', 'Sink', 1)])
    expect(lines.has('a')).toBe(false)
    expect(lines.has('zz')).toBe(false)
  })
})
