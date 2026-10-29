import { describe, expect, it } from 'vitest'
import { containerLines, countDiffs, countIsDue, groupByPlace, lastCountWords, lastCountedAt, leftWords, linesOf, missingMoney, nextLabel, partKey, placeName, pressLabel, searchContainers, searchLines, type Movement } from './onSite'

function mv(over: Partial<Movement> & Pick<Movement, 'reason' | 'quantity' | 'at'>): Movement {
  return { id: over.id ?? `${over.at}-${over.reason}`, jobId: 'j1', partId: null, partName: '3/4" copper 90', manufacturer: 'Nibco', fromContainerId: null, toContainerId: null, note: '', byUserId: null, byName: 'Mateo', source: null, itemId: null, ...over }
}

describe('containerLines', () => {
  it('sums a delivery, a move and two uses, then a count resets the line and keeps the difference', () => {
    const rows = [
      mv({ reason: 'delivered', quantity: 25, at: '2026-10-24T20:30:00Z', toContainerId: 'unsorted', byName: 'Carla', source: 'PO-2211' }),
      mv({ reason: 'moved', quantity: 25, at: '2026-10-27T13:00:00Z', fromContainerId: 'unsorted', toContainerId: 'a2' }),
      mv({ reason: 'used', quantity: 6, at: '2026-10-27T15:00:00Z', fromContainerId: 'a2' }),
      mv({ reason: 'used', quantity: 5, at: '2026-10-28T14:00:00Z', fromContainerId: 'a2', byName: 'Jordan' }),
      mv({ reason: 'counted', quantity: 12, at: '2026-10-28T18:48:00Z', fromContainerId: 'a2', byName: 'Jordan' }),
    ]
    const lines = containerLines(rows)
    const a2 = linesOf(lines, 'a2')
    expect(a2).toHaveLength(1)
    expect(a2[0]).toMatchObject({ onHand: 12, lastCountDiff: -2, lastCountBy: 'Jordan', lastTouchedBy: 'Jordan' })
    // Unsorted went to zero and was never counted, so it no longer lists the line
    expect(linesOf(lines, 'unsorted')).toHaveLength(0)
  })

  it('reads a count above the ledger as found, and a later use applies to the counted number', () => {
    const rows = [
      mv({ reason: 'counted', quantity: 14, at: '2026-10-20T10:00:00Z', fromContainerId: 'b1' }),
      mv({ reason: 'used', quantity: 4, at: '2026-10-21T10:00:00Z', fromContainerId: 'b1' }),
    ]
    const [line] = linesOf(containerLines(rows), 'b1')
    expect(line).toMatchObject({ onHand: 10, lastCountDiff: 14 })
  })

  it('keeps free-text lines apart from book lines and folds a typed name', () => {
    const rows = [
      mv({ reason: 'delivered', quantity: 2, at: '2026-10-20T10:00:00Z', toContainerId: 'a1', partName: 'Flex connector, odd one' }),
      mv({ reason: 'used', quantity: 1, at: '2026-10-21T10:00:00Z', fromContainerId: 'a1', partName: 'flex connector, odd one' }),
      mv({ reason: 'delivered', quantity: 9, at: '2026-10-20T10:00:00Z', toContainerId: 'a1', partId: 'p9', partName: 'Flex connector, odd one' }),
    ]
    const a1 = linesOf(containerLines(rows), 'a1')
    expect(a1.map((l) => [l.partKey, l.onHand])).toEqual([
      ['id:p9', 9],
      ['text:flex connector, odd one', 1],
    ])
    expect(partKey(null, '  Flex   Connector ')).toBe('text:flex connector')
  })

  it("counts a Can't find press on the line until the next count", () => {
    const rows = [
      mv({ reason: 'delivered', quantity: 4, at: '2026-10-20T10:00:00Z', toContainerId: 'a2', partName: '3/4" ball valve' }),
      mv({ reason: 'cannot_find', quantity: 1, at: '2026-10-21T10:00:00Z', fromContainerId: 'a2', partName: '3/4" ball valve' }),
    ]
    const [line] = linesOf(containerLines(rows), 'a2')
    expect(line).toMatchObject({ onHand: 3, cannotFindSinceCount: 1 })
  })
})

