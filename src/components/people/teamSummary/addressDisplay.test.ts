import { describe, expect, it } from 'vitest'
import { compactAddressForHoursDisplay } from './addressDisplay'

describe('compactAddressForHoursDisplay', () => {
  it('strips trailing state + 5-digit ZIP from a space-separated address', () => {
    expect(compactAddressForHoursDisplay('12921 FM 20 Kingsbury TX 78209')).toBe(
      '12921 FM 20 Kingsbury',
    )
  })

  it('strips trailing ", STATE ZIP" from a comma-separated address', () => {
    expect(
      compactAddressForHoursDisplay('12921 FM 20, Kingsbury, TX 78209'),
    ).toBe('12921 FM 20, Kingsbury')
  })

  it('handles ZIP+4 (NNNNN-NNNN) suffix', () => {
    expect(
      compactAddressForHoursDisplay('123 Main St San Antonio TX 78209-1234'),
    ).toBe('123 Main St San Antonio')
  })

  it('is case-insensitive on the state code', () => {
    expect(compactAddressForHoursDisplay('Address tx 78209')).toBe('Address')
  })

  it('leaves an address with no state+ZIP unchanged', () => {
    expect(compactAddressForHoursDisplay('123 Main St')).toBe('123 Main St')
  })

  it('leaves an address with only state (no ZIP) unchanged', () => {
    expect(compactAddressForHoursDisplay('1234 Address TX')).toBe(
      '1234 Address TX',
    )
  })

  it('returns empty string for empty input', () => {
    expect(compactAddressForHoursDisplay('')).toBe('')
  })

  it('trims surrounding whitespace', () => {
    expect(
      compactAddressForHoursDisplay('  123 Main St San Antonio TX 78209  '),
    ).toBe('123 Main St San Antonio')
  })

  it('strips a trailing comma left behind after removal', () => {
    // Strict comma form where city is followed by ", TX 78209" with a
    // stray extra comma — the cleanup pass should leave a tidy "Street, City".
    expect(
      compactAddressForHoursDisplay('1234 Address Drive, San Antonio, TX 78209'),
    ).toBe('1234 Address Drive, San Antonio')
  })

  it('does not strip ZIP-shaped numbers that are not preceded by a state code', () => {
    // "Suite 78209" looks ZIP-like but has no state code in front, so
    // it must NOT be stripped. Important: the modal sometimes shows
    // street addresses that include a 5-digit unit/suite number.
    expect(compactAddressForHoursDisplay('123 Main St Suite 78209')).toBe(
      '123 Main St Suite 78209',
    )
  })
})
