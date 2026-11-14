import { describe, expect, it } from 'vitest'
import type { Container, ContainerMove, Movement, Place } from './onSite'
import { boxHistory, contentsTabWords, historyFoldWords, lineAdded, lineAddedWords, lineHistory, placeAt, type BoxNameChange } from './boxHistory'

const box: Container = { id: 'c1', jobId: 'j1', label: 'R70', kind: 'loose', where: '', locationId: 'p2', lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T10:00:00Z' }
const places: Place[] = [{ id: 'p1', jobId: 'j1', name: 'Arena', createdAt: '' }, { id: 'p2', jobId: 'j1', name: 'Yard', createdAt: '' }]
const move = (id: string, from: string | null, to: string | null, at: string, containerId = 'c1'): ContainerMove => ({ id, jobId: 'j1', containerId, fromLocationId: from, toLocationId: to, byName: 'Priya', at })
const names: BoxNameChange[] = [{ id: 'n1', containerId: 'c1', oldLabel: 'R70 NO CONTAINER', newLabel: 'R70', byName: 'Dana', at: '2026-11-13T15:00:00Z' }]
const row = (id: string, reason: Movement['reason'], quantity: number, at: string, over: Partial<Movement> = {}): Movement => ({ id, jobId: 'j1', partId: null, partName: 'Pex rolls', manufacturer: null, quantity, reason, fromContainerId: reason === 'delivered' ? null : 'c1', toContainerId: reason === 'delivered' ? 'c1' : null, note: '', byUserId: null, byName: 'Marcus', at, source: null, itemId: null, ...over })

describe('a box’s own history', () => {
  it('reads added, moves, a rename and a retire, newest first, under the name it was added with', () => {
    const h = boxHistory({ ...box, retiredAt: '2026-11-20T09:00:00Z' }, places, [move('m1', 'p1', 'p2', '2026-11-05T12:00:00Z'), move('m0', null, 'p1', '2026-11-01T10:05:00Z'), move('x', 'p1', 'p2', '2026-11-06T12:00:00Z', 'other')], names)
    expect(h.map((e) => e.words)).toEqual(['Retired', 'Renamed from R70 NO CONTAINER to R70', 'Moved from Arena to Yard', 'Placed at Arena', 'Added as R70 NO CONTAINER'])
    expect(h[1]!.by).toBe('Dana')
    expect(h[2]!.by).toBe('Priya')
  })

  it('is one line for a box nobody moved or renamed', () => {
    expect(boxHistory(box, places, [], []).map((e) => e.words)).toEqual(['Added as R70'])
  })

  it('knows where the box stood at a moment', () => {
    const moves = [move('m1', 'p1', 'p2', '2026-11-05T12:00:00Z')]
    expect(placeAt(box, places, moves, '2026-11-02T00:00:00Z')).toBe('Arena')
    expect(placeAt(box, places, moves, '2026-11-06T00:00:00Z')).toBe('Yard')
    expect(placeAt(box, places, [], '2026-11-02T00:00:00Z')).toBe('Yard')
    expect(placeAt({ ...box, locationId: null }, places, [], '2026-11-02T00:00:00Z')).toBeNull()
  })
})

describe('a line’s history in one box', () => {
  const nameOf = (id: string | null) => (id === 'c2' ? 'R12' : 'a box')
  const ledger = [
    row('a', 'delivered', 16, '2026-11-01T10:00:00Z'),
    row('b', 'counted', 16, '2026-11-01T10:01:00Z'),
    row('c', 'used', 6, '2026-11-03T08:00:00Z'),
    row('d', 'moved', 3, '2026-11-04T08:00:00Z', { toContainerId: 'c2' }),
    row('e', 'counted', 5, '2026-11-05T08:00:00Z'),
    row('f', 'moved', 2, '2026-11-06T08:00:00Z', { fromContainerId: 'c2', toContainerId: 'c1' }),
    row('g', 'counted', 9, '2026-11-07T08:00:00Z'),
    row('h', 'taken', 1, '2026-11-08T08:00:00Z', { note: 'the shop' }),
    row('z', 'used', 4, '2026-11-03T09:00:00Z', { partName: 'Another part' }),
    row('y', 'used', 4, '2026-11-03T09:00:00Z', { fromContainerId: 'c2' }),
  ]

  it('words every row of the part in the box, newest first, with what each count found', () => {
    expect(lineHistory(ledger, 'c1', 'text:pex rolls', nameOf).map((e) => e.words)).toEqual([
      '1 taken to the shop',
      'Counted 9, 2 more than expected',
      '2 moved in from R12',
      'Counted 5, 2 short',
      '3 moved to R12',
      'Used 6',
      'Counted 16, as expected',
      'Added 16',
    ])
  })

  it('finds when the part first came into the box', () => {
    expect(lineAdded(ledger, 'c1', 'text:pex rolls')).toEqual({ at: '2026-11-01T10:00:00Z', by: 'Marcus' })
    expect(lineAdded(ledger, 'c1', 'text:nothing')).toBeNull()
  })

  it('words the line under a part and the tab', () => {
    expect(lineAddedWords('Nov 1', 'Marcus', 'Arena')).toBe('Added Nov 1 by Marcus, at Arena')
    expect(lineAddedWords('Nov 1', '', null)).toBe('Added Nov 1')
    expect(contentsTabWords(3)).toBe('Contents · 3')
    expect(contentsTabWords(0)).toBe('Contents')
    expect(historyFoldWords(1)).toBe('1 event')
    expect(historyFoldWords(8)).toBe('8 events')
  })
})
