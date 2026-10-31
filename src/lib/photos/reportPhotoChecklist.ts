/**
 * A photo answers a checklist question (punch list #189, PR 6; the plan's item b.3). Under a new tile on the
 * camera-first report the chips ask which stage the photo shows (v2.6083). Where the job's stage checklist (#164) has
 * a question that asks for a photo, that question is a chip beside the stage chips: picking it puts the photo on the
 * question's stage and makes it the question's answer. Save then writes the shot onto the `stage_checklist_answers`
 * row for that stage and question with its `report_photos` id (migration `20261031150000`), and the sheet reads the
 * question answered with it; the Pipeline reads the stage one question nearer ready once the crew picks Yes or No.
 * The shot itself is still a report photo: one copy, filed by the report sweep, named by the stage and the question.
 *
 * Pure: which chips a tile offers, what a pick does to the tile, what Save writes, and the words. The io is
 * `stageChecklistSheetIo.answerQuestionsWithReportPhotos`.
 */
import { checklistPhotoName, stageChecklistKindOf, templateFor, type StageChecklistQuestion } from '../jobs/stageChecklist'
import type { ReportPhotoTile } from './reportPhotos'

/** A stage a photo can sit on, as the report's rows name it. */
export type PhotoStageRef = { fixtureId: string; name: string }

/** A checklist question that asks for a photo, on one of the job's stages: one chip under a new tile. */
export interface ChecklistPhotoChip {
  questionId: string
  fixtureId: string
  stageName: string
  /** The question as the office wrote it. */
  words: string
  /** The chip's words: the stage and the question, cut on a word. */
  label: string
}

/** The longest question a chip prints before it is cut on a word. */
export const CHIP_QUESTION_MAX = 60

export const CHECKLIST_PHOTO_WORDS = {
  /** Over the question chips, under the stage chips. */
  orAnswers: 'Or it answers a checklist question',
  /** On a tile that answers one. */
  answers: 'Answers',
  /** On the sheet, beside a photo that came from a report. */
  onReport: 'Taken on a field report.',
} as const

function cutOnWord(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max + 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > 0 ? cut.slice(0, space) : text.slice(0, max)).replace(/[.\s?!,]+$/, '')}…`
}

/** *Rough In · Did the water test hold?*; a long question is cut on a word with an ellipsis. */
export function chipLabel(stageName: string, words: string): string {
  const q = cutOnWord(words.trim(), CHIP_QUESTION_MAX)
  const stage = stageName.trim()
  return stage ? `${stage} · ${q}` : q
}

/**
 * The question chips a new tile offers: for each of the job's stages, in stage order, the live questions of its kind
 * that ask for a photo, in the office's order. A stage whose kind has no checklist offers none; a job with no stages
 * offers none.
 */
export function checklistPhotoChips(stages: ReadonlyArray<PhotoStageRef>, questions: ReadonlyArray<StageChecklistQuestion>): ChecklistPhotoChip[] {
  const out: ChecklistPhotoChip[] = []
  for (const s of stages) {
    const kind = stageChecklistKindOf(s.name)
    if (!kind) continue
    for (const q of templateFor(questions, kind)) {
      if (!q.asksPhoto) continue
      out.push({ questionId: q.id, fixtureId: s.fixtureId, stageName: s.name, words: q.words, label: chipLabel(s.name, q.words) })
    }
  }
  return out
}

/** What a new tile asks under it: the stage chips and the question chips, or nothing. */
export interface TileAsk {
  stages: PhotoStageRef[]
  chips: ChecklistPhotoChip[]
}

/**
 * A tile asks while it has no stage and is not a failed shot. A job with two or more stages asks as before; a
 * one-stage job asks only when a question chip is there, and then names its one stage too, so a plain photo of the
 * stage has a press. A tile a question chip placed has its stage and asks no more.
 */
export function tileAsk(tile: Pick<ReportPhotoTile, 'status' | 'fixtureId'>, stages: ReadonlyArray<PhotoStageRef>, chips: ReadonlyArray<ChecklistPhotoChip>): TileAsk | null {
  if (tile.status === 'failed' || tile.fixtureId != null) return null
  if (stages.length < 2 && chips.length === 0) return null
  return { stages: [...stages], chips: [...chips] }
}

/** The tile once a question chip is pressed: on the question's stage, answering the question. */
export function tileAnswering<T extends Pick<ReportPhotoTile, 'fixtureId' | 'stageName' | 'questionId' | 'questionWords'>>(tile: T, chip: ChecklistPhotoChip): T {
  return { ...tile, fixtureId: chip.fixtureId, stageName: chip.stageName, questionId: chip.questionId, questionWords: chip.words }
}

/** The tile once a stage chip is pressed: on the stage, answering nothing (a question picked before is let go). */
export function tileOnStage<T extends Pick<ReportPhotoTile, 'fixtureId' | 'stageName' | 'questionId' | 'questionWords'>>(tile: T, stage: PhotoStageRef): T {
  return { ...tile, fixtureId: stage.fixtureId, stageName: stage.name, questionId: null, questionWords: null }
}

/** What Save writes for one answered question: the row's key and the photo as the sheet would name it. */
export interface ChecklistAnswerWrite {
  jobId: string
  fixtureId: string
  questionId: string
  /** The `report_photos` row that is the answer's photo. */
  reportPhotoId: string
  /** *2026-10-31 Rough In · Did the water test hold.jpg*, the sheet's own name for a question's photo. */
  fileName: string
  takenAt: string
  bytes: number
}

type AnswerTile = Pick<ReportPhotoTile, 'id' | 'status' | 'fixtureId' | 'stageName' | 'questionId' | 'questionWords' | 'takenAt' | 'bytes'>

/**
 * The writes Save makes: one per question answered by a sent shot. A question two shots answer takes the latest; a
 * shot still on its way or failed never answers (it never rides). `only` keeps the writes to the shots that attached.
 */
export function checklistAnswerWrites(input: { jobId: string; tiles: ReadonlyArray<AnswerTile>; only?: ReadonlySet<string> | null }): ChecklistAnswerWrite[] {
  const byQuestion = new Map<string, AnswerTile>()
  for (const t of input.tiles) {
    if (t.status !== 'sent' || !t.questionId || !t.fixtureId) continue
    if (input.only && !input.only.has(t.id)) continue
    const key = `${t.fixtureId}|${t.questionId}`
    const was = byQuestion.get(key)
    if (!was || Date.parse(t.takenAt) >= Date.parse(was.takenAt)) byQuestion.set(key, t)
  }
  return [...byQuestion.values()].map((t) => ({
    jobId: input.jobId,
    fixtureId: t.fixtureId!,
    questionId: t.questionId!,
    reportPhotoId: t.id,
    fileName: checklistPhotoName({ takenAt: t.takenAt, stageName: t.stageName ?? '', question: t.questionWords ?? '' }),
    takenAt: t.takenAt,
    bytes: t.bytes,
  }))
}

/** The clause after the photos' on Stage progress: *1 answers a checklist question*, *2 answer checklist questions*, '' with none. */
export function answersClause(tiles: ReadonlyArray<Pick<ReportPhotoTile, 'questionId'>>): string {
  const n = tiles.filter((t) => Boolean(t.questionId)).length
  if (n === 0) return ''
  return n === 1 ? '1 answers a checklist question' : `${n} answer checklist questions`
}

/** The toast when the report saved but an answer did not write. */
export function answerFailWords(failed: number, why: string): string {
  const what = failed === 1 ? 'the photo did not answer its question' : `${failed} photos did not answer their questions`
  return `Report saved, but ${what}. ${why}`
}
