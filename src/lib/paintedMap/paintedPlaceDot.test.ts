import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { PLACE_DOT_WEAK_NOTE_WORDS, placeDotRoughNoteWords, readingMovesDot } from './paintedPlaceDot'
import { PHONE_KINDS } from './preciseLocation'

describe('what one reading does to a place’s dot', () => {
  it('moves the dot on a sure reading and on a weak one', () => {
    for (const m of [0, 4.5, 20, 35, 300, 1000]) expect(readingMovesDot(m), `${m}`).toBe(true)
  })

  it('leaves the dot where it is on a rough reading, whose middle can be miles from the job', () => {
    for (const m of [1000.01, 1414, 3200, 20_000]) expect(readingMovesDot(m), `${m}`).toBe(false)
  })

  it('moves the dot on a reading that gave no margin, as it always did', () => {
    for (const none of [null, undefined, Number.NaN]) expect(readingMovesDot(none)).toBe(true)
  })
})

describe('what the place panel says after the Precise Location line', () => {
  it('asks for a drag when the signal is weak', () => {
    expect(PLACE_DOT_WEAK_NOTE_WORDS).toBe('Drag the dot onto the spot.')
  })

  it('says the dot was not moved on a rough reading, and both ways on from there', () => {
    for (const kind of PHONE_KINDS.filter((k) => k !== 'other')) {
      expect(placeDotRoughNoteWords(kind)).toBe('The dot was not moved. Drag it onto the spot by hand, or turn the switch on and press again.')
    }
  })

  it('names no switch on a desk, which has none', () => {
    expect(placeDotRoughNoteWords('other')).toBe('The dot was not moved. Drag it onto the spot by hand.')
  })

  it('is plain', () => {
    for (const words of [PLACE_DOT_WEAK_NOTE_WORDS, ...PHONE_KINDS.map(placeDotRoughNoteWords)]) expect(plainWordsFailures(words), words).toEqual([])
  })
})
