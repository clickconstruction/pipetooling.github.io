import { describe, expect, it } from 'vitest'
import { previewStashKey, readPreviewStash, writePreviewStash, type StorageLike } from './workbenchPreviewStash'

function fakeStorage(seed: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed))
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

describe('workbenchPreviewStash', () => {
  it('round-trips a preview per price option, carrying the written-at time', () => {
    const storage = fakeStorage()
    writePreviewStash(storage, 'pv-1', { 'row-a': 150, 'row-b': 42.5 }, 1000)
    writePreviewStash(storage, 'pv-2', { 'row-a': 999 }, 2000)
    expect(readPreviewStash(storage, 'pv-1')).toEqual({ prices: { 'row-a': 150, 'row-b': 42.5 }, at: 1000 })
    expect(readPreviewStash(storage, 'pv-2')).toEqual({ prices: { 'row-a': 999 }, at: 2000 })
  })

  it('returns null when nothing is stashed', () => {
    expect(readPreviewStash(fakeStorage(), 'pv-1')).toBeNull()
  })

  it('writing null or an empty preview clears the stash', () => {
    const storage = fakeStorage()
    writePreviewStash(storage, 'pv-1', { 'row-a': 150 }, 1000)
    writePreviewStash(storage, 'pv-1', null, 2000)
    expect(storage.map.size).toBe(0)
    writePreviewStash(storage, 'pv-1', { 'row-a': 150 }, 3000)
    writePreviewStash(storage, 'pv-1', {}, 4000)
    expect(storage.map.size).toBe(0)
  })

  it('survives corrupt JSON and wrong shapes as null', () => {
    const key = previewStashKey('pv-1')
    expect(readPreviewStash(fakeStorage({ [key]: 'not json' }), 'pv-1')).toBeNull()
    expect(readPreviewStash(fakeStorage({ [key]: '"a string"' }), 'pv-1')).toBeNull()
    expect(readPreviewStash(fakeStorage({ [key]: '[1,2]' }), 'pv-1')).toBeNull()
    expect(readPreviewStash(fakeStorage({ [key]: 'null' }), 'pv-1')).toBeNull()
    // v1 shape (bare price map, no envelope) is not readable as v2
    expect(readPreviewStash(fakeStorage({ [key]: JSON.stringify({ 'row-a': 150 }) }), 'pv-1')).toBeNull()
  })

  it('drops non-finite and non-number price entries instead of poisoning the stash', () => {
    const key = previewStashKey('pv-1')
    const storage = fakeStorage({ [key]: JSON.stringify({ prices: { good: 150, bad: 'x', worse: null }, at: 1000 }) })
    expect(readPreviewStash(storage, 'pv-1')).toEqual({ prices: { good: 150 }, at: 1000 })
    expect(readPreviewStash(fakeStorage({ [key]: JSON.stringify({ prices: { bad: 'x' }, at: 1000 }) }), 'pv-1')).toBeNull()
  })

  it('tolerates a missing or bogus written-at time as 0', () => {
    const key = previewStashKey('pv-1')
    expect(readPreviewStash(fakeStorage({ [key]: JSON.stringify({ prices: { a: 1 } }) }), 'pv-1')).toEqual({
      prices: { a: 1 },
      at: 0,
    })
    expect(readPreviewStash(fakeStorage({ [key]: JSON.stringify({ prices: { a: 1 }, at: 'noon' }) }), 'pv-1')).toEqual({
      prices: { a: 1 },
      at: 0,
    })
  })

  it('swallows storage failures on write', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('nope')
      },
      setItem: () => {
        throw new Error('full')
      },
      removeItem: () => {
        throw new Error('nope')
      },
    }
    expect(() => writePreviewStash(throwing, 'pv-1', { a: 1 }, 1000)).not.toThrow()
    expect(() => writePreviewStash(throwing, 'pv-1', null, 1000)).not.toThrow()
    expect(readPreviewStash(throwing, 'pv-1')).toBeNull()
  })
})
