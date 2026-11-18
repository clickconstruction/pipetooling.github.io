import { describe, expect, it } from 'vitest'
import { WALK_REVIEW_PLACE_WORDS, keptWalkWords, walkNothingLeftWords, walkPausedWords, walkPoorWords, walkRefusalWords, walkSureWords, walkThrowAwayWords } from './paintedWalkWords'

describe('the words of a walk', () => {
  it('says how sure the phone is, rounded up', () => {
    expect(walkSureWords(3.5)).toBe('Sure within 15 ft')
    expect(walkSureWords(null)).toBe('Finding you…')
    expect(walkPoorWords(18.2)).toBe('Only sure within 60 ft here. This part is drawn faint.')
    expect(walkPoorWords(null)).toBe('The phone is not sure here. This part is drawn faint.')
  })
  it('says why a locked screen left a gap, and for how long', () => {
    expect(walkPausedWords({ pausedWhy: 'hidden', gapMs: 120_000 }).lead).toBe('The screen was off for 2 minutes, so the line has a gap.')
    expect(walkPausedWords({ pausedWhy: 'hidden', gapMs: null }).lead).toBe('The screen was off for a moment, so the line has a gap.')
    expect(walkPausedWords({ pausedWhy: 'hidden', gapMs: 400 }).lead).toBe('The screen was off for a moment, so the line has a gap.')
  })
  it('says why painting stopped by itself', () => {
    expect(walkPausedWords({ pausedWhy: 'standing', gapMs: null }).lead).toContain('stood still for 5 minutes')
    expect(walkPausedWords({ pausedWhy: 'time', gapMs: null }).lead).toContain('after an hour')
    expect(walkPausedWords({ pausedWhy: 'press', gapMs: null })).toEqual({ lead: 'Paused.', tail: 'Nothing is being read.' })
  })
  it('never dead-ends a refusal: drawing by hand is always offered', () => {
    for (const why of ['none', 'refused', 'failed'] as const) expect(walkRefusalWords(why)).toContain('draw the line by hand')
  })
  it('says a thrown-away walk leaves nothing only when nothing was saved (#393)', () => {
    expect(walkThrowAwayWords(false)).toBe('What you painted goes from this phone. Nothing was sent anywhere, so nothing is left behind.')
    // A place set on the walk saved the map: the walk goes, and the map keeps what it has.
    expect(walkThrowAwayWords(true)).toBe('The lines you painted go from this phone. What is already saved on the map stays.')
    expect(walkThrowAwayWords(true)).not.toContain('nothing is left behind')
    expect(WALK_REVIEW_PLACE_WORDS).toContain('A place is saved when you add it')
  })
  it('says nothing has left the phone only while that is so (#393)', () => {
    expect(walkNothingLeftWords(false)).toBe('Nothing has left this phone yet. Saving keeps the line. It keeps no clock along it, so it cannot say how fast you went or where you stopped.')
    // The map is saved, by a place or from before: only the walk is still on the phone.
    expect(walkNothingLeftWords(true)).toBe('What you painted has not left this phone yet. Saving keeps the line. It keeps no clock along it, so it cannot say how fast you went or where you stopped.')
  })
  it('names a kept walk by its time', () => {
    expect(keptWalkWords('2:14 PM')).toBe('A walk from 2:14 PM is still on this phone. It was not saved.')
  })
})
