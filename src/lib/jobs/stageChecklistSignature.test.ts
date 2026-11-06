import { describe, expect, it } from 'vitest'
import { checklistAnswerHash, isVoidedAnswer, liveAnswersById, questionAnswered, questionWaitsOn, signatureStands, stageChecklistState, voidedAnswersOf, waitsOnWords, type ChecklistSignature, type StageChecklistAnswer, type StageChecklistQuestion } from './stageChecklist'
import {
  AGREED_LINE,
  NEEDS_SIGNATURE_WORDS,
  READERS_LINE,
  SIGN_WORDS,
  TAKE_BACK_WORDS,
  canTakeBack,
  signProblem,
  signaturePngPath,
  signedCountWords,
  signedRowWords,
  signedStampWords,
  signedToastWords,
  signingWords,
  takeBackProblem,
  takenBackToastWords,
  voidedLineWords,
} from './stageChecklistSignature'

// Made-up questions on a made-up job; the owner writes the real ones.
const signed: StageChecklistQuestion = { id: 'q1', kind: 'trim_set', order: 1, words: 'Did the final water test hold?', asksPhoto: false, needsSignature: true }
const signedPhoto: StageChecklistQuestion = { id: 'q2', kind: 'trim_set', order: 2, words: 'Are the carriers set?', asksPhoto: true, needsSignature: true }
const plain: StageChecklistQuestion = { id: 'q3', kind: 'trim_set', order: 3, words: 'Are the cleanouts capped?', asksPhoto: false }

const sig = (over: Partial<ChecklistSignature> = {}): ChecklistSignature => ({ mode: 'type', printedName: 'Luis Ortega', storagePath: null, signedAt: '2026-11-01T15:14:00.000Z', signedById: 'u-luis', hash: checklistAnswerHash({ questionWords: signed.words, pick: 'yes', note: '' }), ...over })
const a = (over: Partial<StageChecklistAnswer> = {}): StageChecklistAnswer => ({ questionId: 'q1', pick: 'yes', note: '', photo: null, answeredBy: 'Luis Ortega', answeredAt: '2026-11-01T15:14:00.000Z', ...over })
const photo = { fileName: 'x.jpg', takenAt: '2026-11-01T15:20:00.000Z', state: 'waiting' as const, driveFileId: null, failWhy: null }

describe('checklistAnswerHash: the answer as given', () => {
  it('is the same for the same words, pick and note, whatever the spaces around them', () => {
    expect(checklistAnswerHash({ questionWords: ' Did the final water test hold? ', pick: 'yes', note: ' ' })).toBe(checklistAnswerHash({ questionWords: 'Did the final water test hold?', pick: 'yes', note: '' }))
    expect(checklistAnswerHash({ questionWords: signed.words, pick: 'yes', note: '' })).toMatch(/^[0-9a-f]{16}$/)
  })
  it('changes with the pick, the note or the words', () => {
    const base = checklistAnswerHash({ questionWords: signed.words, pick: 'yes', note: '' })
    expect(checklistAnswerHash({ questionWords: signed.words, pick: 'no', note: '' })).not.toBe(base)
    expect(checklistAnswerHash({ questionWords: signed.words, pick: 'yes', note: 'held 20 min' })).not.toBe(base)
    expect(checklistAnswerHash({ questionWords: 'Did the test hold?', pick: 'yes', note: '' })).not.toBe(base)
  })
})

describe('signatureStands: the record, not the mark', () => {
  it('stands while the answer is what was signed', () => {
    expect(signatureStands(signed, a({ signature: sig() }))).toEqual(sig())
  })
  it('falls when the pick or the note changed after signing, when the row has no pick, or when it was taken back', () => {
    expect(signatureStands(signed, a({ pick: 'no', signature: sig() }))).toBeNull()
    expect(signatureStands(signed, a({ note: 'later', signature: sig() }))).toBeNull()
    expect(signatureStands(signed, a({ pick: null, signature: sig() }))).toBeNull()
    expect(signatureStands(signed, a({ signature: sig(), voided: { at: '2026-11-05T16:00:00.000Z', by: 'Luis Ortega', why: 'wrong unit' } }))).toBeNull()
    expect(signatureStands(signed, a())).toBeNull()
    expect(signatureStands(signed, null)).toBeNull()
  })
})

