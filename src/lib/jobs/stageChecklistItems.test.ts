import { describe, expect, it } from 'vitest'
import { checklistAnswerHash, type JobStageChecklist, type StageChecklistAnswer, type StageChecklistQuestion } from './stageChecklist'
import { GROUP_WORDS, READOUT_FOOT, TAKE_OFF_WORDS, addCheckWords, addScopeWords, addedCompanyWords, addedWords, asksMayAuthor, canAuthorOnJob, canMoveCompanyQuestions, canTakeOffCompanyQuestion, canTakeOffJobItem, canUseAsCompanyList, canWriteCompanyList, checklistsSummary, cleanItemWords, companyTakeOffProblem, companyTakeOffWords, companyTakenOffWords, jobItemProblem, nextCompanyOrder, noJobItemsWords, rowAsksPhotoTag, rowGlyph, rowMetaWords, rowPickWords, rowSignatureTag, stageStandingChip, stripListsEmptyStage, takenOffWords, companyListFromJobOutcome, companyListFromJobWords } from './stageChecklistItems'

// Made-up people and checks on a made-up job.
const company: StageChecklistQuestion = { id: 'q1', kind: 'trim_set', order: 1, words: 'Did the final water test hold?', asksPhoto: true }
const item: StageChecklistQuestion = { id: 'j1', kind: 'trim_set', order: 0, words: 'Are the carriers in units 7 and 8 set?', asksPhoto: false, fixtureId: 'f3', addedById: 'u-pat', addedBy: 'Pat Sample', addedAt: '2026-11-01T15:00:00.000Z' }
const a = (over: Partial<StageChecklistAnswer>): StageChecklistAnswer => ({ questionId: 'q1', pick: 'yes', note: '', photo: null, answeredBy: 'Luis Ortega', answeredAt: '2026-11-01T15:14:00.000Z', ...over })

describe('who adds and who takes off', () => {
  it('the office authors anywhere, whatever the job answers; a superintendent and an estimator author where the database says; the technician never', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller'] as const) {
      expect(canAuthorOnJob(role, false)).toBe(true)
      expect(asksMayAuthor(role)).toBe(false)
    }
    for (const role of ['superintendent', 'estimator'] as const) {
      expect(canAuthorOnJob(role, true)).toBe(true)
      expect(canAuthorOnJob(role, false)).toBe(false)
      expect(asksMayAuthor(role)).toBe(true)
    }
    for (const role of ['helpers', 'subcontractor', 'primary'] as const) {
      expect(canAuthorOnJob(role, true)).toBe(false)
      expect(asksMayAuthor(role)).toBe(false)
    }
    expect(canAuthorOnJob(null, true)).toBe(false)
  })
  it('the strip lists a stage with no question for a superintendent or an estimator who authors on this job, whose one door is the sheet', () => {
    expect(stripListsEmptyStage('superintendent', true)).toBe(true)
    expect(stripListsEmptyStage('estimator', true)).toBe(true)
    expect(stripListsEmptyStage('superintendent', false)).toBe(false)
    expect(stripListsEmptyStage('estimator', false)).toBe(false)
    expect(stripListsEmptyStage('assistant', true)).toBe(false)
    expect(stripListsEmptyStage('dev', true)).toBe(false)
    expect(stripListsEmptyStage('helpers', true)).toBe(false)
    expect(stripListsEmptyStage(null, true)).toBe(false)
  })
  it('the adder or the office takes off, and never a company question', () => {
    expect(canTakeOffJobItem('superintendent', item, 'u-pat')).toBe(true)
    expect(canTakeOffJobItem('superintendent', item, 'u-other')).toBe(false)
    expect(canTakeOffJobItem('assistant', item, 'u-other')).toBe(true)
    // The adder takes off whatever their role; a helper who did not add it cannot.
    expect(canTakeOffJobItem('helpers', item, 'u-pat')).toBe(true)
    expect(canTakeOffJobItem('helpers', item, 'u-luis')).toBe(false)
    expect(canTakeOffJobItem('dev', company, 'u-pat')).toBe(false)
  })
})

