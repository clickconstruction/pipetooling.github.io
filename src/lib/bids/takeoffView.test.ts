import { describe, expect, it } from 'vitest'
import { TAKEOFF_VIEWS, TAKEOFF_VIEW_STORAGE_KEY, hasStoredTakeoffView, parseTakeoffView, readStoredTakeoffView, viewForChooserKey, writeStoredTakeoffView } from './takeoffView'

describe('parseTakeoffView', () => {
  it('accepts the two views and lands everything else — the retired old included — on One at a time (v2.3588)', () => {
    expect(parseTakeoffView('new1')).toBe('new1')
    expect(parseTakeoffView('new2')).toBe('new2')
    expect(parseTakeoffView('old')).toBe('new1')
    expect(parseTakeoffView('new')).toBe('new1')
    expect(parseTakeoffView(null)).toBe('new1')
    expect(parseTakeoffView(undefined)).toBe('new1')
  })
})

describe('TAKEOFF_VIEWS', () => {
  it('labels the views for what they do while the stored ids stay put (v2.2990)', () => {
    expect(TAKEOFF_VIEWS.map((v) => [v.id, v.label])).toEqual([
      ['new1', 'One at a time'],
      ['new2', 'Sheet'],
    ])
  })
})

describe('viewForChooserKey', () => {
  it('maps 1 · 2 to the cards in order and nothing else', () => {
    expect(viewForChooserKey('1')).toBe('new1')
    expect(viewForChooserKey('2')).toBe('new2')
    expect(viewForChooserKey('3')).toBeNull()
    expect(viewForChooserKey('4')).toBeNull()
    expect(viewForChooserKey('0')).toBeNull()
    expect(viewForChooserKey('12')).toBeNull()
    expect(viewForChooserKey('Enter')).toBeNull()
  })
})

describe('readStoredTakeoffView / writeStoredTakeoffView', () => {
  it('round-trips through storage under the versioned key', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) } }
    expect(readStoredTakeoffView(storage)).toBe('new1')
    writeStoredTakeoffView(storage, 'new2')
    expect(store.get(TAKEOFF_VIEW_STORAGE_KEY)).toBe('new2')
    expect(readStoredTakeoffView(storage)).toBe('new2')
  })

  it('never throws when storage is missing or broken', () => {
    expect(readStoredTakeoffView(null)).toBe('new1')
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    expect(readStoredTakeoffView(broken)).toBe('new1')
    expect(() => writeStoredTakeoffView(broken, 'new1')).not.toThrow()
  })
})

describe('hasStoredTakeoffView (v2.3165)', () => {
  const storageOf = (raw: string | null) => ({ getItem: () => raw })
  it('is true only once the device holds a known view — the retired Old still counts as a pick', () => {
    expect(hasStoredTakeoffView(storageOf(null))).toBe(false)
    expect(hasStoredTakeoffView(storageOf(''))).toBe(false)
    expect(hasStoredTakeoffView(storageOf('new'))).toBe(false)
    expect(hasStoredTakeoffView(storageOf('old'))).toBe(true)
    expect(hasStoredTakeoffView(storageOf('new1'))).toBe(true)
    expect(hasStoredTakeoffView(storageOf('new2'))).toBe(true)
  })
  it('reads as never-picked when storage is missing or broken, so the box still asks', () => {
    expect(hasStoredTakeoffView(null)).toBe(false)
    expect(hasStoredTakeoffView({ getItem: () => { throw new Error('denied') } })).toBe(false)
  })
})
