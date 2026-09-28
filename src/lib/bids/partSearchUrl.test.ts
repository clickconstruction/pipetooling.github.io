import { describe, expect, it } from 'vitest'
import { partSearchQuery, partSearchUrl, splitTrailingWord } from './partSearchUrl'

describe('partSearchUrl', () => {
  it('searches the whole name as written, on Google', () => {
    expect(partSearchUrl('ADV TABCO 7-PS-66 SS HAND SINK')).toBe(
      'https://www.google.com/search?q=ADV+TABCO+7-PS-66+SS+HAND+SINK',
    )
  })

  it('keeps the part number and its punctuation in the query', () => {
    const url = partSearchUrl('MCGUIR 2165LK CP 1/2IPSX3/8OD LAV SUPPLY L PN: LF2165LK')
    expect(url).toBe(
      'https://www.google.com/search?q=MCGUIR+2165LK+CP+1%2F2IPSX3%2F8OD+LAV+SUPPLY+L+PN%3A+LF2165LK',
    )
    expect(new URL(url as string).searchParams.get('q')).toBe(
      'MCGUIR 2165LK CP 1/2IPSX3/8OD LAV SUPPLY L PN: LF2165LK',
    )
  })

  it('collapses stray whitespace and trims the ends', () => {
    expect(partSearchQuery('  TEMP  LIMITING\tVLV 3/8 ')).toBe('TEMP LIMITING VLV 3/8')
    expect(partSearchUrl('  TEMP  LIMITING\tVLV 3/8 ')).toBe('https://www.google.com/search?q=TEMP+LIMITING+VLV+3%2F8')
  })

  it('has nothing to search for an empty or missing name', () => {
    expect(partSearchUrl('')).toBeNull()
    expect(partSearchUrl('   ')).toBeNull()
    expect(partSearchUrl(null)).toBeNull()
    expect(partSearchUrl(undefined)).toBeNull()
  })

  it('never encodes an ampersand or hash as a URL delimiter', () => {
    const url = partSearchUrl('WATTS 909 RPZ 1" #2 & STRAINER') as string
    expect(new URL(url).searchParams.get('q')).toBe('WATTS 909 RPZ 1" #2 & STRAINER')
  })
})

describe('splitTrailingWord', () => {
  it('splits off the last word so the icon can travel with it', () => {
    expect(splitTrailingWord('ADV TABCO 7-PS-66 SS HAND SINK')).toEqual({ head: 'ADV TABCO 7-PS-66 SS HAND', tail: 'SINK' })
  })

  it('has no head for a one-word name', () => {
    expect(splitTrailingWord('COUPLING')).toEqual({ head: '', tail: 'COUPLING' })
  })

  it('splits on the collapsed name, not the raw one', () => {
    expect(splitTrailingWord('  P-TRAP   W/CO  ')).toEqual({ head: 'P-TRAP', tail: 'W/CO' })
  })
})
