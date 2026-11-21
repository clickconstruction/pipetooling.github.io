import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { PLACE_DOT_WEAK_NOTE_WORDS, placeDotNoFixWords, placeDotRoughNoteWords, readingMovesDot } from './paintedPlaceDot'
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

describe('what the place panel says when the press got no reading at all', () => {
  const WHYS = ['none', 'refused', 'failed'] as const

  it('a phone that did not answer in time: the reason, and the press to make again by its own name', () => {
    expect(placeDotNoFixWords('failed')).toBe('Your phone did not find you in time. The dot was not moved. Drag it onto the spot, or press Put the dot where I am again.')
  })

  it('a phone that said no: location is off, and where to allow it', () => {
    expect(placeDotNoFixWords('refused')).toBe('Location is off for this app. The dot was not moved. Drag it onto the spot, or allow location in the phone’s settings and press again.')
  })

  it('a device with no location to give is offered the drag alone, since no press will read it', () => {
    expect(placeDotNoFixWords('none')).toBe('This device gives no location. The dot was not moved. Drag it onto the spot by hand.')
    expect(placeDotNoFixWords('none')).not.toMatch(/press/)
  })

  it('says each time that the dot was not moved, and sends nobody to drag the map, which places nothing here', () => {
    for (const why of WHYS) {
      expect(placeDotNoFixWords(why), why).toContain('The dot was not moved.')
      expect(placeDotNoFixWords(why), why).not.toMatch(/the map/)
    }
  })

  it('gives each reason its own sentence', () => {
    expect(new Set(WHYS.map(placeDotNoFixWords)).size).toBe(3)
  })

  it('is plain', () => {
    for (const why of WHYS) expect(plainWordsFailures(placeDotNoFixWords(why)), why).toEqual([])
  })
})
