import { describe, expect, it } from 'vitest'
import type { Door } from './doors'
import { RECENT_DOORS_MAX, readRecentDoorIds, recentDoorsFor, recentDoorsKey, rememberDoor } from './recentDoors'

function memoryStore(initial: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => {
      data[k] = v
    },
  }
}

const door = (id: string): Door => ({ id, kind: 'page', label: id, where: 'x', words: [], to: `/${id}`, gate: () => true })

describe('recentDoors', () => {
  it('keeps the newest first, once each, at most eight, per person', () => {
    const store = memoryStore()
    expect(readRecentDoorIds('u1', store)).toEqual([])
    rememberDoor('u1', 'a', store)
    rememberDoor('u1', 'b', store)
    rememberDoor('u1', 'a', store)
    expect(readRecentDoorIds('u1', store)).toEqual(['a', 'b'])
    expect(readRecentDoorIds('u2', store)).toEqual([])
    for (let i = 0; i < 12; i++) rememberDoor('u1', `d${i}`, store)
    expect(readRecentDoorIds('u1', store)).toHaveLength(RECENT_DOORS_MAX)
    expect(readRecentDoorIds('u1', store)[0]).toBe('d11')
    expect(store.data[recentDoorsKey('u1')]).toContain('d11')
  })
  it('reads nothing from junk, no person or no browser store', () => {
    expect(readRecentDoorIds('u1', memoryStore({ [recentDoorsKey('u1')]: '{not json' }))).toEqual([])
    expect(readRecentDoorIds('u1', memoryStore({ [recentDoorsKey('u1')]: '[1, "a"]' }))).toEqual(['a'])
    expect(readRecentDoorIds(null, memoryStore())).toEqual([])
    expect(readRecentDoorIds('u1', null)).toEqual([])
    expect(rememberDoor(null, 'a', null)).toEqual(['a'])
  })
  it('reads the kept ids back as the viewer’s doors only, in recency order', () => {
    const doors = [door('a'), door('b'), door('c')]
    expect(recentDoorsFor(['c', 'gone', 'a'], doors).map((d) => d.id)).toEqual(['c', 'a'])
    expect(recentDoorsFor([], doors)).toEqual([])
  })
})
