import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { BRIDGE_DOORS, doorFromSearch, doorsToDraw, searchAfterDoor } from './doors'

describe('the Bridge’s doors', () => {
  it('reads the open door from the address, and nothing from a word that is no door', () => {
    expect(doorFromSearch('money', 0)).toBe('money')
    expect(doorFromSearch('flow', 3)).toBe('flow')
    expect(doorFromSearch(null, 3)).toBeNull()
    expect(doorFromSearch('', 3)).toBeNull()
    expect(doorFromSearch('monday', 3)).toBeNull()
    // Soft numbers has no door when nothing is soft.
    expect(doorFromSearch('soft', 0)).toBeNull()
    expect(doorFromSearch('soft', 2)).toBe('soft')
  })

  it('opens the pressed door, closes the open one when it is pressed again, and keeps the rest of the address', () => {
    expect(searchAfterDoor('', 'money', null)).toBe('door=money')
    expect(searchAfterDoor('door=money', 'flow', 'money')).toBe('door=flow')
    expect(searchAfterDoor('door=money', 'money', 'money')).toBe('')
    // A link that opens a door never closes it.
    expect(searchAfterDoor('door=money', 'money', 'money', true)).toBe('door=money')
    expect(searchAfterDoor('week=2026-11-08', 'people', null)).toBe('week=2026-11-08&door=people')
    // The Monday sheet's address is dropped on the way.
    expect(searchAfterDoor('view=monday', 'flow', null)).toBe('door=flow')
  })

  it('draws three doors, and a fourth with its count when something is soft', () => {
    expect(doorsToDraw(0).map((d) => d.name)).toEqual(['The flow', 'Money', 'People'])
    expect(doorsToDraw(1).map((d) => d.name)).toEqual(['The flow', 'Money', 'People', '1 soft number'])
    expect(doorsToDraw(7)[3]?.name).toBe('7 soft numbers')
  })

  it('writes plain words', () => {
    for (const d of BRIDGE_DOORS) for (const s of [d.name, d.holds, d.holdsShort]) expect(plainWordsFailures(s), s).toEqual([])
  })
})
