import { describe, expect, it } from 'vitest'
import { isSubPortalFocused, parseSubPortalFocus, subPortalFocusDomId, subPortalFocusValue, withSubPortalFocus } from './subPortalFocus'

describe('subPortalFocus', () => {
  it('parses sheet and offer focus values and rejects the rest', () => {
    expect(parseSubPortalFocus('sheet:abc-123')).toEqual({ kind: 'sheet', id: 'abc-123' })
    expect(parseSubPortalFocus(' offer:o1 ')).toEqual({ kind: 'offer', id: 'o1' })
    expect(parseSubPortalFocus('payment:x')).toBeNull()
    expect(parseSubPortalFocus('sheet:')).toBeNull()
    expect(parseSubPortalFocus('sheet:<script>')).toBeNull()
    expect(parseSubPortalFocus(null)).toBeNull()
    expect(parseSubPortalFocus('')).toBeNull()
  })

  it('round-trips through the param value and names a DOM id', () => {
    const f = { kind: 'sheet' as const, id: 's1' }
    expect(parseSubPortalFocus(subPortalFocusValue(f))).toEqual(f)
    expect(subPortalFocusDomId(f)).toBe('sp-focus-sheet-s1')
    expect(isSubPortalFocused(f, 'sheet', 's1')).toBe(true)
    expect(isSubPortalFocused(f, 'offer', 's1')).toBe(false)
    expect(isSubPortalFocused(null, 'sheet', 's1')).toBe(false)
  })

  it('appends the focus param to token links, preview links and hashes alike', () => {
    const f = { kind: 'sheet' as const, id: 's1' }
    expect(withSubPortalFocus('https://x.test/sub?t=abc', f)).toBe('https://x.test/sub?t=abc&focus=sheet%3As1')
    expect(withSubPortalFocus('https://x.test/sub?t=abc&preview=1', f)).toBe('https://x.test/sub?t=abc&preview=1&focus=sheet%3As1')
    expect(withSubPortalFocus('https://x.test/p/danny', f)).toBe('https://x.test/p/danny?focus=sheet%3As1')
    expect(withSubPortalFocus('https://x.test/sub?t=abc#top', f)).toBe('https://x.test/sub?t=abc&focus=sheet%3As1#top')
    // A stale focus is replaced, not doubled.
    expect(withSubPortalFocus('https://x.test/sub?focus=offer%3Ao9&t=abc', f)).toBe('https://x.test/sub?t=abc&focus=sheet%3As1')
  })
})
