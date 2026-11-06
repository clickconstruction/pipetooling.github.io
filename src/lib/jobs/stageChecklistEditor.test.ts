import { describe, expect, it } from 'vitest'
import type { StageChecklistQuestion } from './stageChecklist'
import { MIRROR_INTRO, companyQuestionsOf, emptyKindWords, kindSummary, questionTags, sourceLineWords, takenOffLineWords, takenOffSummary } from './stageChecklistEditor'

// Made-up questions for a made-up company. The owner writes the real ones.
const LIVE: StageChecklistQuestion[] = [
  { id: 'q2', kind: 'rough_in', order: 2, words: 'Are the stub-outs marked?', asksPhoto: false },
  { id: 'q1', kind: 'rough_in', order: 1, words: 'Did the water test hold?', asksPhoto: true, needsSignature: true },
  { id: 't1', kind: 'trim_set', order: 1, words: 'Do all the fixtures run?', asksPhoto: false },
  { id: 'j1', kind: 'rough_in', order: 0, words: 'Are the carriers in units 7 and 8 set?', asksPhoto: false, fixtureId: 'f1', addedById: 'u-pat', addedBy: 'Pat Sample', addedAt: '2026-11-01T15:00:00.000Z' },
]

describe('the mirror (#237 PR 4)', () => {
  it('lists one kind’s company questions in order, never a job item, and sums their asks', () => {
    expect(companyQuestionsOf(LIVE, 'rough_in').map((q) => q.id)).toEqual(['q1', 'q2'])
    expect(companyQuestionsOf(LIVE, 'top_out')).toEqual([])
    expect(kindSummary(companyQuestionsOf(LIVE, 'rough_in'))).toBe('2 questions, 1 with a photo, 1 with a signature')
    expect(kindSummary(companyQuestionsOf(LIVE, 'trim_set'))).toBe('1 question')
    expect(kindSummary([])).toBe('')
    expect(questionTags(LIVE[1]!)).toEqual(['asks for a photo', 'needs a signature'])
    expect(questionTags(LIVE[2]!)).toEqual([])
  })
  it('says which job a question came from, else who wrote it, else the old editor', () => {
    expect(sourceLineWords({ jobLabel: 'Job 1042 · Riders Walk', by: 'Pat Sample', at: '2026-11-03T16:14:00.000Z' })).toBe('From Job 1042 · Riders Walk, where Pat Sample added it · Nov 3 · 10:14 am')
    expect(sourceLineWords({ jobLabel: 'Job 1042', by: '', at: null })).toBe('From Job 1042, where someone added it')
    expect(sourceLineWords({ jobLabel: null, by: 'Jo Sample', at: '2026-11-03T16:14:00.000Z' })).toBe('Written by Jo Sample · Nov 3 · 10:14 am')
    expect(sourceLineWords({ jobLabel: null, by: '', at: '2026-11-03T16:14:00.000Z' })).toBe('Written on Settings · Nov 3 · 10:14 am')
    expect(sourceLineWords(null)).toBe('Written on Settings')
  })
  it('reads a taken-off question with who, when and why, and folds them under a count', () => {
    expect(takenOffLineWords({ words: 'Did the test hold?', by: 'Pat Sample', at: '2026-11-05T17:20:00.000Z', why: ' the inspector no longer asks ' })).toBe('Did the test hold? · Taken off by Pat Sample · Nov 5 · 11:20 am · “the inspector no longer asks”')
    expect(takenOffSummary(2)).toBe('Taken off · 2')
    expect(takenOffSummary(0)).toBe('')
  })
  it('names the empty kind and the door', () => {
    expect(emptyKindWords('top_out')).toBe('No questions for Top Out yet.')
    expect(MIRROR_INTRO).toContain('Documents tab')
  })
})
