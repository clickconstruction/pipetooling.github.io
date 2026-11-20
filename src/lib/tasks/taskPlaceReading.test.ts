import { describe, expect, it } from 'vitest'
import { PHONE_KINDS } from '../paintedMap/preciseLocation'
import { plainWordsFailures } from '../plainWords'
import { ADD_HERE_ROUGH_NOTE_WORDS, ADD_HERE_WEAK_NOTE_WORDS, HOW_FAR_ROUGH_NOTE_WORDS, WHERE_I_AM_WEAK_NOTE_WORDS, whereIAmRoughNoteWords } from './taskPlaceReading'

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

  it('sends a weak reading to the open sky, and a rough one to the switch, when a place is added from where a person stands', () => {
    expect(ADD_HERE_WEAK_NOTE_WORDS).toBe('Try again in the open.')
    expect(ADD_HERE_ROUGH_NOTE_WORDS).toBe('A place cannot be added from a reading that wide.')
    expect(ADD_HERE_ROUGH_NOTE_WORDS).not.toMatch(/open/)
  })

  it('says no distance from the middle of an area', () => {
    expect(HOW_FAR_ROUGH_NOTE_WORDS).toBe('How far cannot be told from a reading that wide.')
  })

  it('is plain', () => {
    for (const words of [WHERE_I_AM_WEAK_NOTE_WORDS, ADD_HERE_WEAK_NOTE_WORDS, ADD_HERE_ROUGH_NOTE_WORDS, HOW_FAR_ROUGH_NOTE_WORDS, ...PHONE_KINDS.map(whereIAmRoughNoteWords)]) expect(plainWordsFailures(words), words).toEqual([])
  })
})
