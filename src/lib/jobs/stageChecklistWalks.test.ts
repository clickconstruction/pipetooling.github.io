import { describe, expect, it } from 'vitest'
import { checklistPhotoChips } from '../photos/reportPhotoChecklist'
import { addSkip, dropSkip, jobStageChecklists, skipOn, skippedFor, stageChecklistState, templateFor, withSkips, type JobStageRef, type StageChecklistAnswer, type StageChecklistQuestion } from './stageChecklist'
import { stageChecklistMarks } from './stageChecklistMarks'
import {
  ITEM_WHY_MAX_CHARS,
  PLAN_SHEET_MAX_CHARS,
  addCheckWords,
  addedSoFarWords,
  canPromoteJobItem,
  canSkipQuestion,
  checklistsSummary,
  cleanShortLine,
  itemMetaWords,
  movedOrder,
  nextItemOrder,
  plansDoorUrl,
  promoteWords,
  putBackToastWords,
  skipProblem,
  skipWords,
  skippedLineWords,
  skippedToastWords,
  stageStandingChip,
  stripEmptyStageWords,
  withOrder,
} from './stageChecklistItems'

// What the walks added to the stage checklists (punch list #237, PR 1b). Made-up people and checks on a made-up job.
const STAGE = 'f3'
const OTHER_STAGE = 'f9'
const q1: StageChecklistQuestion = { id: 'q1', kind: 'trim_set', order: 1, words: 'Did the final water test hold?', asksPhoto: true }
const q2: StageChecklistQuestion = { id: 'q2', kind: 'trim_set', order: 2, words: 'Are the cleanouts capped?', asksPhoto: false }
const item = (id: string, order: number, over: Partial<StageChecklistQuestion> = {}): StageChecklistQuestion => ({ id, kind: 'trim_set', order, words: `Check ${id}?`, asksPhoto: false, fixtureId: STAGE, addedById: 'u-pat', addedBy: 'Pat Sample', addedAt: '2026-11-02T15:00:00.000Z', ...over })
const skip = (fixtureId: string, questionId: string, id = `s-${questionId}`) => ({ id, fixtureId, questionId, why: 'The owner took these out', by: 'Pat Sample', byId: 'u-pat', at: '2026-11-02T15:14:00.000Z' })
const yes = (questionId: string): StageChecklistAnswer => ({ questionId, pick: 'yes', note: '', photo: { fileName: 'x.jpg', takenAt: '', state: 'waiting', driveFileId: null, failWhy: null } })

