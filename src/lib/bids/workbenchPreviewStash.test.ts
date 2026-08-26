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
  it('round-trips a preview per price option', () => {
    const storage = fakeStorage()
    writePreviewStash(storage, 'pv-1', { 'row-a': 150, 'row-b': 42.5 })
    writePreviewStash(storage, 'pv-2', { 'row-a': 999 })
    expect(readPreviewStash(storage, 'pv-1')).toEqual({ 'row-a': 150, 'row-b': 42.5 })
    expect(readPreviewStash(storage, 'pv-2')).toEqual({ 'row-a': 999 })
  })

  it('returns null when nothing is stashed', () => {
    expect(readPreviewStash(fakeStorage(), 'pv-1')).toBeNull()
  })

  it('writing null or an empty preview clears the stash', () => {
    const storage = fakeStorage()
    writePreviewStash(storage, 'pv-1', { 'row-a': 150 })
    writePreviewStash(storage, 'pv-1', null)
    expect(storage.map.size).toBe(0)
    writePreviewStash(storage, 'pv-1', { 'row-a': 150 })
    writePreviewStash(storage, 'pv-1', {})
    expect(storage.map.size).toBe(0)
  })

  it('survives corrupt JSON and wrong shapes as null', () => {
    const key = previewStashKey('pv-1')
    expect(readPreviewStash(fakeStorage({ [key]: 'not json' }), 'pv-1')).toBeNull()
    expect(readPreviewStash(fakeStorage({ [key]: '"a string"' }), 'pv-1')).toBeNull()
    expect(readPreviewStash(fakeStorage({ [key]: '[1,2]' }), 'pv-1')).toBeNull()
    expect(readPreviewStash(fakeStorage({ [key]: 'null' }), 'pv-1')).toBeNull()
  })

  it('drops non-finite and non-number entries instead of poisoning the stash', () => {
    const key = previewStashKey('pv-1')
    const storage = fakeStorage({ [key]: JSON.stringify({ good: 150, bad: 'x', worse: null }) })
    expect(readPreviewStash(storage, 'pv-1')).toEqual({ good: 150 })
    expect(readPreviewStash(fakeStorage({ [key]: JSON.stringify({ bad: 'x' }) }), 'pv-1')).toBeNull()
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
    expect(() => writePreviewStash(throwing, 'pv-1', { a: 1 })).not.toThrow()
    expect(() => writePreviewStash(throwing, 'pv-1', null)).not.toThrow()
    expect(readPreviewStash(throwing, 'pv-1')).toBeNull()
  })
})
