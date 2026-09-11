import { describe, expect, it } from 'vitest'
import { LABOR_VIEW_STORAGE_KEY, parseLaborView, readStoredLaborView, writeStoredLaborView } from './laborView'

describe('laborView', () => {
  it('parses old, and everything else is new (the default since v2.3310)', () => {
    expect(parseLaborView('new')).toBe('new')
    expect(parseLaborView('old')).toBe('old')
    expect(parseLaborView('new1')).toBe('new')
    expect(parseLaborView(null)).toBe('new')
  })
  it('reads and writes the device key and survives a broken storage', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    expect(readStoredLaborView(storage)).toBe('new')
    writeStoredLaborView(storage, 'old')
    expect(store.get(LABOR_VIEW_STORAGE_KEY)).toBe('old')
    expect(readStoredLaborView(storage)).toBe('old')
    const broken = { getItem: () => { throw new Error('nope') }, setItem: () => { throw new Error('nope') } }
    expect(readStoredLaborView(broken)).toBe('new')
    expect(() => writeStoredLaborView(broken, 'new')).not.toThrow()
  })
})
