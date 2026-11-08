import { describe, expect, it } from 'vitest'
import { containerLines, countDiffs, type Container, type Movement } from './onSite'
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

/** The server's answer for these rows, as the SQL in 20261108221500 builds it. */
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
    const fromRows = jobMaterialsSummary(containers, rows, NOW)
    const fromServer = jobMaterialsSummaryFromServer(containers, server, NOW, priceOf)
    expect(fromServer).toEqual({ ...fromRows, missingMoneyWeek: 7.5 })
    expect(fromServer).toMatchObject({ containers: 3, onSiteLines: 2, missingLines: 2, credits: 1 })
    expect(fromServer.stale.map((c) => c.id)).toEqual(['b1'])
  })
})
