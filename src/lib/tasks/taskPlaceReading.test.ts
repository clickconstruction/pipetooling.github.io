import { describe, expect, it } from 'vitest'
import { PHONE_KINDS } from '../paintedMap/preciseLocation'
import { plainWordsFailures } from '../plainWords'
import {
  ADD_HERE_ROUGH_NOTE_WORDS,
  ADD_HERE_WEAK_NOTE_WORDS,
  HOW_FAR_ROUGH_NOTE_WORDS,
  SITE_MAP_WIDE_WORDS,
  WHERE_I_AM_WEAK_NOTE_WORDS,
  WHERE_I_AM_WIDE_WORDS,
  siteMapRoughNoteWords,
  siteMapRoughWideNoteWords,
  whereIAmRoughNoteWords,
  whereIAmRoughWideNoteWords,
} from './taskPlaceReading'

describe('what a screen says after the Precise Location line, on one reading', () => {
  it('asks for a drag when Use where I am got a weak signal: the map moved, and is about right', () => {
    expect(WHERE_I_AM_WEAK_NOTE_WORDS).toBe('Drag the map until the ring is on the spot.')
  })

  it('says the map was not moved on a rough reading, and both ways on from there', () => {
    for (const kind of PHONE_KINDS.filter((k) => k !== 'other')) {
      expect(whereIAmRoughNoteWords(kind)).toBe('The map was not moved. Drag it until the ring is on the spot, or turn the switch on and press again.')
    }
  })

  it('names no switch on a desk, which has none', () => {
    expect(whereIAmRoughNoteWords('other')).toBe('The map was not moved. Drag it until the ring is on the spot.')
  })

  it('never says the map was not moved when it has just opened wide, and still gives both ways on', () => {
    expect(WHERE_I_AM_WIDE_WORDS).toBe('The map opened wide. Zoom in and drag it until the ring is on the spot.')
    for (const kind of PHONE_KINDS) expect(whereIAmRoughWideNoteWords(kind)).not.toMatch(/not moved/)
    for (const kind of PHONE_KINDS.filter((k) => k !== 'other')) {
      expect(whereIAmRoughWideNoteWords(kind)).toBe('The map opened wide. Zoom in and drag it until the ring is on the spot, or turn the switch on and press again.')
    }
    expect(whereIAmRoughWideNoteWords('other')).toBe(WHERE_I_AM_WIDE_WORDS)
  })

  it('names no ring on the Site map, which has none', () => {
    expect(siteMapRoughNoteWords('iphone-safari')).toBe('The map was not moved. Turn the switch on and press again.')
    expect(siteMapRoughNoteWords('other')).toBe('The map was not moved.')
    expect(SITE_MAP_WIDE_WORDS).toBe('The map opened wide. Zoom in and drag it to the site.')
    expect(siteMapRoughWideNoteWords('android')).toBe('The map opened wide. Zoom in and drag it to the site, or turn the switch on and press again.')
    expect(siteMapRoughWideNoteWords('other')).toBe(SITE_MAP_WIDE_WORDS)
    for (const kind of PHONE_KINDS) for (const words of [siteMapRoughNoteWords(kind), siteMapRoughWideNoteWords(kind)]) expect(words).not.toMatch(/ring/)
  })

  it('sends a weak reading to the open sky, and a rough one to the switch, when a place is added from where a person stands', () => {
    expect(ADD_HERE_WEAK_NOTE_WORDS).toBe('Try again in the open.')
    expect(ADD_HERE_ROUGH_NOTE_WORDS).toBe('A place cannot be added from a reading that wide.')
    expect(ADD_HERE_ROUGH_NOTE_WORDS).not.toMatch(/open/)
  })

  it('says no distance from the middle of an area', () => {
    expect(HOW_FAR_ROUGH_NOTE_WORDS).toBe('How far cannot be told from a reading that wide.')
  })

  it('is plain', () => {
    for (const words of [WHERE_I_AM_WEAK_NOTE_WORDS, ADD_HERE_WEAK_NOTE_WORDS, ADD_HERE_ROUGH_NOTE_WORDS, HOW_FAR_ROUGH_NOTE_WORDS, ...PHONE_KINDS.flatMap((kind) => [whereIAmRoughNoteWords(kind), whereIAmRoughWideNoteWords(kind), siteMapRoughNoteWords(kind), siteMapRoughWideNoteWords(kind)]), WHERE_I_AM_WIDE_WORDS, SITE_MAP_WIDE_WORDS]) expect(plainWordsFailures(words), words).toEqual([])
  })
})
