import { describe, expect, it } from 'vitest'
import { helpGuideAddressFromSlugPath } from './helpGuideUrlParam'

describe('helpGuideAddressFromSlugPath', () => {
  it('opens the guide a /help/<slug> address names', () => {
    expect(helpGuideAddressFromSlugPath('see-which-bills-went-out')).toBe('/help?g=see-which-bills-went-out')
  })
  it('keeps a heading\'s anchor', () => {
    expect(helpGuideAddressFromSlugPath('see-which-bills-went-out', '#move-between-months')).toBe('/help?g=see-which-bills-went-out#move-between-months')
    expect(helpGuideAddressFromSlugPath('pin-mode', '#')).toBe('/help?g=pin-mode')
  })
  it('opens the list of guides when the slug is empty, and never writes a raw slug into the address', () => {
    expect(helpGuideAddressFromSlugPath('')).toBe('/help')
    expect(helpGuideAddressFromSlugPath(undefined)).toBe('/help')
    expect(helpGuideAddressFromSlugPath('a b&c')).toBe('/help?g=a%20b%26c')
  })
})
