import { describe, expect, it } from 'vitest'
import {
  addedByWords,
  answerStampWords,
  answeredWords,
  checklistPhotoName,
  checklistProgress,
  groupCountWords,
  isJobItem,
  jobHasChecklists,
  jobStageChecklists,
  noQuestionsWords,
  progressWords,
  questionAnswered,
  questionWaitsOn,
  savedWords,
  sheetFootWords,
  stageChecklistKindOf,
  stageChecklistLine,
  stageChecklistState,
  stampWords,
  standingWords,
  templateFor,
  templateGroups,
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
    expect(noQuestionsWords('Top Out')).toBe('No questions for Top Out yet. The office writes them on Settings, under Jobs, bills and liens.')
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

// ── Items on the job (punch list #237, PR 1) ───────────────────────────────────

describe('templateFor with a stage: the company’s questions, then the items added for that stage', () => {
  const item = (id: string, fixtureId: string, addedAt: string, words = 'Are the carriers in units 7 and 8 set?'): StageChecklistQuestion => ({ id, kind: 'rough_in', order: 0, words, asksPhoto: false, fixtureId, addedById: 'u-pat', addedBy: 'Pat Sample', addedAt })
  const withItems = [...Q, item('j2', 'f1', '2026-11-01T15:10:00.000Z', 'Is the water heater pan drain run to the hub?'), item('j1', 'f1', '2026-11-01T15:00:00.000Z'), item('j9', 'f9', '2026-11-01T15:00:00.000Z')]
  it('keeps another stage’s items out and orders the stage’s own by the time they were added', () => {
    expect(templateFor(withItems, 'rough_in', 'f1').map((q) => q.id)).toEqual(['q1', 'q2', 'q3', 'j1', 'j2'])
    expect(templateFor(withItems, 'rough_in').map((q) => q.id)).toEqual(['q1', 'q2', 'q3'])
    expect(templateFor(withItems, 'rough_in', 'f2').map((q) => q.id)).toEqual(['q1', 'q2', 'q3'])
  })
  it('splits the two groups', () => {
    const groups = templateGroups(templateFor(withItems, 'rough_in', 'f1'))
    expect(groups.company.map((q) => q.id)).toEqual(['q1', 'q2', 'q3'])
    expect(groups.job.map((q) => q.id)).toEqual(['j1', 'j2'])
    expect(isJobItem(groups.job[0]!)).toBe(true)
    expect(isJobItem(Q[0]!)).toBe(false)
  })
  it('counts a job item toward ready like a company question, so one added after the stage read ready flips it back', () => {
    const filled = [a('q1', 'yes', { photo }), a('q2', 'yes'), a('q3', 'not_here')]
    expect(stageChecklistState({ stageName: 'Rough In', fixtureId: 'f1', questions: Q, answers: filled }).ready).toBe(true)
    const s = stageChecklistState({ stageName: 'Rough In', fixtureId: 'f1', questions: withItems, answers: filled })
    expect(s).toEqual({ kind: 'rough_in', asked: 5, answered: 3, standing: 'not_ready', ready: false })
    // Another stage of the same kind never sees f1's items.
    expect(stageChecklistState({ stageName: 'Rough In', fixtureId: 'f2', questions: withItems, answers: filled }).ready).toBe(true)
  })
  it('gives a stage a checklist from its items alone, with no company question written', () => {
    const s = stageChecklistState({ stageName: 'Top Out', fixtureId: 'f2', questions: [{ ...item('j5', 'f2', '2026-11-01T15:00:00.000Z'), kind: 'top_out' }], answers: [] })
    expect(s).toEqual({ kind: 'top_out', asked: 1, answered: 0, standing: 'not_ready', ready: false })
  })
  it('reads each of a job’s stages against its own items', () => {
    const rows = jobStageChecklists([{ fixtureId: 'f1', name: 'Rough In', sequenceOrder: 1 }, { fixtureId: 'f2', name: 'Rough In (building B)', sequenceOrder: 2 }], withItems, new Map())
    expect(rows.map((r) => r.state.asked)).toEqual([5, 3])
  })
})

describe('checklistProgress: the sheet’s one open row', () => {
  const template = templateFor(Q, 'rough_in')
  it('names the first unanswered question as next, and the counts', () => {
    const p = checklistProgress(template, [a('q1', 'yes', { photo })])
    expect(p.next?.id).toBe('q2')
    expect([p.asked, p.answered, p.left, p.complete]).toEqual([3, 1, 2, false])
    expect(progressWords(p)).toBe('1 of 3 answered · 2 left')
  })
  it('keeps a row still owing its photo as next', () => {
    const p = checklistProgress(template, [a('q1', 'yes')])
    expect(p.next?.id).toBe('q1')
  })
  it('is complete when every row is answered, and never on an empty list', () => {
    const p = checklistProgress(template, [a('q1', 'not_here'), a('q2', 'no'), a('q3', 'yes')])
    expect(p.next).toBeNull()
    expect(p.complete).toBe(true)
    expect(progressWords(p)).toBe('3 of 3 answered')
    const none = checklistProgress([], [])
    expect(none.complete).toBe(false)
    expect(progressWords(none)).toBe('No questions yet')
    expect(groupCountWords(none)).toBe('none')
    expect(groupCountWords(p)).toBe('3 of 3')
  })
})

describe('the stamp: the name and the time on every row', () => {
  it('prints the company’s day and clock, lowercase', () => {
    expect(stampWords('Luis Ortega', '2026-11-01T15:14:00.000Z')).toBe('Luis Ortega · Nov 1 · 9:14 am')
    expect(answerStampWords(a('q1', 'yes', { answeredBy: 'Luis Ortega', answeredAt: '2026-11-01T23:02:00.000Z' }))).toBe('Luis Ortega · Nov 1 · 5:02 pm')
  })
  it('stands on the name alone without a time, and on someone without a name', () => {
    expect(stampWords('Luis Ortega', null)).toBe('Luis Ortega')
    expect(stampWords('', '2026-11-01T15:14:00.000Z')).toBe('someone · Nov 1 · 9:14 am')
    expect(answerStampWords(a('q1', null, { answeredBy: 'Luis Ortega' }))).toBe('')
    expect(answerStampWords(null)).toBe('')
  })
  it('says who added an item, or that you did', () => {
    const item: StageChecklistQuestion = { id: 'j1', kind: 'rough_in', order: 0, words: 'x', asksPhoto: false, fixtureId: 'f1', addedById: 'u-pat', addedBy: 'Pat Sample', addedAt: '2026-11-01T15:00:00.000Z' }
    expect(addedByWords(item)).toBe('Added by Pat Sample · Nov 1')
    expect(addedByWords(item, 'u-pat')).toBe('You added this · Nov 1')
    expect(addedByWords({ ...item, addedBy: '' })).toBe('Added for this job · Nov 1')
    expect(addedByWords(Q[0]!)).toBe('')
  })
})
