/** The owner's scale for the trades (spike, 2026-10-23), over made-up ratings. */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { bestTrade, EMPTY_QUALIFICATIONS, LEVEL_WORDS, LEVELS, levelLine, qualificationsComplete, qualificationsFrom, qualificationsMissing, qualificationsRecord, qualificationsRows, qualificationsStepWords, qualificationsWords, TRADE_WORDS, TRADES, type Qualifications } from './tradeScale'

const sam: Qualifications = { levels: { plumbing: 3, electrical: 1, hvac: 0 }, license: { has: true, words: 'Journeyman plumber, TX M-12345' }, location: 'Round Rock' }

describe('the scale', () => {
  it('is four levels, zero for no experience, in the owner’s words, and three trades', () => {
    expect(LEVELS).toEqual([0, 1, 2, 3])
    expect(LEVEL_WORDS[0]).toBe('Never done it.')
    expect(LEVEL_WORDS[3]).toBe('Says they can run a job alone. Has tools.')
    expect(TRADES.map((t) => TRADE_WORDS[t])).toEqual(['Plumbing', 'Electrical', 'HVAC'])
  })

  it('keeps every word a first-timer reads in plain words', () => {
    const words = [...Object.values(LEVEL_WORDS), ...TRADES.flatMap((t) => LEVELS.map((l) => levelLine(t, l))), ...qualificationsMissing(EMPTY_QUALIFICATIONS)]
    expect(words.flatMap((w) => plainWordsFailures(w))).toEqual([])
  })
})

describe('rated: the three things we need', () => {
  it('needs a level on each trade, the license or none, and where they are, in that order', () => {
    expect(qualificationsMissing(EMPTY_QUALIFICATIONS)).toEqual(['Plumbing on the scale', 'Electrical on the scale', 'HVAC on the scale', 'their license, or that they hold none', 'where they drive in from'])
    expect(qualificationsComplete(EMPTY_QUALIFICATIONS)).toBe(false)
    expect(qualificationsMissing(sam)).toEqual([])
    expect(qualificationsComplete(sam)).toBe(true)
  })

  it('counts a zero as known and no license as an answer', () => {
    const none: Qualifications = { levels: { plumbing: 0, electrical: 0, hvac: 0 }, license: { has: false }, location: '78664' }
    expect(qualificationsComplete(none)).toBe(true)
    expect(qualificationsMissing({ ...none, levels: { plumbing: 0, electrical: 0 } })).toEqual(['HVAC on the scale'])
    expect(qualificationsMissing({ ...none, location: '  ' })).toEqual(['where they drive in from'])
  })
})

describe('the words on a card', () => {
  it('lines the trades up, then the license, then their home', () => {
    expect(qualificationsWords(sam)).toBe('Plumbing 3 · Electrical 1 · HVAC 0 · Journeyman plumber, TX M-12345 · Home: Round Rock')
    expect(qualificationsWords({ ...sam, license: { has: false } })).toBe('Plumbing 3 · Electrical 1 · HVAC 0 · no license · Home: Round Rock')
    expect(qualificationsWords({ ...sam, license: { has: true, words: ' ' } })).toContain('licensed')
    expect(qualificationsWords(EMPTY_QUALIFICATIONS)).toBe('')
    // Inside the Rated step's box, the trades as the owner abbreviates them.
    expect(qualificationsStepWords(sam)).toBe('PLUM 3 · ELEC 1 · HVAC 0 · Journeyman plumber, TX M-12345 · Home: Round Rock')
  })

  it('names the trade they do best, the first trade on a tie', () => {
    expect(bestTrade(sam)).toEqual({ trade: 'plumbing', level: 3 })
    expect(bestTrade({ ...EMPTY_QUALIFICATIONS, levels: { electrical: 2, hvac: 2 } })).toEqual({ trade: 'electrical', level: 2 })
    expect(bestTrade(EMPTY_QUALIFICATIONS)).toBeNull()
    expect(levelLine('hvac', 2)).toBe('HVAC: 2. Says they can run a job alone. No tools.')
  })
})

describe('the rows, as trade_levels and the record keep them', () => {
  const record = { location: 'Round Rock', location_lat: 30.5083, location_lng: -97.6789, license: 'Journeyman plumber, TX M-12345', license_asked: true }

  it('reads the rows back into qualifications, leaving out a trade or a level it does not know', () => {
    const q = qualificationsFrom(
      [
        { trade: 'plumbing', level: 3 },
        { trade: 'electrical', level: 1 },
        { trade: 'roofing', level: 2 },
        { trade: 'hvac', level: 7 },
      ],
      record,
    )
    expect(q).toEqual({ levels: { plumbing: 3, electrical: 1 }, license: { has: true, words: 'Journeyman plumber, TX M-12345' }, location: 'Round Rock', homePin: { lat: 30.5083, lng: -97.6789 } })
    expect(qualificationsFrom([], { ...record, license: '', location: null, location_lat: null, location_lng: null })).toEqual({ levels: {}, license: { has: false }, location: '', homePin: null })
    // Nothing noted yet reads as nothing, not as an empty set.
    expect(qualificationsFrom([], { location: null, location_lat: null, location_lng: null, license: null, license_asked: false })).toBeNull()
    expect(qualificationsFrom([], null)).toBeNull()
  })

  it('writes one row a trade with a level, and the home, its pin and the license on the record', () => {
    expect(qualificationsRows(sam)).toEqual([
      { trade: 'plumbing', level: 3 },
      { trade: 'electrical', level: 1 },
      { trade: 'hvac', level: 0 },
    ])
    expect(qualificationsRows({ ...EMPTY_QUALIFICATIONS, levels: { hvac: 2 } })).toEqual([{ trade: 'hvac', level: 2 }])
    expect(qualificationsRecord({ ...sam, homePin: { lat: 30.5083, lng: -97.6789 } })).toEqual(record)
    expect(qualificationsRecord({ ...sam, license: { has: false }, homePin: null })).toEqual({ location: 'Round Rock', location_lat: null, location_lng: null, license: '', license_asked: true })
    expect(qualificationsRecord({ ...sam, license: null, location: ' ' })).toMatchObject({ location: null, license: null, license_asked: false })
    // Round trip.
    const back = qualificationsFrom(qualificationsRows(sam), qualificationsRecord({ ...sam, homePin: { lat: 1, lng: 2 } }))
    expect(back).toEqual({ ...sam, homePin: { lat: 1, lng: 2 } })
  })
})