describe('the add box', () => {
  it('stops an empty or over-long check with its reason', () => {
    expect(jobItemProblem('   ')).toBe('Type the check as a question the crew answers with Yes, No or Not here.')
    expect(jobItemProblem('x'.repeat(201))).toBe('The check is over 200 characters. Shorten it.')
    expect(jobItemProblem('Is the pan drain run to the hub?')).toBeNull()
    expect(cleanItemWords('  Is the  pan drain   run? ')).toBe('Is the pan drain run?')
  })
  it('names the stage in its words', () => {
    const w = addCheckWords('Trim Set')
    expect(w.press).toBe('+ Add a check for Trim Set')
    expect(w.title).toBe('Add a check for Trim Set on this job')
    expect(w.hint).toBe("The crew sees it on this job's Trim Set sheet now. It counts toward ready like the company's questions. You can take it off later, and an answer it already has stays.")
    expect(w.confirm).toBe('Add the check')
    expect(addedWords('Trim Set', { asked: 6, answered: 3 })).toBe('Added. Trim Set is now 3 of 6.')
    expect(takenOffWords('Trim Set', { asked: 5, answered: 3 })).toBe('Taken off. Trim Set is now 3 of 5.')
    expect(TAKE_OFF_WORDS.confirm).toBe('Take it off')
    expect(GROUP_WORDS.job).toBe('Added for this job')
    expect(noJobItemsWords('Trim Set', true)).toBe("Nothing added for this job's Trim Set.")
    expect(noJobItemsWords('Trim Set', false)).toBe("Nothing added for this job's Trim Set. The superintendent or the office adds one.")
  })
})

describe('the Documents read-out', () => {
  const row = (fixtureId: string, name: string, standing: 'none' | 'ready' | 'not_ready', asked: number, answered: number): JobStageChecklist => ({ fixtureId, name, sequenceOrder: 1, state: { kind: 'trim_set', asked, answered, standing, ready: standing !== 'not_ready' } })
  it('chips each stage by its standing', () => {
    expect(stageStandingChip({ standing: 'ready', asked: 4, answered: 4 })).toEqual({ words: 'Ready · 4 of 4', tone: 'green' })
    expect(stageStandingChip({ standing: 'not_ready', asked: 6, answered: 3 })).toEqual({ words: 'Not ready · 3 of 6', tone: 'amber' })
    expect(stageStandingChip({ standing: 'none', asked: 0, answered: 0 })).toEqual({ words: 'No questions yet', tone: 'muted' })
  })
  it('sums the stages and the items added on the job', () => {
    const rows = [row('f1', 'Rough In', 'ready', 4, 4), row('f2', 'Top Out', 'ready', 3, 3), row('f3', 'Trim Set', 'not_ready', 6, 3)]
    expect(checklistsSummary(rows, [company, item, { ...item, id: 'j2' }, { ...item, id: 'j-other', fixtureId: 'f-other-job' }])).toBe('2 of 3 stages ready · 2 items added on this job')
    expect(checklistsSummary(rows, [company, item])).toBe('2 of 3 stages ready · 1 item added on this job')
    expect(checklistsSummary([row('f3', 'Trim Set', 'not_ready', 1, 0)], [company])).toBe('0 of 1 stage ready · nothing added on this job')
    expect(checklistsSummary([row('f3', 'Trim Set', 'none', 0, 0)], [])).toBe('')
  })
  it('words a row: the pick, the stamp, the note and the photo', () => {
    expect(rowPickWords(company, null)).toBe('open')
    expect(rowPickWords(company, a({ pick: 'yes' }))).toBe('Yes, no photo yet')
    expect(rowPickWords(item, a({ pick: 'not_here' }))).toBe('Not here')
    expect(rowAsksPhotoTag(company, null)).toBe(true)
    expect(rowAsksPhotoTag(company, a({ pick: 'yes' }))).toBe(true)
    expect(rowAsksPhotoTag(company, a({ pick: 'not_here' }))).toBe(false)
    expect(rowAsksPhotoTag(company, a({ photo: { fileName: 'x.jpg', takenAt: '', state: 'filed', driveFileId: 'd', failWhy: null } }))).toBe(false)
    expect(rowAsksPhotoTag(item, null)).toBe(false)
    expect(rowGlyph(null)).toBe('☐')
    expect(rowGlyph(a({ pick: 'no' }))).toBe('✗')
    expect(rowGlyph(a({ pick: 'not_here' }))).toBe('—')
    expect(rowMetaWords(null)).toBe('')
    expect(rowMetaWords(a({ note: 'Roofer not here until Mon' }))).toBe('Luis Ortega · Nov 1 · 9:14 am · “Roofer not here until Mon”')
    expect(rowMetaWords(a({ photo: { fileName: 'x.jpg', takenAt: '', state: 'filed', driveFileId: 'd', failWhy: null } }))).toBe('Luis Ortega · Nov 1 · 9:14 am · photo in Drive')
    expect(rowMetaWords(a({ photo: { fileName: 'x.jpg', takenAt: '', state: 'waiting', driveFileId: null, failWhy: null } }))).toBe('Luis Ortega · Nov 1 · 9:14 am · photo on its way to Drive')
    expect(READOUT_FOOT.startsWith('A No or a Not here is an answer.')).toBe(true)
  })
})