describe('questionWaitsOn with a signature item', () => {
  it('waits on the pick, then the signature, then the photo; Not here signs too', () => {
    expect(questionWaitsOn(signed, null)).toBe('pick')
    expect(questionWaitsOn(signed, a())).toBe('signature')
    expect(questionWaitsOn(signed, a({ pick: 'not_here' }))).toBe('signature')
    expect(questionWaitsOn(signed, a({ pick: 'not_here', signature: sig({ hash: checklistAnswerHash({ questionWords: signed.words, pick: 'not_here', note: '' }) }) }))).toBeNull()
    expect(questionWaitsOn(signed, a({ signature: sig() }))).toBeNull()
    expect(questionAnswered(signed, a({ signature: sig() }))).toBe(true)
  })
  it('a signed row that owes its photo waits on the photo, and a Not here owes none', () => {
    const yes = a({ questionId: 'q2', signature: sig({ hash: checklistAnswerHash({ questionWords: signedPhoto.words, pick: 'yes', note: '' }) }) })
    expect(questionWaitsOn(signedPhoto, yes)).toBe('photo')
    expect(questionWaitsOn(signedPhoto, { ...yes, photo })).toBeNull()
    const notHere = a({ questionId: 'q2', pick: 'not_here', signature: sig({ hash: checklistAnswerHash({ questionWords: signedPhoto.words, pick: 'not_here', note: '' }) }) })
    expect(questionWaitsOn(signedPhoto, notHere)).toBeNull()
  })
  it('a plain question never waits on a signature, and a stale signature on it changes nothing', () => {
    expect(questionWaitsOn(plain, a({ questionId: 'q3' }))).toBeNull()
    expect(questionWaitsOn(plain, a({ questionId: 'q3', signature: sig({ hash: 'stale' }) }))).toBeNull()
  })
  it('an answer taken back waits on its pick again', () => {
    expect(questionWaitsOn(signed, a({ signature: sig(), voided: { at: '2026-11-05T16:00:00.000Z', by: 'Luis Ortega', why: 'wrong unit' } }))).toBe('pick')
    expect(waitsOnWords('signature')).toBe('Sign the answer. This one needs a signature.')
  })
})

describe('the live answer and the voided ones', () => {
  const voided = a({ signature: sig(), voided: { at: '2026-11-05T16:00:00.000Z', by: 'Luis Ortega', why: 'wrong unit' } })
  const older = a({ pick: 'no', signature: sig(), voided: { at: '2026-11-03T16:00:00.000Z', by: 'Pat Sample', why: 'typed on the wrong row' } })
  const live = a({ answeredAt: '2026-11-05T16:30:00.000Z' })
  it('every reader takes the live row and leaves the voided ones out', () => {
    expect(isVoidedAnswer(voided)).toBe(true)
    expect(isVoidedAnswer(live)).toBe(false)
    expect([...liveAnswersById([voided, live, older]).keys()]).toEqual(['q1'])
    expect(liveAnswersById([voided, live, older]).get('q1')).toBe(live)
    expect(liveAnswersById([voided]).size).toBe(0)
  })
  it('the voided rows read oldest first under their question', () => {
    expect(voidedAnswersOf([voided, live, older], 'q1').map((v) => v.voided?.why)).toEqual(['typed on the wrong row', 'wrong unit'])
    expect(voidedAnswersOf([voided, live, older], 'q3')).toEqual([])
  })
  it('a stage with a voided row and no live one reads not ready, and the live signed one reads ready', () => {
    expect(stageChecklistState({ stageName: 'Trim Set', questions: [signed], answers: [voided] }).standing).toBe('not_ready')
    expect(stageChecklistState({ stageName: 'Trim Set', questions: [signed], answers: [voided, a({ signature: sig() })] }).standing).toBe('ready')
  })
})

