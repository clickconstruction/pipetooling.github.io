import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readIncludeAddress, readLastLooked, readNotThese, writeIncludeAddress, writeLastLooked, writeNotThese } from './sinceYouLooked'

// The node test environment has no window; a Map-backed stand-in is installed per test.
const g = globalThis as unknown as { window?: unknown }
let store: Map<string, string>
let throwing = false
function installWindow() {
  g.window = {
    localStorage: {
      getItem: (k: string) => { if (throwing) throw new Error('blocked'); return store.has(k) ? store.get(k)! : null },
      setItem: (k: string, v: string) => { if (throwing) throw new Error('blocked'); store.set(k, String(v)) },
      removeItem: (k: string) => { if (throwing) throw new Error('blocked'); store.delete(k) },
    },
  }
}
beforeEach(() => { store = new Map(); throwing = false; installWindow() })
afterEach(() => { delete g.window })

const D = 'harlow'

describe('readLastLooked / writeLastLooked', () => {
  it('is null until written, then the stamp, one key per development', () => {
    expect(readLastLooked(D)).toBeNull()
    writeLastLooked(D, '2026-10-28T12:00:00Z')
    expect(store.get('pt.development.harlow.lastLooked')).toBe('2026-10-28T12:00:00Z')
    expect(readLastLooked(D)).toBe('2026-10-28T12:00:00Z')
    expect(readLastLooked('ridgeway')).toBeNull()
  })
  it('a stamp that is not a date reads as none', () => {
    store.set('pt.development.harlow.lastLooked', 'yesterday')
    expect(readLastLooked(D)).toBeNull()
    store.set('pt.development.harlow.lastLooked', '')
    expect(readLastLooked(D)).toBeNull()
  })
  it('a device that refuses storage reads none and swallows the write', () => {
    throwing = true
    expect(readLastLooked(D)).toBeNull()
    expect(() => writeLastLooked(D, '2026-10-28T12:00:00Z')).not.toThrow()
  })
})

describe('readIncludeAddress / writeIncludeAddress', () => {
  it('is off until written on; off removes the key; only "1" counts', () => {
    expect(readIncludeAddress(D)).toBe(false)
    writeIncludeAddress(D, true)
    expect(store.get('pt.development.harlow.includeAddress')).toBe('1')
    expect(readIncludeAddress(D)).toBe(true)
    expect(readIncludeAddress('ridgeway')).toBe(false)
    writeIncludeAddress(D, false)
    expect(store.has('pt.development.harlow.includeAddress')).toBe(false)
    store.set('pt.development.harlow.includeAddress', 'yes')
    expect(readIncludeAddress(D)).toBe(false)
  })
  it('a device that refuses storage reads off', () => {
    throwing = true
    expect(readIncludeAddress(D)).toBe(false)
    expect(() => writeIncludeAddress(D, true)).not.toThrow()
  })
})

describe('readNotThese / writeNotThese', () => {
  it('round-trips the pair keys as a JSON list', () => {
    expect(readNotThese(D)).toEqual(new Set())
    writeNotThese(D, new Set(['BP401:JP1102', 'BP402:JP1103']))
    expect(store.get('pt.development.harlow.pairNotThese')).toBe('["BP401:JP1102","BP402:JP1103"]')
    expect(readNotThese(D)).toEqual(new Set(['BP401:JP1102', 'BP402:JP1103']))
    writeNotThese(D, new Set())
    expect(store.get('pt.development.harlow.pairNotThese')).toBe('[]')
    expect(readNotThese(D)).toEqual(new Set())
  })
  it('keeps only the strings of what it finds, and nothing from junk', () => {
    store.set('pt.development.harlow.pairNotThese', '["BP401:JP1102", 7, null, "BP403:JP1104"]')
    expect(readNotThese(D)).toEqual(new Set(['BP401:JP1102', 'BP403:JP1104']))
    store.set('pt.development.harlow.pairNotThese', '{"a":1}')
    expect(readNotThese(D)).toEqual(new Set())
    store.set('pt.development.harlow.pairNotThese', 'not json')
    expect(readNotThese(D)).toEqual(new Set())
    throwing = true
    expect(readNotThese(D)).toEqual(new Set())
    expect(() => writeNotThese(D, new Set(['x:y']))).not.toThrow()
  })
})
