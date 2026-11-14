import { describe, expect, it } from 'vitest'
import { LAST_BOX_KIND_KEY, readLastBoxKind, rememberBoxKind } from './boxKindMemory'

const mem = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), map: m }
}

describe('the last kind added on this device', () => {
  it('is Cage until a box was added, then what was picked', () => {
    const s = mem()
    expect(readLastBoxKind(s)).toBe('cage')
    rememberBoxKind('loose', s)
    expect(s.map.get(LAST_BOX_KIND_KEY)).toBe('loose')
    expect(readLastBoxKind(s)).toBe('loose')
  })

  it('never opens on Unsorted or on a word it does not know, and lives without storage', () => {
    const s = mem()
    s.setItem(LAST_BOX_KIND_KEY, 'unsorted')
    expect(readLastBoxKind(s)).toBe('cage')
    expect(readLastBoxKind(null)).toBe('cage')
    expect(() => rememberBoxKind('box', null)).not.toThrow()
  })
})