describe('countDiffs and the stale rule', () => {
  const rows = [
    mv({ reason: 'delivered', quantity: 25, at: '2026-10-24T20:30:00Z', toContainerId: 'a2' }),
    mv({ reason: 'used', quantity: 11, at: '2026-10-27T15:00:00Z', fromContainerId: 'a2' }),
    mv({ reason: 'counted', quantity: 12, at: '2026-10-28T18:48:00Z', fromContainerId: 'a2', byName: 'Jordan' }),
    mv({ reason: 'counted', quantity: 0, at: '2026-10-26T18:48:00Z', fromContainerId: 'b1', partName: '50 gal water heater', manufacturer: null }),
  ]
  it('lists every count with expected, counted and the difference, newest first', () => {
    const diffs = countDiffs(rows)
    expect(diffs.map((d) => [d.containerId, d.expected, d.counted, d.diff])).toEqual([
      ['a2', 14, 12, -2],
      ['b1', 0, 0, 0],
    ])
  })
  it('prices a shortfall and never a found', () => {
    expect(missingMoney(-2, 4.7)).toBe(9.4)
    expect(missingMoney(3, 4.7)).toBeNull()
    expect(missingMoney(-2, null)).toBeNull()
  })
  it('knows when a container was last counted and whether a count is due', () => {
    const now = new Date('2026-11-12T12:00:00Z')
    expect(lastCountedAt(rows, 'a2')).toEqual({ at: '2026-10-28T18:48:00Z', byName: 'Jordan' })
    expect(lastCountedAt(rows, 'unsorted')).toBeNull()
    expect(countIsDue(lastCountedAt(rows, 'a2'), new Date('2026-11-10T12:00:00Z'))).toBe(false)
    expect(countIsDue(lastCountedAt(rows, 'a2'), now)).toBe(true)
    expect(countIsDue(null, now)).toBe(true)
    expect(lastCountWords(null, now)).toBe('never counted')
    expect(lastCountWords({ at: '2026-10-28T18:48:00Z', byName: 'Jordan' }, now)).toBe('counted 14 days ago')
    expect(lastCountWords({ at: '2026-11-12T08:00:00Z', byName: 'Jordan' }, now)).toBe('counted today by Jordan')
  })
})

describe('the words', () => {
  it('names the press with its count', () => {
    expect(pressLabel('used', 4)).toBe('Mark 4 used')
    expect(pressLabel('moved', 10, 'A1')).toBe('Move 10 to A1')
    expect(pressLabel('taken', 2, "Mateo's truck")).toBe("Take 2 to Mateo's truck")
    expect(pressLabel('cannot_find', 1)).toBe("Mark 1 as can't find")
    expect(pressLabel('counted', 12)).toBe('Save 12')
    expect(leftWords('A2', 14, 4)).toBe('A2 will have 10 left.')
    expect(leftWords('A2', 4, 4)).toBe('A2 will have none left.')
  })
  it('suggests the next stencil and finds a part across the site', () => {
    expect(nextLabel([{ label: 'A1' }, { label: 'a2' }, { label: 'B1' }], 'A')).toBe('A3')
    expect(nextLabel([], 'C')).toBe('C1')
    const lines = containerLines([
      mv({ reason: 'delivered', quantity: 14, at: '2026-10-20T10:00:00Z', toContainerId: 'a2' }),
      mv({ reason: 'delivered', quantity: 6, at: '2026-10-20T10:00:00Z', toContainerId: 'b1' }),
      mv({ reason: 'delivered', quantity: 3, at: '2026-10-20T10:00:00Z', toContainerId: 'b1', partName: '3/4" ball valve', manufacturer: 'Apollo' }),
    ])
    expect(searchLines(lines, '3/4 copper').map((l) => [l.containerId, l.onHand])).toEqual([
      ['a2', 14],
      ['b1', 6],
    ])
    expect(searchLines(lines, 'apollo')).toHaveLength(1)
    expect(searchLines(lines, '')).toHaveLength(0)
  })
})

describe('places', () => {
  const c = (label: string, locationId: string | null, kind: 'cage' | 'box' | 'unsorted' = 'box') => ({ id: label, jobId: 'j1', label, kind, where: '', locationId, lat: null, lng: null, retiredAt: null, createdAt: '' })
  const p = (id: string, name: string) => ({ id, jobId: 'j1', name, createdAt: '' })
  it('groups by place in name order, Unsorted first, no place last, stencils as read', () => {
    const groups = groupByPlace([c('B2', 'l2'), c('B10', 'l2'), c('A1', 'l1'), c('Unsorted', null, 'unsorted'), c('Z9', null), c('B1', 'l2')], [p('l2', 'Level 2'), p('l1', 'Level 1')])
    expect(groups.map((g) => [g.place?.name ?? null, g.containers.map((x) => x.label)])).toEqual([
      [null, ['Unsorted']],
      ['Level 1', ['A1']],
      ['Level 2', ['B1', 'B2', 'B10']],
      [null, ['Z9']],
    ])
  })
  it('finds boxes by the start of their stencil, spaces and case ignored', () => {
    const cs = [c('B1', null), c('B12', null), c('B120', null), c('A12', null)]
    expect(searchContainers(cs, 'b 12').map((x) => x.label)).toEqual(['B12', 'B120'])
    expect(searchContainers(cs, '')).toEqual([])
    expect(placeName([p('l1', 'Level 1')], 'l1')).toBe('Level 1')
    expect(placeName([], null)).toBe('no place yet')
  })
})
