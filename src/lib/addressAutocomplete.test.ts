import { describe, expect, it } from 'vitest'
import { parseAddressSuggestions, splitMainForBold, suggestionLocality, suggestionSavedAddress } from './addressAutocomplete'

const raw = {
  suggestions: [
    { main: '1207 Kingsbury Ln', mainMatchEnd: 9, secondary: 'Kingsbury, TX, USA', full: '1207 Kingsbury Ln, Kingsbury, TX 78638, USA' },
    { main: '1207 Kings Hwy', mainMatchEnd: 9, secondary: 'San Antonio, TX, USA', full: '1207 Kings Hwy, San Antonio, TX 78204, USA' },
    { main: '', mainMatchEnd: 0, secondary: 'x', full: 'x' }, // dropped
    null,
  ],
}

describe('parseAddressSuggestions', () => {
  it('parses valid suggestions and drops junk', () => {
    const s = parseAddressSuggestions(raw)
    expect(s).toHaveLength(2)
    expect(s[0]!.main).toBe('1207 Kingsbury Ln')
    expect(s[0]!.full).toContain('78638')
  })
  it('clamps matchEnd into range and tolerates malformed payloads', () => {
    expect(parseAddressSuggestions({ suggestions: [{ main: 'abc', mainMatchEnd: 99 }] })[0]!.mainMatchEnd).toBe(3)
    expect(parseAddressSuggestions(null)).toEqual([])
    expect(parseAddressSuggestions({ suggestions: 'x' })).toEqual([])
    expect(parseAddressSuggestions({ error: 'nope' })).toEqual([])
  })
  it('caps at five suggestions', () => {
    const many = { suggestions: Array.from({ length: 9 }, (_, i) => ({ main: `addr ${i}` })) }
    expect(parseAddressSuggestions(many)).toHaveLength(5)
  })
})

describe('splitMainForBold', () => {
  const s = parseAddressSuggestions(raw)
  it('splits at the match boundary', () => {
    expect(splitMainForBold(s[0]!)).toEqual(['1207 King', 'sbury Ln'])
  })
  it('bolds everything when the boundary is unknown or past the end', () => {
    expect(splitMainForBold({ main: 'abc', mainMatchEnd: 0, secondary: '', full: 'abc' })).toEqual(['abc', ''])
    expect(splitMainForBold({ main: 'abc', mainMatchEnd: 3, secondary: '', full: 'abc' })).toEqual(['abc', ''])
  })
})

describe('suggestionLocality', () => {
  it('drops the USA tail', () => {
    expect(suggestionLocality(parseAddressSuggestions(raw)[0]!)).toBe('Kingsbury, TX')
    expect(suggestionLocality({ main: 'x', mainMatchEnd: 0, secondary: 'Seguin, TX', full: 'x' })).toBe('Seguin, TX')
  })
})

describe('suggestionSavedAddress', () => {
  it('writes the full address without the USA tail', () => {
    expect(suggestionSavedAddress(parseAddressSuggestions(raw)[0]!)).toBe('1207 Kingsbury Ln, Kingsbury, TX 78638')
  })
})
