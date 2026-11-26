import { describe, expect, it } from 'vitest'
import { ADD_COUNT_NOTE, containerLines, countDiffs, lastCountedAt, type Container, type Movement } from './onSite'
import { jobMaterialsSummary } from './onSiteSummary'
import { jobMaterialsSummaryFromServer, serverCountDiffs, serverLastCountedAt, serverLines, type ServerSummary } from './onSiteServerSummary'

/**
 * The database's summary read into the kernel's shapes (punch list #209, v2.6743). The parity rule: the
 * server's answer for a ledger, built here as the SQL builds it, must sum to what the kernel sums from
 * the same rows — the same lines, the same differences, the same summary.
 */
function mv(over: Partial<Movement> & Pick<Movement, 'reason' | 'quantity' | 'at'>): Movement {
  return { id: over.id ?? `${over.at}-${over.reason}`, jobId: 'j1', partId: null, partName: '3/4" copper 90', manufacturer: 'Nibco', fromContainerId: null, toContainerId: null, note: '', byUserId: null, byName: 'Mateo', source: null, itemId: null, ...over }
}
const box = (id: string, kind = 'cage'): Container => ({ id, jobId: 'j1', label: id.toUpperCase(), kind: kind as Container['kind'], where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-01T00:00:00Z' })

const NOW = new Date('2026-11-08T18:00:00Z')
const rows: Movement[] = [
  mv({ id: 'r1', reason: 'delivered', quantity: 25, at: '2026-10-24T20:30:00Z', toContainerId: 'unsorted', byName: 'Carla' }),
  mv({ id: 'r2', reason: 'moved', quantity: 25, at: '2026-10-27T13:00:00Z', fromContainerId: 'unsorted', toContainerId: 'a2' }),
  mv({ id: 'r3', reason: 'used', quantity: 6, at: '2026-10-27T15:00:00Z', fromContainerId: 'a2' }),
  mv({ id: 'r4', reason: 'used', quantity: 5, at: '2026-10-28T14:00:00Z', fromContainerId: 'a2', byName: 'Jordan' }),
  mv({ id: 'r5', reason: 'counted', quantity: 12, at: '2026-11-06T18:48:00Z', fromContainerId: 'a2', byName: 'Jordan' }),
  mv({ id: 'r6', reason: 'cannot_find', quantity: 1, at: '2026-11-07T09:00:00Z', fromContainerId: 'a2' }),
  mv({ id: 'r7', reason: 'returned', quantity: 2, at: '2026-11-07T10:00:00Z', fromContainerId: 'a2' }),
  mv({ id: 'r8', reason: 'delivered', quantity: 4, at: '2026-11-01T10:00:00Z', toContainerId: 'b1', partId: 'p1', partName: 'Ball valve', manufacturer: null }),
]

/** The server's answer for these rows, as the SQL in 20261109010000 builds it. */
const server: ServerSummary = {
  rows: 8,
  lines: [
    { container_id: 'a2', part_key: 'text:3/4" copper 90', part_id: null, part_name: '3/4" copper 90', manufacturer: 'Nibco', on_hand: 9, cannot_find_since_count: 1, last_touched_at: '2026-11-07T10:00:00Z', last_touched_by: 'Mateo', last_count_at: '2026-11-06T18:48:00Z', last_count_by: 'Jordan', last_count_diff: -2 },
    { container_id: 'b1', part_key: 'id:p1', part_id: 'p1', part_name: 'Ball valve', manufacturer: null, on_hand: 4, cannot_find_since_count: 0, last_touched_at: '2026-11-01T10:00:00Z', last_touched_by: 'Mateo', last_count_at: null, last_count_by: null, last_count_diff: null },
    { container_id: 'unsorted', part_key: 'text:3/4" copper 90', part_id: null, part_name: '3/4" copper 90', manufacturer: 'Nibco', on_hand: 0, cannot_find_since_count: 0, last_touched_at: '2026-10-27T13:00:00Z', last_touched_by: 'Mateo', last_count_at: null, last_count_by: null, last_count_diff: null },
  ],
  last_counts: [{ container_id: 'a2', at: '2026-11-06T18:48:00Z', by_name: 'Jordan' }],
  diffs: [{ movement_id: 'r5', at: '2026-11-06T18:48:00Z', by_name: 'Jordan', container_id: 'a2', part_key: 'text:3/4" copper 90', part_id: null, part_name: '3/4" copper 90', manufacturer: 'Nibco', expected: 14, counted: 12 }],
  cannot_find: [{ movement_id: 'r6', at: '2026-11-07T09:00:00Z', by_name: 'Mateo', container_id: 'a2', part_key: 'text:3/4" copper 90', part_id: null, part_name: '3/4" copper 90', manufacturer: 'Nibco', quantity: 1 }],
  credits: 1,
}

describe('onSiteServerSummary · the database’s sums in the kernel’s shapes (punch list #209, v2.6743)', () => {
  it('the server’s lines are the kernel’s lines', () => {
    // Two lines share a part key (the same typed name in two boxes), so both sides are read in one order.
    const byLine = (a: { containerId: string; partKey: string }, b: { containerId: string; partKey: string }) => a.containerId.localeCompare(b.containerId) || a.partKey.localeCompare(b.partKey)
    expect([...serverLines(server)].sort(byLine)).toEqual([...containerLines(rows)].sort(byLine))
  })

  it('the server’s counts are the kernel’s differences', () => {
    expect(serverCountDiffs(server)).toEqual(countDiffs(rows))
  })

  it('the last count per container reads as lastCountedAt does', () => {
    expect(serverLastCountedAt(server, 'a2')).toEqual({ at: '2026-11-06T18:48:00Z', byName: 'Jordan' })
    expect(serverLastCountedAt(server, 'b1')).toBeNull()
  })

  it('the summary from the server is the summary from the rows: the week’s short line and Can’t find press with the money, the box due, the credit', () => {
    const containers = [box('a2'), box('b1'), box('unsorted', 'unsorted')]
    const priceOf = (key: string) => (key === 'text:3/4" copper 90' ? 2.5 : null)
    const fromRows = jobMaterialsSummary(containers, rows, NOW, priceOf)
    const fromServer = jobMaterialsSummaryFromServer(containers, server, NOW, priceOf)
    expect(fromServer).toEqual(fromRows)
    // The short count and the Can't find press are of one part, and it has a price: the money is whole, nothing is left out.
    expect(fromServer).toMatchObject({ containers: 3, onSiteLines: 2, missingLines: 2, missingUnpricedLines: 0, missingMoneyWeek: 7.5, credits: 1 })
    // With no price anywhere the money is nothing and every short line is said to have none, on both sides.
    const none = () => null
    expect(jobMaterialsSummaryFromServer(containers, server, NOW, none)).toMatchObject({ missingLines: 2, missingUnpricedLines: 2, missingMoneyWeek: 0 })
    expect(jobMaterialsSummary(containers, rows, NOW, none)).toMatchObject({ missingLines: 2, missingUnpricedLines: 2, missingMoneyWeek: 0 })
    expect(fromServer.stale.map((c) => c.id)).toEqual(['b1'])
  })

  it('an added part’s own count is left out of the box’s last count on both sides, and an empty box is due nowhere (punch list #398)', () => {
    // B1 takes an add today: the delivery and the line's count with its note (addPartRows). The SQL's last_counts leave
    // that count out, as lastCountedAt does; the line keeps it. C1 is a box that was counted long ago and is empty now.
    const added: Movement[] = [
      ...rows,
      mv({ id: 'r9', reason: 'delivered', quantity: 6, at: '2026-11-08T10:00:00.000Z', toContainerId: 'b1', partName: 'Hangers', manufacturer: null, note: 'added on site', byName: 'Dana' }),
      mv({ id: 'r10', reason: 'counted', quantity: 6, at: '2026-11-08T10:00:00.001Z', fromContainerId: 'b1', partName: 'Hangers', manufacturer: null, note: ADD_COUNT_NOTE, byName: 'Dana' }),
      mv({ id: 'r11', reason: 'delivered', quantity: 2, at: '2026-10-01T10:00:00Z', toContainerId: 'c1', partName: 'Wax ring', manufacturer: null }),
      mv({ id: 'r12', reason: 'counted', quantity: 2, at: '2026-10-02T10:00:00Z', fromContainerId: 'c1', partName: 'Wax ring', manufacturer: null }),
      mv({ id: 'r13', reason: 'used', quantity: 2, at: '2026-10-03T10:00:00Z', fromContainerId: 'c1', partName: 'Wax ring', manufacturer: null }),
    ]
    const addedServer: ServerSummary = {
      ...server,
      rows: 13,
      lines: [
        ...server.lines,
        { container_id: 'b1', part_key: 'text:hangers', part_id: null, part_name: 'Hangers', manufacturer: null, on_hand: 6, cannot_find_since_count: 0, last_touched_at: '2026-11-08T10:00:00.001Z', last_touched_by: 'Dana', last_count_at: '2026-11-08T10:00:00.001Z', last_count_by: 'Dana', last_count_diff: 0 },
        { container_id: 'c1', part_key: 'text:wax ring', part_id: null, part_name: 'Wax ring', manufacturer: null, on_hand: 0, cannot_find_since_count: 0, last_touched_at: '2026-10-03T10:00:00Z', last_touched_by: 'Mateo', last_count_at: '2026-10-02T10:00:00Z', last_count_by: 'Mateo', last_count_diff: 0 },
      ],
      // last_counts: B1's add is left out, so B1 has none; C1's old count stands.
      last_counts: [...server.last_counts, { container_id: 'c1', at: '2026-10-02T10:00:00Z', by_name: 'Mateo' }],
      diffs: [...server.diffs, { movement_id: 'r10', at: '2026-11-08T10:00:00.001Z', by_name: 'Dana', container_id: 'b1', part_key: 'text:hangers', part_id: null, part_name: 'Hangers', manufacturer: null, expected: 6, counted: 6 }],
    }
    expect(serverLastCountedAt(addedServer, 'b1')).toEqual(lastCountedAt(added, 'b1'))
    expect(serverLastCountedAt(addedServer, 'b1')).toBeNull()
    expect(serverLastCountedAt(addedServer, 'c1')).toEqual(lastCountedAt(added, 'c1'))
    const containers = [box('a2'), box('b1'), box('c1'), box('unsorted', 'unsorted')]
    const priceOf = () => null
    const fromRows = jobMaterialsSummary(containers, added, NOW, priceOf)
    const fromServer = jobMaterialsSummaryFromServer(containers, addedServer, NOW, priceOf)
    // B1 is still due: the add counted its line and not the box. C1 is empty, so it is due nowhere, old count or not.
    expect(fromRows.stale.map((c) => c.id)).toEqual(['b1'])
    expect(fromServer.stale.map((c) => c.id)).toEqual(['b1'])
  })
})