describe('needs a signature on the read-out (#237 PR 2)', () => {
  const signedQ: StageChecklistQuestion = { ...company, asksPhoto: false, needsSignature: true }
  const hash = checklistAnswerHash({ questionWords: signedQ.words, pick: 'yes', note: '' })
  const signature = { mode: 'type' as const, printedName: 'Luis Ortega', storagePath: null, signedAt: '2026-11-01T15:14:00.000Z', signedById: 'u-luis', hash }
  it('words a row that waits on its signature, and tags it', () => {
    expect(rowPickWords(signedQ, a({ pick: 'yes' }))).toBe('Yes, not signed yet')
    expect(rowPickWords(signedQ, a({ pick: 'yes', signature }))).toBe('Yes')
    expect(rowSignatureTag(signedQ, null)).toEqual({ words: 'needs a signature', signed: false })
    expect(rowSignatureTag(signedQ, a({ pick: 'yes', signature }))).toEqual({ words: 'signed', signed: true })
    expect(rowSignatureTag(company, a({ pick: 'yes' }))).toBeNull()
  })
  it('the add box carries the toggle and its rule', () => {
    const w = addCheckWords('Trim Set')
    expect(w.signature).toBe('Needs a signature')
    expect(w.signatureHint).toContain('Use it where a wrong answer costs a wall or an inspection.')
  })
})

describe("the company's list on Documents (#237 PR 4)", () => {
  it('the office alone writes the company’s list, moves it with two or more, and offers the whole job list with two or more checks', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller'] as const) {
      expect(canWriteCompanyList(role)).toBe(true)
      expect(canTakeOffCompanyQuestion(role, company)).toBe(true)
      expect(canTakeOffCompanyQuestion(role, item)).toBe(false)
      expect(canMoveCompanyQuestions(role, 2)).toBe(true)
      expect(canMoveCompanyQuestions(role, 1)).toBe(false)
      expect(canUseAsCompanyList(role, 2)).toBe(true)
      expect(canUseAsCompanyList(role, 1)).toBe(false)
    }
    for (const role of ['superintendent', 'estimator', 'helpers', 'primary', null] as const) {
      expect(canWriteCompanyList(role)).toBe(false)
      expect(canTakeOffCompanyQuestion(role, company)).toBe(false)
      expect(canMoveCompanyQuestions(role, 3)).toBe(false)
      expect(canUseAsCompanyList(role, 3)).toBe(false)
    }
  })
  it('names the stage in the scope pick, the take-off and the whole-list press, and counts the confirm', () => {
    const scope = addScopeWords('Trim Set')
    expect(scope.company).toBe('Every Trim Set in the company')
    expect(scope.companyConfirm).toBe('Add to every Trim Set')
    expect(scope.companyHint).toContain('A plan sheet and a why are for one job')
    expect(addedCompanyWords('Trim Set')).toBe("Added to the company's list. Every Trim Set asks it from now on.")
    const off = companyTakeOffWords('Trim Set')
    expect(off.press).toBe("Take off the company's list")
    expect(off.confirm).toBe('Take it off every Trim Set')
    expect(companyTakeOffProblem('  ')).toBe('Say why this question comes off the company’s list.')
    expect(companyTakeOffProblem('the inspector no longer asks')).toBeNull()
    expect(companyTakenOffWords('Trim Set', { asked: 3, answered: 2 })).toBe("Taken off the company's list. Trim Set is now 2 of 3.")
    const useAs = companyListFromJobWords('Trim Set', 3)
    expect(useAs.press).toBe("Use as the company's Trim Set list")
    expect(useAs.confirm).toBe('Add 3 checks to every Trim Set')
    expect(companyListFromJobWords('Trim Set', 1).confirm).toBe('Add 1 check to every Trim Set')
  })
  it('places a new company question after the kind’s live company rows, never after a job item', () => {
    expect(nextCompanyOrder([company, { ...company, id: 'q2', order: 4 }, { ...item, order: 9 }], 'trim_set')).toBe(5)
    expect(nextCompanyOrder([company], 'rough_in')).toBe(1)
  })
  it('reads the run’s outcome in the batch shape: what took, what stayed with its reason', () => {
    expect(companyListFromJobOutcome(3, 0)).toEqual({ line: 'Added 3 checks.', head: null, tone: 'success' })
    expect(companyListFromJobOutcome(2, 1)).toEqual({ line: 'Added 2 checks. 1 did not add.', head: '1 check did not add. It stays here with the reason.', tone: 'warning' })
    expect(companyListFromJobOutcome(0, 2).tone).toBe('error')
  })
  it('the foot says where the company’s questions are written now', () => {
    expect(READOUT_FOOT).toContain('pick the company on the add box')
  })
})
