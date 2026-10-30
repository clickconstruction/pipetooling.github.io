/**
 * A checklist per stage (punch list #164, the owner's picks of 2026-10-24 and Taunya's of 2026-10-29): the office
 * writes a short list of questions once for each stage kind, Rough In, Top Out and Trim Set, and the crew answers
 * them on the phone for each job's stage, Yes, No or Not here, with a note, and a photo where a question asks for
 * one. The rule is strict: a stage reads not ready on the Pipeline until every question is answered. A stage kind
 * with no questions written has no checklist and reads exactly as before, so the checklists start the day the office
 * types the questions. A test report does not count as a stage's checklist.
 *
 * A stage's kind is read from its name with the Pipeline's own stage words (`stageRank`, v2.3417): a row that opens
 * with Rough is Rough In, Top out or Stack out is Top Out, Trim or Finish is Trim Set. Ground, slab, final and punch
 * rows, and any other line, have no checklist. The photo a question asks for files in the customer's Drive folder
 * through the photo-save sweep, like a box photo (v2.6045): the bucket is a waiting room and Drive the home.
 *
 * Pure. The tables are `stage_checklist_templates` and `stage_checklist_answers` (PR 2); the sheet, the Pipeline's
 * mark and the gallery come after.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { driveSafe } from '../photos/photoName'
import { stageRank } from './stageRecognition'

/** The three stage kinds a checklist is written for, in the order the work goes. */
export type StageChecklistKind = 'rough_in' | 'top_out' | 'trim_set'
export const STAGE_CHECKLIST_KINDS: readonly StageChecklistKind[] = ['rough_in', 'top_out', 'trim_set']
export const STAGE_CHECKLIST_KIND_NAMES: Readonly<Record<StageChecklistKind, string>> = { rough_in: 'Rough In', top_out: 'Top Out', trim_set: 'Trim Set' }

export const isStageChecklistKind = (v: unknown): v is StageChecklistKind => v === 'rough_in' || v === 'top_out' || v === 'trim_set'

/** The kind a stage's name reads as, or null for a stage with no checklist (Ground, Final, Permit, a service line). */
export function stageChecklistKindOf(stageName: string | null | undefined): StageChecklistKind | null {
  switch (stageRank(stageName)) {
    case 1:
      return 'rough_in'
    case 2:
      return 'top_out'
    case 3:
      return 'trim_set'
    default:
      return null
  }
}

/** The longest question the office may write, in characters. */
export const QUESTION_MAX_CHARS = 200

/** One question, as the office wrote it: the words, its place in the list, and whether it asks for a photo. */
export interface StageChecklistQuestion {
  id: string
  kind: StageChecklistKind
  order: number
  words: string
  asksPhoto: boolean
}

/** The questions of one kind, in the office's order. Every question given is taken as live; a retired one is left out upstream. */
export function templateFor(questions: readonly StageChecklistQuestion[], kind: StageChecklistKind): StageChecklistQuestion[] {
  return questions.filter((q) => q.kind === kind).sort((a, b) => a.order - b.order || a.words.localeCompare(b.words) || a.id.localeCompare(b.id))
}

/** The crew's pick on a question. Not here means the thing the question asks about is not on this job. */
export type StageChecklistPick = 'yes' | 'no' | 'not_here'
export const STAGE_CHECKLIST_PICKS: readonly StageChecklistPick[] = ['yes', 'no', 'not_here']
export const PICK_WORDS: Readonly<Record<StageChecklistPick, string>> = { yes: 'Yes', no: 'No', not_here: 'Not here' }
export const isStageChecklistPick = (v: unknown): v is StageChecklistPick => v === 'yes' || v === 'no' || v === 'not_here'

/** Where a question's photo stands: waiting for the sweep, filed in Drive, or held with its reason. */
export type StageChecklistPhotoState = 'waiting' | 'filed' | 'failed'

export interface StageChecklistPhoto {
  fileName: string
  takenAt: string
  state: StageChecklistPhotoState
  driveFileId: string | null
  failWhy: string | null
}

/** The crew's answer on one question, as its row keeps it. A row with no pick is a note or a photo left before the pick. */
export interface StageChecklistAnswer {
  questionId: string
  pick: StageChecklistPick | null
  note: string
  photo: StageChecklistPhoto | null
}

/** What a question still waits on: the crew's pick, the photo it asks for, or nothing. */
export type QuestionWaitsOn = 'pick' | 'photo' | null

/**
 * A question is answered when it has its pick, and the photo it asks for. Not here needs no photo: there is nothing
 * there to photograph. The photo counts from the moment it is taken, before the sweep files it.
 */
export function questionWaitsOn(question: Pick<StageChecklistQuestion, 'asksPhoto'>, answer: StageChecklistAnswer | null | undefined): QuestionWaitsOn {
  if (!answer?.pick) return 'pick'
  if (question.asksPhoto && answer.pick !== 'not_here' && !answer.photo) return 'photo'
  return null
}

export function questionAnswered(question: Pick<StageChecklistQuestion, 'asksPhoto'>, answer: StageChecklistAnswer | null | undefined): boolean {
  return questionWaitsOn(question, answer) === null
}

/** How a stage stands against its checklist: none to fill, filled, or not yet. */
export type StageChecklistStanding = 'none' | 'ready' | 'not_ready'

export interface StageChecklistState {
  kind: StageChecklistKind | null
  /** The live questions for the stage's kind. 0 when the stage has no checklist. */
  asked: number
  answered: number
  standing: StageChecklistStanding
  /** True unless the stage has a checklist with a question left. The Pipeline's one more state is `!ready`. */
  ready: boolean
}

