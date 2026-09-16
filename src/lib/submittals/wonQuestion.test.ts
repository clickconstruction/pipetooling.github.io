import { describe, expect, it } from 'vitest'
import { wonQuestionState, wonQuestionSubline } from './wonQuestion'

describe('wonQuestionState', () => {
  const base = { bidId: 'b1', revisionCount: 0, pickedCount: 3, specifiedCount: 4, notNeededAt: null }
  it('asks when the bid has picks and no revision', () => {
    expect(wonQuestionState(base)).toBe('ask')
    expect(wonQuestionState({ ...base, pickedCount: 0 })).toBe('ask')
    expect(wonQuestionState({ ...base, specifiedCount: 0 })).toBe('ask')
  })
  it('a revision, an earlier "not needed", no bid, or nothing to build from — no question', () => {
    expect(wonQuestionState({ ...base, revisionCount: 2 })).toBe('has-revision')
    expect(wonQuestionState({ ...base, notNeededAt: '2026-09-16T00:00:00Z' })).toBe('not-needed')
    expect(wonQuestionState({ ...base, notNeededAt: '2026-09-16T00:00:00Z', revisionCount: 1 })).toBe('not-needed')
    expect(wonQuestionState({ ...base, bidId: null })).toBe('nothing')
    expect(wonQuestionState({ ...base, pickedCount: 0, specifiedCount: 0 })).toBe('nothing')
  })
})

describe('wonQuestionSubline', () => {
  it('names the schedule and the picks, and says what is missing', () => {
    expect(wonQuestionSubline({ pickedCount: 3, specifiedCount: 4 })).toBe('4 tags on the schedule · 3 picked lines')
    expect(wonQuestionSubline({ pickedCount: 1, specifiedCount: 0 })).toBe('1 picked line · no schedule yet — accessory rows only')
    expect(wonQuestionSubline({ pickedCount: 0, specifiedCount: 1 })).toBe('1 tag on the schedule · nothing picked yet — every tag reads missing')
  })
})