describe('the signature sheet', () => {
  it('says what is being claimed, where it goes, and who reads it', () => {
    const w = signingWords('yes', signed.words, 'J1042', 'Trim Set')
    expect(w.before).toBe('You are signing ')
    expect(w.pick).toBe('Yes')
    expect(w.after).toBe(` to “Did the final water test hold?”. It goes on J1042's Trim Set record with your name and the time. ${READERS_LINE}`)
    expect(signingWords('not_here', signed.words, '', 'Rough In').after).toContain("It goes on this job's Rough In record")
    expect(signingWords('no', signed.words, 'Riders', 'Rough In').after).toContain("on Riders' Rough In record")
    expect(AGREED_LINE).toBe('I did this check myself and the answer is true.')
    expect(NEEDS_SIGNATURE_WORDS.hint).toContain('where a wrong answer costs a wall or an inspection')
  })
  it('stops the press without a name, without the note on a No, with an empty pad, or without the agreed line', () => {
    const ok = { pick: 'yes' as const, note: '', printedName: 'Luis Ortega', agreed: true, mode: 'type' as const, drawnPng: null }
    expect(signProblem(ok)).toBeNull()
    expect(signProblem({ ...ok, printedName: '  ' })).toBe(SIGN_WORDS.nameHint)
    expect(signProblem({ ...ok, pick: 'no' })).toBe(SIGN_WORDS.noteNoHint)
    expect(signProblem({ ...ok, pick: 'no', note: 'the 2nd floor stack leaks' })).toBeNull()
    expect(signProblem({ ...ok, mode: 'draw' })).toBe(SIGN_WORDS.drawHint)
    expect(signProblem({ ...ok, mode: 'draw', drawnPng: 'data:image/png;base64,abc' })).toBeNull()
    expect(signProblem({ ...ok, agreed: false })).toBe(SIGN_WORDS.agreeHint)
  })
  it('names the drawn mark beside the job’s photos, under sig', () => {
    expect(signaturePngPath('job-1', 'ans-2', 1762010040000)).toBe('job-1/sig/ans-2-1762010040000.png')
  })
})

describe('the signed row and the voided line', () => {
  it('words the stamp, the toast and the count', () => {
    expect(signedRowWords(sig())).toBe('Signed by Luis Ortega · Nov 1 · 9:14 am')
    expect(signedStampWords('Luis Ortega · Nov 1 · 9:14 am')).toBe('Luis Ortega · Nov 1 · 9:14 am · signed')
    expect(signedStampWords('')).toBe('signed')
    expect(signedToastWords('Trim Set', { asked: 5, answered: 3 })).toBe('Signed and saved. Trim Set is now 3 of 5.')
    expect(takenBackToastWords('Trim Set', { asked: 5, answered: 2 })).toBe('Taken back. Trim Set is now 2 of 5.')
    expect(signedCountWords(0)).toBe('')
    expect(signedCountWords(3)).toBe('3 signed')
  })
  it('offers Take it back on a signed row alone, and asks for its reason', () => {
    expect(canTakeBack(a({ signature: sig() }))).toBe(true)
    expect(canTakeBack(a())).toBe(false)
    expect(canTakeBack(a({ signature: sig(), voided: { at: '2026-11-05T16:00:00.000Z', by: 'Luis Ortega', why: 'wrong unit' } }))).toBe(false)
    expect(canTakeBack(null)).toBe(false)
    expect(takeBackProblem('  ')).toBe('Say why the answer is taken back.')
    expect(takeBackProblem('wrong unit')).toBeNull()
    expect(TAKE_BACK_WORDS.confirm).toBe('Take it back')
  })
  it('reads the voided line: what it was, who signed it, who took it back and why', () => {
    expect(voidedLineWords(a({ signature: sig(), voided: { at: '2026-11-05T16:20:00.000Z', by: 'Luis Ortega', why: ' wrong unit ' } }))).toBe('Was Yes, signed by Luis Ortega · Nov 1 · 9:14 am. Taken back by Luis Ortega · Nov 5 · 10:20 am · “wrong unit”.')
    expect(voidedLineWords(a({ pick: 'no', voided: { at: '2026-11-05T16:20:00.000Z', by: 'Pat Sample', why: 'typed on the wrong row' } }))).toBe('Was No by Luis Ortega · Nov 1 · 9:14 am. Taken back by Pat Sample · Nov 5 · 10:20 am · “typed on the wrong row”.')
    expect(voidedLineWords(a())).toBe('')
  })
})
