import { describe, expect, it } from 'vitest'
import {
  autoContrastText,
  isValidHexColor,
  parseBidBoardSelfHighlightPref,
  resolveBidBoardSelfHighlight,
  withThemePref,
} from './bidBoardSelfHighlight'

describe('isValidHexColor', () => {
  it('accepts #rrggbb only', () => {
    expect(isValidHexColor('#111827')).toBe(true)
    expect(isValidHexColor('#FDE047')).toBe(true)
    expect(isValidHexColor('#fff')).toBe(false)
    expect(isValidHexColor('red')).toBe(false)
    expect(isValidHexColor('111827')).toBe(false)
    expect(isValidHexColor(null)).toBe(false)
    expect(isValidHexColor(42)).toBe(false)
  })
})

describe('autoContrastText', () => {
  it('dark boxes get white text, light boxes get dark text', () => {
    expect(autoContrastText('#111827')).toBe('#ffffff')
    expect(autoContrastText('#2563eb')).toBe('#ffffff')
    expect(autoContrastText('#fde047')).toBe('#111827')
    expect(autoContrastText('#f9fafb')).toBe('#111827')
  })

  it('falls back to white on garbage input', () => {
    expect(autoContrastText('nope')).toBe('#ffffff')
  })
})

describe('parseBidBoardSelfHighlightPref', () => {
  it('accepts the documented shape and resolves bad text to auto', () => {
    expect(
      parseBidBoardSelfHighlightPref({
        light: { bg: '#2563eb', text: 'auto' },
        dark: { bg: '#fde047', text: 'not-a-color' },
      }),
    ).toEqual({
      light: { bg: '#2563eb', text: 'auto' },
      dark: { bg: '#fde047', text: 'auto' },
    })
  })

  it('drops themes with an invalid bg, and tolerates null / non-objects', () => {
    expect(parseBidBoardSelfHighlightPref({ light: { bg: 'red', text: 'auto' } })).toEqual({})
    expect(parseBidBoardSelfHighlightPref(null)).toEqual({})
    expect(parseBidBoardSelfHighlightPref('#2563eb')).toEqual({})
    expect(parseBidBoardSelfHighlightPref(7)).toEqual({})
  })
})

describe('resolveBidBoardSelfHighlight', () => {
  it('uses theme-aware defaults when nothing is chosen — dark is the INVERTED pair', () => {
    expect(resolveBidBoardSelfHighlight({}, 'light')).toEqual({ backgroundColor: '#111827', color: '#ffffff' })
    expect(resolveBidBoardSelfHighlight({}, 'dark')).toEqual({ backgroundColor: '#f9fafb', color: '#111827' })
  })

  it("applies the chosen pair per theme, resolving 'auto' by luminance", () => {
    const pref = {
      light: { bg: '#fde047', text: 'auto' as const },
      dark: { bg: '#2563eb', text: '#fde047' },
    }
    expect(resolveBidBoardSelfHighlight(pref, 'light')).toEqual({ backgroundColor: '#fde047', color: '#111827' })
    expect(resolveBidBoardSelfHighlight(pref, 'dark')).toEqual({ backgroundColor: '#2563eb', color: '#fde047' })
  })

  it('one chosen theme never bleeds into the other', () => {
    const pref = { dark: { bg: '#fde047', text: 'auto' as const } }
    expect(resolveBidBoardSelfHighlight(pref, 'light')).toEqual({ backgroundColor: '#111827', color: '#ffffff' })
  })
})

describe('withThemePref', () => {
  it('sets one theme without touching the other, and null clears back to default', () => {
    const start = { light: { bg: '#2563eb', text: 'auto' as const } }
    const both = withThemePref(start, 'dark', { bg: '#fde047', text: 'auto' })
    expect(both).toEqual({
      light: { bg: '#2563eb', text: 'auto' },
      dark: { bg: '#fde047', text: 'auto' },
    })
    expect(withThemePref(both, 'light', null)).toEqual({ dark: { bg: '#fde047', text: 'auto' } })
    // immutability
    expect(start).toEqual({ light: { bg: '#2563eb', text: 'auto' } })
  })
})
