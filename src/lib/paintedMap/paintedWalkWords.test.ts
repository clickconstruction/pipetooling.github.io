import { describe, expect, it } from 'vitest'
import { keptWalkWords, walkPausedWords, walkPoorWords, walkRefusalWords, walkSureWords } from './paintedWalkWords'

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
  it('names a kept walk by its time', () => {
    expect(keptWalkWords('2:14 PM')).toBe('A walk from 2:14 PM is still on this phone. It was not saved.')
  })
})
