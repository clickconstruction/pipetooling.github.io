import { describe, expect, it } from 'vitest'
import type { StageChecklistQuestion } from './stageChecklist'
import { cleanDrafts, draftsOf, editorProblem, kindSummary, moveDraft, planIsEmpty, planQuestionSave, sameDrafts } from './stageChecklistEditor'

// Made-up questions for a made-up company. The owner writes the real ones.
const LIVE: StageChecklistQuestion[] = [
  { id: 'q1', kind: 'rough_in', order: 1, words: 'Did the water test hold?', asksPhoto: true },
  { id: 'q2', kind: 'rough_in', order: 2, words: 'Are the stub-outs marked?', asksPhoto: false },
  { id: 't1', kind: 'trim_set', order: 1, words: 'Do all the fixtures run?', asksPhoto: false },
]

describe('draftsOf and the drafts’ housekeeping', () => {
  it('gives one kind’s rows in order, and none for a kind with no questions', () => {
    expect(draftsOf(LIVE, 'rough_in')).toEqual([
      { id: 'q1', words: 'Did the water test hold?', asksPhoto: true, needsSignature: false },
      { id: 'q2', words: 'Are the stub-outs marked?', asksPhoto: false, needsSignature: false },
    ])
    expect(draftsOf(LIVE, 'top_out')).toEqual([])
  })
  it('trims and compares', () => {
    const a = cleanDrafts([{ id: null, words: '  Is the  cleanout capped? ', asksPhoto: false, needsSignature: false }])
    expect(a[0]!.words).toBe('Is the cleanout capped?')
    expect(sameDrafts(a, [{ id: null, words: 'Is the cleanout capped?', asksPhoto: false, needsSignature: false }])).toBe(true)
    expect(sameDrafts(a, [{ id: null, words: 'Is the cleanout capped?', asksPhoto: true, needsSignature: false }])).toBe(false)
  })
  it('moves a draft a place, and not past the ends', () => {
    const d = draftsOf(LIVE, 'rough_in')
    expect(moveDraft(d, 1, -1).map((x) => x.id)).toEqual(['q2', 'q1'])
    expect(moveDraft(d, 0, -1).map((x) => x.id)).toEqual(['q1', 'q2'])
    expect(moveDraft(d, 1, 1).map((x) => x.id)).toEqual(['q1', 'q2'])
  })
})

describe('editorProblem: what stops a save', () => {
  it('names the empty question and the long one', () => {
    expect(editorProblem('rough_in', [{ id: null, words: 'Did it hold?', asksPhoto: false, needsSignature: false }, { id: null, words: '   ', asksPhoto: false, needsSignature: false }])).toBe('Question 2 for Rough In has no words. Type the question or take it off.')
    expect(editorProblem('top_out', [{ id: null, words: 'x'.repeat(201), asksPhoto: false, needsSignature: false }])).toBe('Question 1 for Top Out is over 200 characters. Shorten it.')
    expect(editorProblem('trim_set', [])).toBeNull()
  })
})

describe('planQuestionSave: the diff the io writes', () => {
  it('inserts the new, updates the changed and moved, retires the gone', () => {
    const plan = planQuestionSave('rough_in', LIVE, [
      { id: 'q2', words: 'Are the stub-outs marked?', asksPhoto: true, needsSignature: false },
      { id: null, words: 'Is the cleanout capped?', asksPhoto: false, needsSignature: false },
    ])
    expect(plan).toEqual({
      inserts: [{ kind: 'rough_in', order: 2, words: 'Is the cleanout capped?', asksPhoto: false, needsSignature: false }],
      updates: [{ id: 'q2', order: 1, words: 'Are the stub-outs marked?', asksPhoto: true, needsSignature: false }],
      retires: ['q1'],
    })
    expect(planIsEmpty(plan)).toBe(false)
  })
  it('writes nothing when nothing changed, and never touches another kind', () => {
    const plan = planQuestionSave('rough_in', LIVE, draftsOf(LIVE, 'rough_in'))
    expect(planIsEmpty(plan)).toBe(true)
    expect(plan.retires).toEqual([])
  })
  it('never lists or retires an item added for a job (punch list #237)', () => {
    const item: StageChecklistQuestion = { id: 'j1', kind: 'rough_in', order: 0, words: 'Are the carriers in units 7 and 8 set?', asksPhoto: false, fixtureId: 'f1', addedById: 'u-pat', addedBy: 'Pat Sample', addedAt: '2026-11-01T15:00:00.000Z' }
    const live = [...LIVE, item]
    expect(draftsOf(live, 'rough_in').map((d) => d.id)).toEqual(['q1', 'q2'])
    const plan = planQuestionSave('rough_in', live, draftsOf(live, 'rough_in'))
    expect(planIsEmpty(plan)).toBe(true)
  })
  it('treats a draft whose row is no longer live as new', () => {
    const plan = planQuestionSave('trim_set', LIVE, [{ id: 'gone', words: 'Is the water heater strapped?', asksPhoto: false, needsSignature: false }])
    expect(plan.inserts).toHaveLength(1)
    expect(plan.retires).toEqual(['t1'])
  })
})

describe('kindSummary', () => {
  it('counts the questions and the photos', () => {
    expect(kindSummary([])).toBe('')
    expect(kindSummary([{ id: null, words: 'a', asksPhoto: false, needsSignature: false }])).toBe('1 question')
    expect(kindSummary(draftsOf(LIVE, 'rough_in'))).toBe('2 questions, 1 with a photo')
  })
})

describe('needs a signature in the editor (#237 PR 2)', () => {
  it('reads the toggle off the live row, counts it, and writes it when it changes', () => {
    const live: StageChecklistQuestion[] = [{ id: 'q1', kind: 'rough_in', order: 1, words: 'Did the water test hold?', asksPhoto: false, needsSignature: true }]
    expect(draftsOf(live, 'rough_in')).toEqual([{ id: 'q1', words: 'Did the water test hold?', asksPhoto: false, needsSignature: true }])
    expect(kindSummary(draftsOf(live, 'rough_in'))).toBe('1 question, 1 with a signature')
    expect(kindSummary([{ id: null, words: 'a', asksPhoto: true, needsSignature: true }, { id: null, words: 'b', asksPhoto: false, needsSignature: false }])).toBe('2 questions, 1 with a photo, 1 with a signature')
    const plan = planQuestionSave('rough_in', live, [{ id: 'q1', words: 'Did the water test hold?', asksPhoto: false, needsSignature: false }])
    expect(plan.updates).toEqual([{ id: 'q1', order: 1, words: 'Did the water test hold?', asksPhoto: false, needsSignature: false }])
    expect(planIsEmpty(planQuestionSave('rough_in', live, draftsOf(live, 'rough_in')))).toBe(true)
  })
})
