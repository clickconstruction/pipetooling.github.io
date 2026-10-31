import { describe, expect, it } from 'vitest'
import type { StageChecklistQuestion } from '../jobs/stageChecklist'
import { plainWordsFailures } from '../plainWords'
import {
  CHECKLIST_PHOTO_WORDS,
  answerFailWords,
  answersClause,
  checklistAnswerWrites,
  checklistPhotoChips,
  chipLabel,
  tileAnswering,
  tileAsk,
  tileOnStage,
} from './reportPhotoChecklist'
import type { ReportPhotoTile } from './reportPhotos'

const stages = [
  { fixtureId: 'r', name: 'Rough In' },
  { fixtureId: 't', name: 'Top Out' },
  { fixtureId: 'w', name: 'Water heater' },
]
const q = (over: Partial<StageChecklistQuestion>): StageChecklistQuestion => ({ id: 'q1', kind: 'rough_in', order: 1, words: 'Did the water test hold?', asksPhoto: true, ...over })
const questions = [
  q({ id: 'q2', order: 2, words: 'Is every cleanout capped?', asksPhoto: false }),
  q({ id: 'q1', order: 1 }),
  q({ id: 'q3', kind: 'top_out', order: 1, words: 'Is the vent through the roof flashed and sealed on every side of the stack?', asksPhoto: true }),
  q({ id: 'q4', kind: 'trim_set', order: 1, words: 'Are the fixtures set?', asksPhoto: true }),
]

const tile = (over: Partial<ReportPhotoTile>): ReportPhotoTile => ({
  id: 'p1',
  status: 'sent',
  previewUrl: 'blob:1',
  originalBytes: 4_200_000,
  bytes: 310_000,
  width: 1600,
  height: 1200,
  longEdge: 1600,
  shrunk: true,
  fixtureId: null,
  stageName: null,
  questionId: null,
  questionWords: null,
  storagePath: 'job-1/p1.jpg',
  takenAt: '2026-10-31T15:41:00.000Z',
  failWhy: null,
  ...over,
})

