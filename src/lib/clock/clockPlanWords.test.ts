import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { CLOCK_IN_PLAN_EMPTY_LINE, CLOCK_OUT_NOTE_EMPTY_LINE, clockNoteEmpty } from './clockPlanWords'

describe('the clock’s empty-box lines (punch list #446, v2.8624)', () => {
  it('name the press that comes alive, in plain words', () => {
    expect(CLOCK_IN_PLAN_EMPTY_LINE).toBe('Say what you mean to get done today, then Complete Clock In.')
    expect(CLOCK_OUT_NOTE_EMPTY_LINE).toBe('Say what you worked on today, then Complete clock out.')
    expect(plainWordsFailures(CLOCK_IN_PLAN_EMPTY_LINE)).toEqual([])
    expect(plainWordsFailures(CLOCK_OUT_NOTE_EMPTY_LINE)).toEqual([])
  })
  it('a box of spaces is empty; one word is not', () => {
    expect(clockNoteEmpty('')).toBe(true)
    expect(clockNoteEmpty('   \n')).toBe(true)
    expect(clockNoteEmpty(' Rough-in ')).toBe(false)
  })
})
