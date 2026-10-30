import { describe, expect, it } from 'vitest'
import {
  answeredWords,
  checklistPhotoName,
  jobHasChecklists,
  jobStageChecklists,
  noQuestionsWords,
  questionAnswered,
  questionWaitsOn,
  savedWords,
  sheetFootWords,
  stageChecklistKindOf,
  stageChecklistLine,
  stageChecklistState,
  standingWords,
  templateFor,
  waitsOnWords,
  type StageChecklistAnswer,
  type StageChecklistQuestion,
} from './stageChecklist'

// Made-up questions for a made-up company. The owner writes the real ones.
const Q: StageChecklistQuestion[] = [
  { id: 'q3', kind: 'rough_in', order: 3, words: 'Is the cleanout capped?', asksPhoto: false },
  { id: 'q1', kind: 'rough_in', order: 1, words: 'Did the water test hold?', asksPhoto: true },
  { id: 'q2', kind: 'rough_in', order: 2, words: 'Are the stub-outs marked?', asksPhoto: false },
  { id: 't1', kind: 'trim_set', order: 1, words: 'Do all the fixtures run?', asksPhoto: false },
]

const photo = { fileName: '2026-10-29 Rough In · Did the water test hold.jpg', takenAt: '2026-10-29T15:00:00.000Z', state: 'waiting' as const, driveFileId: null, failWhy: null }
const a = (questionId: string, pick: StageChecklistAnswer['pick'], over: Partial<StageChecklistAnswer> = {}): StageChecklistAnswer => ({ questionId, pick, note: '', photo: null, ...over })

describe('stageChecklistKindOf: the kind from the stage’s name, by the Pipeline’s stage words', () => {
  it('reads Rough In, Top Out and Trim Set with their spellings', () => {
    expect(stageChecklistKindOf('Rough In')).toBe('rough_in')
    expect(stageChecklistKindOf('Stage 1 — Rough-in plumbing')).toBe('rough_in')
    expect(stageChecklistKindOf('Top Out')).toBe('top_out')
    expect(stageChecklistKindOf('Stack out')).toBe('top_out')
    expect(stageChecklistKindOf('Trim Set')).toBe('trim_set')
    expect(stageChecklistKindOf('Finish')).toBe('trim_set')
  })
  it('gives no checklist to ground, final, permit or a service line', () => {
    expect(stageChecklistKindOf('Underground')).toBeNull()
    expect(stageChecklistKindOf('Final')).toBeNull()
    expect(stageChecklistKindOf('Permit')).toBeNull()
    expect(stageChecklistKindOf('Water heater')).toBeNull()
    expect(stageChecklistKindOf(null)).toBeNull()
  })
})

describe('templateFor: one kind’s questions in the office’s order', () => {
  it('orders by place, not by the rows’ order', () => {
    expect(templateFor(Q, 'rough_in').map((q) => q.id)).toEqual(['q1', 'q2', 'q3'])
    expect(templateFor(Q, 'top_out')).toEqual([])
  })
})

describe('questionWaitsOn: a pick, and the photo a question asks for', () => {
  it('waits on the pick first', () => {
    expect(questionWaitsOn(Q[1]!, null)).toBe('pick')
    expect(questionWaitsOn(Q[1]!, a('q1', null, { note: 'held 20 min' }))).toBe('pick')
  })
  it('waits on the photo after Yes or No, and not after Not here', () => {
    expect(questionWaitsOn(Q[1]!, a('q1', 'yes'))).toBe('photo')
    expect(questionWaitsOn(Q[1]!, a('q1', 'no'))).toBe('photo')
    expect(questionWaitsOn(Q[1]!, a('q1', 'not_here'))).toBeNull()
    expect(questionWaitsOn(Q[1]!, a('q1', 'yes', { photo }))).toBeNull()
  })
  it('counts a photo from the moment it is taken, before the sweep files it', () => {
    expect(questionAnswered(Q[1]!, a('q1', 'yes', { photo: { ...photo, state: 'failed', failWhy: 'That job has no Drive folder yet.' } }))).toBe(true)
  })
  it('never asks a photo of a question that does not ask for one', () => {
    expect(questionAnswered(Q[2]!, a('q2', 'no'))).toBe(true)
  })
})