export interface StageChecklistStateInput {
  stageName: string | null | undefined
  /** Every live question, any kind; the stage's own are picked out by its kind. */
  questions: readonly StageChecklistQuestion[]
  /** The stage's answers, by question id. */
  answers: ReadonlyMap<string, StageChecklistAnswer> | readonly StageChecklistAnswer[]
}

function answersById(answers: StageChecklistStateInput['answers']): ReadonlyMap<string, StageChecklistAnswer> {
  if (answers instanceof Map) return answers
  return new Map((answers as readonly StageChecklistAnswer[]).map((a) => [a.questionId, a]))
}

export function stageChecklistState(input: StageChecklistStateInput): StageChecklistState {
  const kind = stageChecklistKindOf(input.stageName)
  const template = kind ? templateFor(input.questions, kind) : []
  if (template.length === 0) return { kind, asked: 0, answered: 0, standing: 'none', ready: true }
  const byId = answersById(input.answers)
  const answered = template.filter((q) => questionAnswered(q, byId.get(q.id))).length
  const ready = answered === template.length
  return { kind, asked: template.length, answered, standing: ready ? 'ready' : 'not_ready', ready }
}

/** A job's stage, as `list_job_stage_progress` names it. */
export interface JobStageRef {
  fixtureId: string
  name: string
  sequenceOrder: number
}

export interface JobStageChecklist extends JobStageRef {
  state: StageChecklistState
}

/** Each of a job's stages with its standing, in stage order. */
export function jobStageChecklists(
  stages: readonly JobStageRef[],
  questions: readonly StageChecklistQuestion[],
  answersByFixture: ReadonlyMap<string, readonly StageChecklistAnswer[]>,
): JobStageChecklist[] {
  return [...stages]
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder || a.name.localeCompare(b.name))
    .map((s) => ({ ...s, state: stageChecklistState({ stageName: s.name, questions, answers: answersByFixture.get(s.fixtureId) ?? [] }) }))
}

/** True when any of the job's stages has a checklist, filled or not: the strip has something to show. */
export function jobHasChecklists(stages: readonly JobStageChecklist[]): boolean {
  return stages.some((s) => s.state.standing !== 'none')
}

// ── The words ────────────────────────────────────────────────────────────────

/** The chip on a stage with a checklist: *not ready* while a question is left, *ready* once filled, nothing without one. */
export function standingWords(state: Pick<StageChecklistState, 'standing'>): string {
  return state.standing === 'not_ready' ? 'not ready' : state.standing === 'ready' ? 'ready' : ''
}

/** *2 of 3 answered*, or '' for a stage with no checklist. */
export function answeredWords(state: Pick<StageChecklistState, 'asked' | 'answered'>): string {
  return state.asked === 0 ? '' : `${state.answered} of ${state.asked} answered`
}

/** The line under a stage's name on a strip or the Pipeline: *2 of 3 answered, not ready* or *Checklist filled*. */
export function stageChecklistLine(state: StageChecklistState): string {
  if (state.standing === 'none') return ''
  if (state.standing === 'ready') return 'Checklist filled'
  return `${answeredWords(state)}, not ready`
}

/** The sheet's foot: the rule, in the stage's name. */
export function sheetFootWords(stageName: string, state: StageChecklistState): string {
  if (state.standing === 'ready') return `${stageName} reads ready on the Pipeline.`
  return `${stageName} reads not ready on the Pipeline until every question is answered.`
}

/** What the sheet says for a stage whose kind has no questions yet. */
export function noQuestionsWords(stageName: string): string {
  const kind = stageChecklistKindOf(stageName)
  if (!kind) return `${stageName} has no checklist. Checklists are for Rough In, Top Out and Trim Set.`
  return `No questions for ${STAGE_CHECKLIST_KIND_NAMES[kind]} yet. The office writes them on Settings, under Jobs and billing.`
}

/** What a question row says it still waits on. */
export function waitsOnWords(waits: QuestionWaitsOn): string {
  return waits === 'pick' ? 'Pick Yes, No or Not here.' : waits === 'photo' ? 'Take the photo this one asks for.' : ''
}

/** The toast once the sheet saves. */
export function savedWords(stageName: string, state: StageChecklistState): string {
  return state.ready ? `${stageName}'s checklist is filled. It reads ready on the Pipeline.` : `Saved. ${answeredWords(state)} on ${stageName}.`
}

// ── The photo's name in Drive ────────────────────────────────────────────────

/** The longest piece of a question that goes into a photo's name, cut on a word. */
export const PHOTO_QUESTION_MAX = 60

function cutOnWord(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max + 1)
  const space = cut.lastIndexOf(' ')
  return (space > 0 ? cut.slice(0, space) : text.slice(0, max)).replace(/[.\s?!]+$/, '')
}

export interface ChecklistPhotoNameInput {
  takenAt: string
  stageName: string
  question: string
  /** The file's ending without the dot; the phone sends a JPEG. */
  ext?: string
}

/**
 * The name a checklist photo takes in the customer's Drive folder: *2026-10-29 Rough In · Water test held.jpg*, the
 * company's day, the stage and the question's words, safe for any computer that saves it. The sweep adds *(2)* when
 * the folder already holds the name, as it does for a box photo.
 */
export function checklistPhotoName(input: ChecklistPhotoNameInput): string {
  const stage = driveSafe(input.stageName) || 'Stage'
  const question = cutOnWord(driveSafe(input.question.replace(/[?!.]+$/, '')), PHOTO_QUESTION_MAX) || 'Photo'
  const ext = (input.ext ?? 'jpg').replace(/^\./, '').toLowerCase() || 'jpg'
  return `${calendarYmdInAppTzFromIso(input.takenAt)} ${stage} · ${question}.${ext}`
}