describe('reportPhotoChecklist', () => {
  it('offers a chip per photo question of each stage’s kind, in stage order then the office’s, and none for a kind with no checklist', () => {
    const chips = checklistPhotoChips(stages, questions)
    expect(chips.map((c) => [c.fixtureId, c.questionId])).toEqual([
      ['r', 'q1'],
      ['t', 'q3'],
    ])
    expect(chips[0]).toEqual({ questionId: 'q1', fixtureId: 'r', stageName: 'Rough In', words: 'Did the water test hold?', label: 'Rough In · Did the water test hold?' })
    // A long question is cut on a word.
    expect(chips[1]!.label).toBe('Top Out · Is the vent through the roof flashed and sealed on every…')
    // No stages, or no questions: nothing.
    expect(checklistPhotoChips([], questions)).toEqual([])
    expect(checklistPhotoChips(stages, [])).toEqual([])
    // Trim Set is not one of this job's stages, so its question is not offered.
    expect(chips.some((c) => c.questionId === 'q4')).toBe(false)
  })

  it('labels a chip by the stage and the question', () => {
    expect(chipLabel('Rough In', ' Did the water test hold? ')).toBe('Rough In · Did the water test hold?')
    expect(chipLabel('', 'Did the water test hold?')).toBe('Did the water test hold?')
  })

  it('asks under a tile with no stage: on a job with stages as before, and on a one-stage job only when a question is there', () => {
    const chips = checklistPhotoChips(stages, questions)
    const fresh = tile({})
    expect(tileAsk(fresh, stages, chips)).toEqual({ stages, chips })
    expect(tileAsk(fresh, stages, [])).toEqual({ stages, chips: [] })
    // One stage and no question: never asks (v2.6083).
    expect(tileAsk(fresh, [stages[0]!], [])).toBeNull()
    // One stage with a question: asks, and names the one stage too so a plain photo has a press.
    const one = checklistPhotoChips([stages[0]!], questions)
    expect(tileAsk(fresh, [stages[0]!], one)).toEqual({ stages: [stages[0]], chips: one })
    // Placed, or failed: asks no more.
    expect(tileAsk(tile({ fixtureId: 'r', stageName: 'Rough In' }), stages, chips)).toBeNull()
    expect(tileAsk(tile({ status: 'failed' }), stages, chips)).toBeNull()
  })

  it('a question chip puts the tile on the question’s stage and answers it; a stage chip lets the question go', () => {
    const chips = checklistPhotoChips(stages, questions)
    const answering = tileAnswering(tile({}), chips[0]!)
    expect(answering).toMatchObject({ fixtureId: 'r', stageName: 'Rough In', questionId: 'q1', questionWords: 'Did the water test hold?' })
    expect(tileOnStage(answering, stages[1]!)).toMatchObject({ fixtureId: 't', stageName: 'Top Out', questionId: null, questionWords: null })
  })

  it('writes one answer per question from the sent shots, the latest shot winning, named as the sheet names a photo', () => {
    const chips = checklistPhotoChips(stages, questions)
    const a = tileAnswering(tile({ id: 'a', takenAt: '2026-10-31T15:41:00.000Z' }), chips[0]!)
    const later = tileAnswering(tile({ id: 'b', takenAt: '2026-10-31T15:45:00.000Z', bytes: 290_000 }), chips[0]!)
    const top = tileAnswering(tile({ id: 'c', takenAt: '2026-10-31T15:46:00.000Z' }), chips[1]!)
    const plain = tile({ id: 'd', fixtureId: 'r', stageName: 'Rough In' })
    const onItsWay = tileAnswering(tile({ id: 'e', status: 'sending' }), chips[0]!)
    const writes = checklistAnswerWrites({ jobId: 'job-1', tiles: [a, later, top, plain, onItsWay] })
    expect(writes).toEqual([
      { jobId: 'job-1', fixtureId: 'r', questionId: 'q1', reportPhotoId: 'b', fileName: '2026-10-31 Rough In · Did the water test hold.jpg', takenAt: '2026-10-31T15:45:00.000Z', bytes: 290_000 },
      {
        jobId: 'job-1',
        fixtureId: 't',
        questionId: 'q3',
        reportPhotoId: 'c',
        fileName: '2026-10-31 Top Out · Is the vent through the roof flashed and sealed on every.jpg',
        takenAt: '2026-10-31T15:46:00.000Z',
        bytes: 310_000,
      },
    ])
    // Only the shots that attached to the report answer.
    expect(checklistAnswerWrites({ jobId: 'job-1', tiles: [a, later, top], only: new Set(['c']) }).map((w) => w.reportPhotoId)).toEqual(['c'])
    expect(checklistAnswerWrites({ jobId: 'job-1', tiles: [plain] })).toEqual([])
  })

  it('says how many photos answer questions, and why an answer did not write', () => {
    const chips = checklistPhotoChips(stages, questions)
    expect(answersClause([])).toBe('')
    expect(answersClause([tile({})])).toBe('')
    expect(answersClause([tileAnswering(tile({}), chips[0]!)])).toBe('1 answers a checklist question')
    expect(answersClause([tileAnswering(tile({ id: 'a' }), chips[0]!), tileAnswering(tile({ id: 'b' }), chips[1]!)])).toBe('2 answer checklist questions')
    expect(answerFailWords(1, 'The phone has no signal.')).toBe('Report saved, but the photo did not answer its question. The phone has no signal.')
    expect(answerFailWords(2, 'column report_photo_id does not exist')).toBe('Report saved, but 2 photos did not answer their questions. column report_photo_id does not exist')
  })

  it('every new word a first-timer reads passes plain words', () => {
    for (const words of Object.values(CHECKLIST_PHOTO_WORDS)) expect(plainWordsFailures(words), words).toEqual([])
    expect(plainWordsFailures(answerFailWords(1, 'The phone has no signal.'))).toEqual([])
  })
})