describe('stageChecklistState: the strict rule', () => {
  it('reads not ready until every question is answered', () => {
    const two = stageChecklistState({ stageName: 'Rough In', questions: Q, answers: [a('q1', 'yes', { photo }), a('q2', 'yes')] })
    expect(two).toEqual({ kind: 'rough_in', asked: 3, answered: 2, standing: 'not_ready', ready: false })
    const all = stageChecklistState({ stageName: 'Rough In', questions: Q, answers: [a('q1', 'yes', { photo }), a('q2', 'yes'), a('q3', 'not_here')] })
    expect(all).toEqual({ kind: 'rough_in', asked: 3, answered: 3, standing: 'ready', ready: true })
  })
  it('counts a pick without its photo as not answered', () => {
    const s = stageChecklistState({ stageName: 'Rough In', questions: Q, answers: [a('q1', 'yes'), a('q2', 'yes'), a('q3', 'yes')] })
    expect(s.answered).toBe(2)
    expect(s.ready).toBe(false)
  })
  it('reads as today for a kind with no questions written, and for a stage with no kind', () => {
    expect(stageChecklistState({ stageName: 'Top Out', questions: Q, answers: [] })).toEqual({ kind: 'top_out', asked: 0, answered: 0, standing: 'none', ready: true })
    expect(stageChecklistState({ stageName: 'Permit', questions: Q, answers: [] })).toEqual({ kind: null, asked: 0, answered: 0, standing: 'none', ready: true })
  })
  it('ignores an answer to a question that is no longer in the template', () => {
    const s = stageChecklistState({ stageName: 'Trim Set', questions: Q, answers: new Map([['gone', a('gone', 'yes')]]) })
    expect(s).toEqual({ kind: 'trim_set', asked: 1, answered: 0, standing: 'not_ready', ready: false })
  })
})

describe('jobStageChecklists: a job’s stages in order with their standing', () => {
  const stages = [
    { fixtureId: 'f2', name: 'Top Out', sequenceOrder: 2 },
    { fixtureId: 'f1', name: 'Rough In', sequenceOrder: 1 },
    { fixtureId: 'f3', name: 'Trim Set', sequenceOrder: 3 },
  ]
  it('orders the stages and reads each against its own answers', () => {
    const rows = jobStageChecklists(stages, Q, new Map([['f1', [a('q1', 'yes', { photo }), a('q2', 'no'), a('q3', 'yes')]]]))
    expect(rows.map((r) => [r.name, r.state.standing])).toEqual([
      ['Rough In', 'ready'],
      ['Top Out', 'none'],
      ['Trim Set', 'not_ready'],
    ])
    expect(jobHasChecklists(rows)).toBe(true)
  })
  it('has nothing to show on a job whose kinds have no questions', () => {
    const rows = jobStageChecklists([stages[0]!], Q, new Map())
    expect(jobHasChecklists(rows)).toBe(false)
  })
})

describe('the words a first-timer reads', () => {
  const notReady = stageChecklistState({ stageName: 'Rough In', questions: Q, answers: [a('q1', 'yes', { photo }), a('q2', 'yes')] })
  const ready = stageChecklistState({ stageName: 'Rough In', questions: Q, answers: [a('q1', 'yes', { photo }), a('q2', 'yes'), a('q3', 'no')] })
  const none = stageChecklistState({ stageName: 'Top Out', questions: Q, answers: [] })
  it('chips, counts and lines', () => {
    expect(standingWords(notReady)).toBe('not ready')
    expect(standingWords(ready)).toBe('ready')
    expect(standingWords(none)).toBe('')
    expect(answeredWords(notReady)).toBe('2 of 3 answered')
    expect(answeredWords(none)).toBe('')
    expect(stageChecklistLine(notReady)).toBe('2 of 3 answered, not ready')
    expect(stageChecklistLine(ready)).toBe('Checklist filled')
    expect(stageChecklistLine(none)).toBe('')
  })
  it('the sheet’s foot, the empty kind and the waits', () => {
    expect(sheetFootWords('Rough In', notReady)).toBe('Rough In reads not ready on the Pipeline until every question is answered.')
    expect(sheetFootWords('Rough In', ready)).toBe('Rough In reads ready on the Pipeline.')
    expect(noQuestionsWords('Top Out')).toBe('No questions for Top Out yet. The office writes them on Settings, under Jobs and billing.')
    expect(noQuestionsWords('Permit')).toBe('Permit has no checklist. Checklists are for Rough In, Top Out and Trim Set.')
    expect(waitsOnWords('pick')).toBe('Pick Yes, No or Not here.')
    expect(waitsOnWords('photo')).toBe('Take the photo this one asks for.')
    expect(waitsOnWords(null)).toBe('')
  })
  it('the toast', () => {
    expect(savedWords('Rough In', ready)).toBe("Rough In's checklist is filled. It reads ready on the Pipeline.")
    expect(savedWords('Rough In', notReady)).toBe('Saved. 2 of 3 answered on Rough In.')
  })
})

describe('checklistPhotoName: the company’s day, the stage and the question', () => {
  it('names the photo and drops the question mark', () => {
    expect(checklistPhotoName({ takenAt: '2026-10-29T15:00:00.000Z', stageName: 'Rough In', question: 'Did the water test hold?' })).toBe('2026-10-29 Rough In · Did the water test hold.jpg')
  })
  it('dates by Chicago’s day, cuts a long question on a word and keeps the name safe', () => {
    const name = checklistPhotoName({
      takenAt: '2026-10-30T04:30:00.000Z',
      stageName: 'Stage 2: Top Out',
      question: 'Is every vent through the roof flashed, and does the gas line hold 15 psi for thirty minutes with no drop?',
      ext: '.PNG',
    })
    expect(name.startsWith('2026-10-29 Stage 2 Top Out · Is every vent through the roof flashed and does the')).toBe(true)
    expect(name.endsWith('.png')).toBe(true)
    expect(name).not.toMatch(/[:?,]/)
  })
})
