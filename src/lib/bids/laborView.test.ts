import { describe, expect, it } from 'vitest'
import { LABOR_VIEW_STORAGE_KEY, parseLaborView, readStoredLaborView, writeStoredLaborView } from './laborView'

describe('laborView', () => {
  it('parses new, and everything else is old', () => {
    expect(parseLaborView('new')).toBe('new')
    expect(parseLaborView('old')).toBe('old')
    expect(parseLaborView('new1')).toBe('old')
    expect(parseLaborView(null)).toBe('old')
  })
  it('reads and writes the device key and survives a broken storage', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    expect(readStoredLaborView(storage)).toBe('old')
    writeStoredLaborView(storage, 'new')
    expect(store.get(LABOR_VIEW_STORAGE_KEY)).toBe('new')
    expect(readStoredLaborView(storage)).toBe('new')
    const broken = { getItem: () => { throw new Error('nope') }, setItem: () => { throw new Error('nope') } }
    expect(readStoredLaborView(broken)).toBe('old')
    expect(() => writeStoredLaborView(broken, 'new')).not.toThrow()
  })
})
