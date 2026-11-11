import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { COUNTY_CLERKS_EXAMPLE, COUNTY_CLERKS_HINT, clerkCountyKey, lienClerkFor, parseCountyClerks } from './lienCountyClerks'

// Every county, address, fee and hour here is made up.
const TYPED = ['Alder | 100 Court St, Marlow | $26 first page, $4 each more | 8 to 5', '', 'cedar county|4 Square Plaza, Fenwick||', 'Birch', ' | nowhere | $1 | 9 to 5', 'Alder | a second line typed by mistake | $99 | never'].join('\n')

describe('the county clerks the office typed in Settings (punch list #314, change 10)', () => {
  it('reads one clerk a line, and skips a line with no county or nothing after it', () => {
    expect(parseCountyClerks(TYPED)).toEqual([
      { county: 'Alder', where: '100 Court St, Marlow', fee: '$26 first page, $4 each more', hours: '8 to 5' },
      { county: 'cedar', where: '4 Square Plaza, Fenwick', fee: '', hours: '' },
    ])
    expect(parseCountyClerks('')).toEqual([])
    expect(parseCountyClerks(null)).toEqual([])
  })
  it('finds a property’s clerk however the county is written, and the first line for a county stands', () => {
    expect(lienClerkFor(TYPED, 'ALDER County')).toEqual({ where: '100 Court St, Marlow', fee: '$26 first page, $4 each more', hours: '8 to 5' })
    expect(lienClerkFor(TYPED, ' Cedar ')).toEqual({ where: '4 Square Plaza, Fenwick', fee: '', hours: '' })
    expect(clerkCountyKey('Alder  County')).toBe('alder')
  })
  it('never guesses: a county nobody typed, a county with a bare name and a blank county have no clerk', () => {
    expect(lienClerkFor(TYPED, 'Dogwood')).toBeUndefined()
    expect(lienClerkFor(TYPED, 'Birch')).toBeUndefined()
    expect(lienClerkFor(TYPED, '')).toBeUndefined()
    expect(lienClerkFor(undefined, 'Alder')).toBeUndefined()
  })
  it('the box’s own example reads as a clerk, and its hint is plain words', () => {
    expect(parseCountyClerks(COUNTY_CLERKS_EXAMPLE)).toHaveLength(1)
    expect(plainWordsFailures(COUNTY_CLERKS_HINT)).toEqual([])
  })
})
