import { describe, expect, it } from 'vitest'
import { flowFigure, flowTileWord, officeFlow, phoneFlow, startOfDayIso } from './flowRow'
import { ADD_COUNT_NOTE, type Container, type Movement } from './onSite'

const NOW = new Date('2026-10-28T20:00:00Z')

function mv(over: Partial<Movement> & Pick<Movement, 'reason' | 'quantity' | 'at'>): Movement {
  return { id: over.id ?? `${over.at}-${over.reason}-${over.quantity}`, jobId: 'j1', partId: null, partName: '3/4" copper 90', manufacturer: null, fromContainerId: null, toContainerId: null, note: '', byUserId: null, byName: 'Carla', source: null, itemId: null, ...over }
}

function box(id: string, kind: Container['kind'] = 'box', over: Partial<Container> = {}): Container {
  return { id, jobId: 'j1', label: id.toUpperCase(), kind, where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-01T00:00:00Z', ...over }
}

// Twenty-five came in, twenty went to A1, eleven were used from it (five today), a count found seven where nine were expected;
// ten more came straight to B1, which was never counted, and one of its parts could not be found today.
const containers = [box('unsorted', 'unsorted'), box('a1'), box('b1'), box('old', 'box', { retiredAt: '2026-10-20T00:00:00Z' })]
const movements: Movement[] = [
  mv({ reason: 'delivered', quantity: 25, at: '2026-10-24T20:30:00Z', toContainerId: 'unsorted', source: 'PO-2211' }),
  mv({ reason: 'moved', quantity: 20, at: '2026-10-25T13:00:00Z', fromContainerId: 'unsorted', toContainerId: 'a1' }),
  mv({ reason: 'used', quantity: 6, at: '2026-10-27T15:00:00Z', fromContainerId: 'a1' }),
  mv({ reason: 'used', quantity: 5, at: '2026-10-28T14:00:00Z', fromContainerId: 'a1', byName: 'Jordan' }),
  mv({ reason: 'counted', quantity: 7, at: '2026-10-28T18:48:00Z', fromContainerId: 'a1', byName: 'Jordan' }),
  mv({ reason: 'delivered', quantity: 10, at: '2026-10-26T09:00:00Z', toContainerId: 'b1', source: 'PO-2212', partName: '1/2" ball valve' }),
  mv({ reason: 'cannot_find', quantity: 1, at: '2026-10-28T16:00:00Z', fromContainerId: 'b1', partName: '1/2" ball valve' }),
]
const priceOf = (key: string) => (key.includes('ball valve') ? 18.5 : 2.25)

describe('officeFlow', () => {
  it('reads the four figures and the three badges from the ledger', () => {
    const f = officeFlow(containers, movements, NOW, priceOf)
    // came in: 25 + 10; five pieces still wait in Unsorted
    expect(f.cameIn).toBe(35)
    expect(f.unsorted).toBe(5)
    // on site: Unsorted 5 + A1 7 (the count) + B1 9 (one could not be found)
    expect(f.onSite).toBe(21)
    expect(f.boxes).toBe(2)
    // B1 was never counted and holds a Can't find; A1 was counted today
    expect(f.due).toBe(1)
    expect(f.used).toBe(11)
    // missing this week: the count's 2 short plus the 1 that could not be found, priced
    expect(f.missing).toBe(3)
    expect(f.missingMoney).toBeCloseTo(2 * 2.25 + 18.5, 5)
  })

  it('leaves a shortfall outside the window out of the missing figure and its money', () => {
    const f = officeFlow(containers, movements, new Date('2026-11-20T12:00:00Z'), priceOf)
    expect(f.missing).toBe(0)
    expect(f.missingMoney).toBe(0)
    // the other figures are all time
    expect(f.cameIn).toBe(35)
    expect(f.used).toBe(11)
  })

  it('reads zero everywhere on a job with no rows', () => {
    expect(officeFlow([], [], NOW, priceOf)).toEqual({ cameIn: 0, unsorted: 0, onSite: 0, boxes: 0, due: 0, used: 0, missing: 0, missingMoney: 0 })
  })
})

describe('phoneFlow', () => {
  it('counts what waits in Unsorted, what was used since midnight and which boxes need a hand', () => {
    const f = phoneFlow(containers, movements, NOW)
    expect(f.unsorted).toBe(5)
    expect(f.unsortedId).toBe('unsorted')
    // only the five pressed today, from A1; the six were yesterday
    expect(f.usedToday).toBe(5)
    expect(f.usedBoxIds).toEqual(['a1'])
    expect(f.due).toBe(1)
    expect(f.dueBoxIds).toEqual(['b1'])
  })

  it('has no Unsorted to open on a job that never took a delivery, and an empty box is due no count (punch list #398)', () => {
    const f = phoneFlow([box('a1')], [], NOW)
    expect(f.unsortedId).toBeNull()
    expect(f.unsorted).toBe(0)
    // A box with nothing in it offers no count on its screen, so the Count chip leaves it out.
    expect(f.dueBoxIds).toEqual([])
    expect(f.due).toBe(0)
    // Give it a part with no count yet: due.
    const stocked = phoneFlow([box('a1')], [mv({ reason: 'delivered', quantity: 4, at: '2026-10-26T09:00:00Z', toContainerId: 'a1' })], NOW)
    expect(stocked.dueBoxIds).toEqual(['a1'])
  })

  it('an added part counts its own line and leaves the box due (punch list #398)', () => {
    // B1 was never counted. Add a part to it today: the add writes the line's count with its note.
    const added: Movement[] = [
      ...movements,
      mv({ reason: 'delivered', quantity: 12, at: '2026-10-28T19:00:00.000Z', toContainerId: 'b1', partName: 'Hangers', note: 'added on site' }),
      mv({ reason: 'counted', quantity: 12, at: '2026-10-28T19:00:00.001Z', fromContainerId: 'b1', partName: 'Hangers', note: ADD_COUNT_NOTE }),
    ]
    expect(phoneFlow(containers, added, NOW).dueBoxIds).toEqual(['b1'])
    expect(officeFlow(containers, added, NOW, priceOf).due).toBe(1)
    // A count of the box, by hand, clears it. The Can't find on B1 is still a hand needed, so count that line too.
    const counted: Movement[] = [
      ...added,
      mv({ reason: 'counted', quantity: 9, at: '2026-10-28T19:30:00Z', fromContainerId: 'b1', partName: '1/2" ball valve' }),
      mv({ reason: 'counted', quantity: 12, at: '2026-10-28T19:31:00Z', fromContainerId: 'b1', partName: 'Hangers' }),
    ]
    expect(phoneFlow(containers, counted, NOW).dueBoxIds).toEqual([])
  })
})

describe('the row words', () => {
  it('marks thousands and keeps the day start on this device', () => {
    expect(flowFigure(1250)).toBe('1,250')
    expect(flowFigure(0)).toBe('0')
    // a phone's tile reads its word alone under the number, first letter capital
    expect(['came in', 'on site', 'used', 'missing'].map(flowTileWord)).toEqual(['Came in', 'On site', 'Used', 'Missing'])
    expect(flowTileWord('')).toBe('')
    const start = new Date(startOfDayIso(NOW))
    expect(start.getHours()).toBe(0)
    expect(start.getTime()).toBeLessThanOrEqual(NOW.getTime())
  })
})
