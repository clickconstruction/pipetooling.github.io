import { describe, expect, it } from 'vitest'
import { TAKEOFF_VIEW_STORAGE_KEY, parseTakeoffView, readStoredTakeoffView, writeStoredTakeoffView } from './takeoffView'

describe('parseTakeoffView', () => {
  it('accepts the two new views and defaults everything else to old', () => {
    expect(parseTakeoffView('new1')).toBe('new1')
    expect(parseTakeoffView('new2')).toBe('new2')
    expect(parseTakeoffView('old')).toBe('old')
    expect(parseTakeoffView('new')).toBe('old')
    expect(parseTakeoffView(null)).toBe('old')
    expect(parseTakeoffView(undefined)).toBe('old')
  })
})

describe('readStoredTakeoffView / writeStoredTakeoffView', () => {
  it('round-trips through storage under the versioned key', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) } }
    expect(readStoredTakeoffView(storage)).toBe('old')
    writeStoredTakeoffView(storage, 'new2')
    expect(store.get(TAKEOFF_VIEW_STORAGE_KEY)).toBe('new2')
    expect(readStoredTakeoffView(storage)).toBe('new2')
  })

  it('never throws when storage is missing or broken', () => {
    expect(readStoredTakeoffView(null)).toBe('old')
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    expect(readStoredTakeoffView(broken)).toBe('old')
    expect(() => writeStoredTakeoffView(broken, 'new1')).not.toThrow()
  })
})