describe('a skip leaves a company question off one stage and nowhere else', () => {
  const questions = withSkips([q1, q2, item('j1', 1)], [skip(STAGE, 'q1')])

  it('hangs the skip on its question and names it by stage', () => {
    expect(skipOn(questions[0]!, STAGE)?.why).toBe('The owner took these out')
    expect(skipOn(questions[0]!, OTHER_STAGE)).toBeNull()
    expect(skipOn(questions[1]!, STAGE)).toBeNull()
    expect(skipOn(questions[0]!, null)).toBeNull()
    // A question with no skip stays the same object, so a list with none reads as it did.
    expect(questions[1]).toBe(q2)
  })
  it('takes it off that stage’s list and leaves the company’s list and the other stage whole', () => {
    expect(templateFor(questions, 'trim_set', STAGE).map((q) => q.id)).toEqual(['q2', 'j1'])
    expect(templateFor(questions, 'trim_set', OTHER_STAGE).map((q) => q.id)).toEqual(['q1', 'q2'])
    expect(templateFor(questions, 'trim_set').map((q) => q.id)).toEqual(['q1', 'q2'])
  })
  it('lists what is skipped on the stage, with its skip', () => {
    expect(skippedFor(questions, 'trim_set', STAGE).map((r) => [r.question.id, r.skip.by])).toEqual([['q1', 'Pat Sample']])
    expect(skippedFor(questions, 'trim_set', OTHER_STAGE)).toEqual([])
    expect(skippedFor(questions, 'rough_in', STAGE)).toEqual([])
  })
  it('drops it from the count, so a stage reads ready without it and an answer it had counts for nothing', () => {
    const state = stageChecklistState({ stageName: 'Trim Set', fixtureId: STAGE, questions, answers: [yes('q1'), yes('q2')] })
    expect(state).toMatchObject({ asked: 2, answered: 1, standing: 'not_ready' })
    const filled = stageChecklistState({ stageName: 'Trim Set', fixtureId: STAGE, questions, answers: [yes('q2'), yes('j1')] })
    expect(filled).toMatchObject({ asked: 2, answered: 2, standing: 'ready', ready: true })
    // Put back, it counts again, and an answer it already had reads again.
    const back = stageChecklistState({ stageName: 'Trim Set', fixtureId: STAGE, questions: questions.map((q) => dropSkip(q, 's-q1')), answers: [yes('q1'), yes('q2')] })
    expect(back).toMatchObject({ asked: 3, answered: 2 })
  })
  it('reaches every surface that counts: the strip’s and the read-out’s rows, the Pipeline’s mark and the report photo chips', () => {
    const stages: JobStageRef[] = [{ fixtureId: STAGE, name: 'Trim Set', sequenceOrder: 3 }]
    const answers = new Map([[STAGE, [yes('q2'), yes('j1')]]])
    expect(jobStageChecklists(stages, questions, answers)[0]!.state.standing).toBe('ready')
    expect(stageChecklistMarks([{ id: STAGE, name: 'Trim Set' }], questions, answers)!.get(STAGE)).toMatchObject({ standing: 'ready', asked: 2 })
    expect(checklistPhotoChips([{ fixtureId: STAGE, name: 'Trim Set' }], questions)).toEqual([])
    expect(checklistPhotoChips([{ fixtureId: OTHER_STAGE, name: 'Trim Set' }], questions).map((c) => c.questionId)).toEqual(['q1'])
  })
  it('leaves a stage with every question skipped with no list to answer, and no mark', () => {
    const all = withSkips([q1, q2], [skip(STAGE, 'q1'), skip(STAGE, 'q2')])
    const state = stageChecklistState({ stageName: 'Trim Set', fixtureId: STAGE, questions: all, answers: [] })
    expect(state).toMatchObject({ standing: 'none', asked: 0, ready: true })
    expect(stageChecklistMarks([{ id: STAGE, name: 'Trim Set' }], all, new Map())!.size).toBe(0)
    expect(stageStandingChip(state, 2)).toEqual({ words: 'Nothing to answer · 2 skipped', tone: 'muted' })
    expect(stageStandingChip(state)).toEqual({ words: 'No questions yet', tone: 'muted' })
    expect(stripEmptyStageWords(2)).toBe('Every question is skipped on this job. Add a check if this job needs one.')
    expect(stripEmptyStageWords(0)).toBe('No questions yet. Add a check for this job.')
  })
  it('lands and lifts one stage’s skip at a time', () => {
    const on = addSkip(q1, skip(STAGE, 'q1'))
    expect(skipOn(on, STAGE)).not.toBeNull()
    // A second skip on the same stage replaces the first, and another stage's stands.
    const twice = addSkip(addSkip(on, skip(OTHER_STAGE, 'q1', 's-2')), skip(STAGE, 'q1', 's-3'))
    expect(twice.skips!.map((s) => s.id).sort()).toEqual(['s-2', 's-3'])
    expect(skipOn(dropSkip(twice, 's-3'), STAGE)).toBeNull()
    expect(skipOn(dropSkip(twice, 's-3'), OTHER_STAGE)?.id).toBe('s-2')
  })
  it('counts it in the section’s summary', () => {
    const rows = jobStageChecklists([{ fixtureId: STAGE, name: 'Trim Set', sequenceOrder: 3 }], questions, new Map())
    expect(checklistsSummary(rows, questions)).toBe('0 of 1 stage ready · 1 item added on this job · 1 skipped')
  })
})

describe('the skip’s rules and words', () => {
  it('is an author’s press, on the company’s questions alone', () => {
    expect(canSkipQuestion(true, q1)).toBe(true)
    expect(canSkipQuestion(false, q1)).toBe(false)
    expect(canSkipQuestion(true, item('j1', 1))).toBe(false)
  })
  it('needs its reason', () => {
    expect(skipProblem('  ')).toBe('Say why this question is not on this job.')
    expect(skipProblem('no')).toBe('Say why this question is not on this job.')
    expect(skipProblem('Slab on grade')).toBeNull()
  })
  it('names the stage, says the company’s list stays whole, and reads who, when and why', () => {
    const w = skipWords('Trim Set')
    expect(w.press).toBe('Skip on this job')
    expect(w.hint).toBe("The company's Trim Set list stays whole. Say why this question is not on this job.")
    expect(w.heading).toBe('Skipped on this job')
    expect(w.putBack).toBe('Put it back')
    expect(skippedLineWords({ by: 'Pat Sample', at: '2026-11-02T15:14:00.000Z', why: ' The owner took these out ' })).toBe('Pat Sample · Nov 2 · 9:14 am · The owner took these out')
    expect(skippedToastWords('Trim Set', { asked: 3, answered: 2 })).toBe('Skipped on this job. Trim Set is now 2 of 3.')
    expect(skippedToastWords('Trim Set', { asked: 0, answered: 0 })).toBe('Skipped on this job. Trim Set has nothing left to answer.')
    expect(putBackToastWords('Trim Set', { asked: 4, answered: 2 })).toBe('Put back. Trim Set is now 2 of 4.')
  })
})

