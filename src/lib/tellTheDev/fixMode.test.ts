import { describe, expect, it } from 'vitest'
import { fixModeStorageKey, readFixMode, readWrenchOpened, writeFixMode, writeWrenchOpened } from './fixMode'

function memoryStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed))
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data }
}

describe('the wrench’s switch (Fix Mode until v2.8043)', () => {
  it('starts on for a signed-in person', () => {
    expect(readFixMode(memoryStorage(), 'u1')).toBe(true)
  })

  it('is off with nobody signed in', () => {
    expect(readFixMode(memoryStorage(), null)).toBe(false)
  })

  it('stays off once switched off, for that person alone', () => {
    const s = memoryStorage()
    writeFixMode(s, 'u1', false)
    expect(readFixMode(s, 'u1')).toBe(false)
    expect(readFixMode(s, 'u2')).toBe(true)
    expect(s.data.get(fixModeStorageKey('u1'))).toBe('off')
    writeFixMode(s, 'u1', true)
    expect(readFixMode(s, 'u1')).toBe(true)
  })

  it('keeps the default when storage throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readFixMode(broken, 'u1')).toBe(true)
    expect(() => writeFixMode(broken, 'u1', false)).not.toThrow()
  })

  it('remembers the first open, after which the wrench drops its words', () => {
    const s = memoryStorage()
    expect(readWrenchOpened(s, 'u1')).toBe(false)
    writeWrenchOpened(s, 'u1')
    expect(readWrenchOpened(s, 'u1')).toBe(true)
    expect(readWrenchOpened(s, 'u2')).toBe(false)
  })
})
