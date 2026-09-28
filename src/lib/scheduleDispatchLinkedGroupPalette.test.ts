import { describe, expect, it } from 'vitest'
import { buildLinkedGroupAccentMap } from './scheduleDispatchLinkedGroupPalette'

/** "Highlight linked" on the hub's People tab: one border + tint per linked group, picked from the group id. */
describe('buildLinkedGroupAccentMap', () => {
  it('picks the accent from the id, the same one every time', () => {
    const first = buildLinkedGroupAccentMap(['a', 'b'])
    const again = buildLinkedGroupAccentMap(['b', 'a'])
    expect(first.get('a')).toEqual({ borderColor: '#4d7c0f', background: '#f7fee7' })
    expect(first.get('b')).toEqual({ borderColor: '#c2410c', background: 'var(--bg-orange-tint)' })
    expect(again.get('a')).toEqual(first.get('a'))
    expect(again.get('b')).toEqual(first.get('b'))
  })

  it('does not depend on which other groups are on the board', () => {
    const alone = buildLinkedGroupAccentMap(['a'])
    const crowded = buildLinkedGroupAccentMap(['x', 'y', 'a', 'z'])
    expect(crowded.get('a')).toEqual(alone.get('a'))
  })

  it('can give two groups the same accent — ten accents, any number of groups', () => {
    const m = buildLinkedGroupAccentMap(['a', 'k'])
    expect(m.size).toBe(2)
    expect(m.get('k')).toEqual(m.get('a'))
  })

  it('gives every group id an accent, however long the id', () => {
    const ids = [
      '3f2b8c1e-0d4a-4e6b-9a57-1c2d3e4f5a6b',
      'ffffffff-ffff-4fff-bfff-ffffffffffff',
      '00000000-0000-4000-8000-000000000000',
      'z'.repeat(200),
    ]
    const m = buildLinkedGroupAccentMap(ids)
    expect(m.size).toBe(ids.length)
    for (const id of ids) {
      const accent = m.get(id)
      expect(accent?.borderColor).toMatch(/^#[0-9a-f]{6}$/)
      expect(accent?.background).toBeTruthy()
    }
  })

  it('keeps one entry per id and skips an empty one', () => {
    const m = buildLinkedGroupAccentMap(['a', '', 'a', null as unknown as string])
    expect([...m.keys()]).toEqual(['a'])
  })

  it('reads any iterable, and returns an empty map for none', () => {
    expect(buildLinkedGroupAccentMap(new Set(['a', 'b'])).size).toBe(2)
    expect(buildLinkedGroupAccentMap([]).size).toBe(0)
  })
})
