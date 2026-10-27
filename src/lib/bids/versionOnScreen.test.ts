import { describe, expect, it } from 'vitest'
import { savedTickWords, versionOnScreen } from './versionOnScreen'

// BP545's shape: the base version Tommy Gillis and INCLUDING WATER SOFTENER, an alternate with its own takeoff.
const versions = [
  { id: 'base', name: 'Tommy Gillis', is_alternate: false },
  { id: 'alt', name: 'INCLUDING WATER SOFTENER', is_alternate: true },
]

describe('versionOnScreen (v2.6003, Wendi’s hose bibs)', () => {
  it('names the version the prices land on, and whether it is the base or an alternate', () => {
    expect(versionOnScreen(versions, 'base')).toEqual({ name: 'Tommy Gillis', kind: 'base' })
    expect(versionOnScreen(versions, 'alt')).toEqual({ name: 'INCLUDING WATER SOFTENER', kind: 'alternate' })
  })

  it('an unsplit bid, or a version that is gone, has none', () => {
    expect(versionOnScreen([], null)).toBeNull()
    expect(versionOnScreen(versions, null)).toBeNull()
    expect(versionOnScreen(versions, 'gone')).toBeNull()
  })

  it('a missing is_alternate reads as base', () => {
    expect(versionOnScreen([{ id: 'v', name: 'To Plans' }], 'v')).toEqual({ name: 'To Plans', kind: 'base' })
  })
})

describe('savedTickWords (v2.6003)', () => {
  it('reads saved ✓ on an unsplit bid, and names the version the price landed on when the bid has versions', () => {
    expect(savedTickWords(null)).toBe('saved ✓')
    expect(savedTickWords({ name: 'Tommy Gillis', kind: 'base' })).toBe('saved ✓ on Tommy Gillis')
    expect(savedTickWords({ name: 'INCLUDING WATER SOFTENER', kind: 'alternate' })).toBe('saved ✓ on INCLUDING WATER SOFTENER')
  })
})