describe('the company’s list', () => {
  it('takes a job item from the office alone', () => {
    expect(canPromoteJobItem('assistant', item('j1', 1))).toBe(true)
    expect(canPromoteJobItem('controller', item('j1', 1))).toBe(true)
    expect(canPromoteJobItem('dev', q1)).toBe(false)
    expect(canPromoteJobItem('superintendent', item('j1', 1))).toBe(false)
    expect(canPromoteJobItem('estimator', item('j1', 1))).toBe(false)
    expect(canPromoteJobItem(null, item('j1', 1))).toBe(false)
  })
  it('says it reaches every job of the kind, keeps this job’s answer, and leaves the job’s plan sheet and why behind', () => {
    const plain = promoteWords('Trim Set', item('j1', 1))
    expect(plain.press).toBe("Add to the company's list")
    expect(plain.confirm).toBe('Add to every Trim Set')
    expect(plain.keep).toBe('Keep it on this job')
    expect(plain.hint).toBe('Every Trim Set in the company asks this from now on. This job keeps its answer.')
    expect(promoteWords('Trim Set', item('j1', 1, { sheet: 'P-201' })).hint).toBe('Every Trim Set in the company asks this from now on. This job keeps its answer. Its plan sheet and its why are left off, since they were written for this job.')
    expect(promoteWords('Trim Set', item('j1', 1, { why: 'The slab pours Thursday' })).hint).toContain('left off')
  })
})

describe('the order of a stage’s own checks', () => {
  const group = [item('j1', 1), item('j2', 2), item('j3', 3)]
  it('moves one a place, and nothing past either end', () => {
    expect(movedOrder(group, 'j2', -1)).toEqual(['j2', 'j1', 'j3'])
    expect(movedOrder(group, 'j2', 1)).toEqual(['j1', 'j3', 'j2'])
    expect(movedOrder(group, 'j1', -1)).toBeNull()
    expect(movedOrder(group, 'j3', 1)).toBeNull()
    expect(movedOrder(group, 'nope', 1)).toBeNull()
  })
  it('lands at the places the database gives, and the list reads in that order', () => {
    const moved = withOrder([q1, ...group], ['j3', 'j1', 'j2'])
    expect(moved.map((q) => [q.id, q.order])).toEqual([['j3', 1], ['j1', 2], ['j2', 3]])
    expect(templateFor([q1, ...moved], 'trim_set', STAGE).map((q) => q.id)).toEqual(['q1', 'j3', 'j1', 'j2'])
    // An id the list no longer holds is dropped, never invented.
    expect(withOrder(group, ['gone', 'j1']).map((q) => [q.id, q.order])).toEqual([['j1', 2]])
  })
  it('puts a new check after every check on its stage, however they were put', () => {
    expect(nextItemOrder([q1, q2], STAGE)).toBe(1)
    expect(nextItemOrder([q1, item('j1', 0), item('j2', 0)], STAGE)).toBe(1)
    expect(nextItemOrder([q1, item('j1', 2), item('j2', 7)], STAGE)).toBe(8)
    expect(nextItemOrder([item('j1', 7, { fixtureId: OTHER_STAGE })], STAGE)).toBe(1)
    // Checks added before anyone ordered them (order 0) still read in the order they were added.
    const early = item('j1', 0, { addedAt: '2026-11-01T10:00:00.000Z' })
    const late = item('j2', 0, { addedAt: '2026-11-01T11:00:00.000Z' })
    expect(templateFor([late, early, item('j3', 1)], 'trim_set', STAGE).map((q) => q.id)).toEqual(['j1', 'j2', 'j3'])
  })
})

describe('the plan sheet and the why', () => {
  it('keeps a short line trimmed, one-spaced and cut to its length, or nothing', () => {
    expect(cleanShortLine('  P-201   detail 4 ', PLAN_SHEET_MAX_CHARS)).toBe('P-201 detail 4')
    expect(cleanShortLine('   ', PLAN_SHEET_MAX_CHARS)).toBeNull()
    expect(cleanShortLine(null, PLAN_SHEET_MAX_CHARS)).toBeNull()
    expect(cleanShortLine('x'.repeat(100), ITEM_WHY_MAX_CHARS)).toHaveLength(80)
  })
  it('opens the job’s Plans folder when it is a web address, and is words alone otherwise', () => {
    expect(plansDoorUrl('https://drive.example.com/plans')).toBe('https://drive.example.com/plans')
    expect(plansDoorUrl('  https://drive.example.com/plans ')).toBe('https://drive.example.com/plans')
    expect(plansDoorUrl('javascript:alert(1)')).toBeNull()
    expect(plansDoorUrl('in the truck')).toBeNull()
    expect(plansDoorUrl(null)).toBeNull()
  })
  it('names who added a check, when and why, on the check alone', () => {
    expect(itemMetaWords(item('j1', 1, { why: 'The slab pours Thursday' }))).toBe('Added by Pat Sample · Nov 2 · The slab pours Thursday')
    expect(itemMetaWords(item('j1', 1), 'u-pat')).toBe('You added this · Nov 2')
    expect(itemMetaWords(q1)).toBe('')
  })
  it('asks for them in the add box, and tallies what it added', () => {
    const w = addCheckWords('Trim Set')
    expect(w.sheet).toBe('The plan sheet it comes from, if any')
    expect(w.why).toBe('Why this check, if you want to say')
    expect(w.done).toBe('Done adding')
    expect(addedSoFarWords(0)).toBe('')
    expect(addedSoFarWords(2)).toBe('2 added')
  })
})
