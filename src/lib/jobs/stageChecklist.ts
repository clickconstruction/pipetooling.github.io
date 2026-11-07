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
 * Since punch list #237 PR 1 (v2.6328) a question has a second scope: beside the company's rows, an item added for
 * one job's stage (`job_id` + `fixture_id` on the same table) by the office or the job's superintendent. The sheet
 * shows them under *Added for this job*; they count toward ready like a company question, so an item added after a
 * stage read ready flips it back, which is the point. Every answer stamps its row with the name and the time.
 *
 * Since PR 1b (v2.6347) a company question can be skipped on one job's stage with a reason: the question carries its
 * skips, so `templateFor` leaves it off that stage's list and off its count, on every surface, and the company's list
 * stays whole. A check can also name the plan sheet it came from and why it is there.
 *
 * Since PR 2 (v2.6563) the author can mark a question *needs a signature*: whoever answers it signs the way the app
 * signs a lien notice (`lienNoticeSignature.ts`, v2.5077), the record and not the mark, bound to the answer as given
 * by a hash (`checklistAnswerHash`), so a later change voids it. A signature item is not answered until the signature
 * stands; Not here signs too, since it is the claim an inspector would test. A signed row locks; *Take it back* voids
 * the row with a reason and the next press writes a new one, so a question can carry voided answers beside its live
 * one, and every reader takes the live one (`liveAnswersById`). The words are `stageChecklistSignature.ts`.
 *
 * Pure. The tables are `stage_checklist_templates` and `stage_checklist_answers` (PR 2); the sheet, the Pipeline's
 * mark and the gallery come after.
 */
import { calendarYmdInAppTzFromIso, formatDenverCalendarDayShort, formatDenverTimeOnly } from '../../utils/dateUtils'
import { driveSafe } from '../photos/photoName'
import { lienFieldsHash } from './lienNoticeSignature'
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

/**
 * One question, as the office wrote it: the words, its place in the list, and whether it asks for a photo. An item
 * added for one job's stage (#237) names its stage in `fixtureId` and who added it; the company's rows name neither.
 */
export interface StageChecklistQuestion {
  id: string
  kind: StageChecklistKind
  order: number
  words: string
  asksPhoto: boolean
  /** True when whoever answers signs, Not here too, and the row locks after (#237 PR 2). Absent reads as false. */
  needsSignature?: boolean
  /** The job stage an item was added for; null or absent on the company's questions. */
  fixtureId?: string | null
  /** The adder's login, for *Take off* (the adder or the office). */
  addedById?: string | null
  /** The adder's name, as the sheet stamps it. */
  addedBy?: string
  /** When it was added, ISO. */
  addedAt?: string | null
  /** The plan sheet or detail a check came from, as typed: *P-201 detail 4*. */
  sheet?: string | null
  /** Why the check is here, in one line, as typed. */
  why?: string | null
  /** The stages of the job or jobs read where this company question is skipped. */
  skips?: readonly StageChecklistSkip[]
}

/** A company question left off one job's stage (#237 PR 1b): who, when and why. */
export interface StageChecklistSkip {
  id: string
  fixtureId: string
  why: string
  /** The name as the row keeps it. */
  by: string
  byId?: string | null
  at?: string | null
}

/** True for an item added for one job's stage; false for the company's question. */
export function isJobItem(q: Pick<StageChecklistQuestion, 'fixtureId'>): boolean {
  return Boolean(q.fixtureId)
}

/** The skip that leaves this question off this stage, or null. */
export function skipOn(q: Pick<StageChecklistQuestion, 'skips'>, fixtureId: string | null | undefined): StageChecklistSkip | null {
  if (!fixtureId) return null
  return q.skips?.find((s) => s.fixtureId === fixtureId) ?? null
}

/** The question with this skip on it, as a skip lands. */
export function addSkip(q: StageChecklistQuestion, skip: StageChecklistSkip): StageChecklistQuestion {
  return { ...q, skips: [...(q.skips ?? []).filter((s) => s.fixtureId !== skip.fixtureId), skip] }
}

/** The question with this skip off it, as a put back lands. */
export function dropSkip(q: StageChecklistQuestion, skipId: string): StageChecklistQuestion {
  return { ...q, skips: (q.skips ?? []).filter((s) => s.id !== skipId) }
}

/** The questions with each one's skips on it, as the reads hand them to every surface. */
export function withSkips(questions: readonly StageChecklistQuestion[], skips: ReadonlyArray<StageChecklistSkip & { questionId: string }>): StageChecklistQuestion[] {
  const byQuestion = new Map<string, StageChecklistSkip[]>()
  for (const { questionId, ...skip } of skips) byQuestion.set(questionId, [...(byQuestion.get(questionId) ?? []), skip])
  return questions.map((q) => {
    const on = byQuestion.get(q.id)
    return on ? { ...q, skips: on } : q
  })
}

const byPlace = (a: StageChecklistQuestion, b: StageChecklistQuestion) => a.order - b.order || (a.addedAt ?? '').localeCompare(b.addedAt ?? '') || a.words.localeCompare(b.words) || a.id.localeCompare(b.id)

/**
 * The questions of one kind, in the office's order, less any skipped on this stage, then the items added for the stage
 * named by `fixtureId` in the order they were put. Without a stage, the company's rows alone. Every question given is
 * taken as live; a retired one is left out upstream.
 */
export function templateFor(questions: readonly StageChecklistQuestion[], kind: StageChecklistKind, fixtureId?: string | null): StageChecklistQuestion[] {
  const ofKind = questions.filter((q) => q.kind === kind)
  const company = ofKind.filter((q) => !isJobItem(q) && !skipOn(q, fixtureId)).sort(byPlace)
  const job = fixtureId ? ofKind.filter((q) => q.fixtureId === fixtureId).sort(byPlace) : []
  return [...company, ...job]
}

/** The company's questions skipped on this stage, in the office's order, each with its skip: the *Skipped on this job* line. */
export function skippedFor(questions: readonly StageChecklistQuestion[], kind: StageChecklistKind, fixtureId: string): Array<{ question: StageChecklistQuestion; skip: StageChecklistSkip }> {
  return questions
    .filter((q) => q.kind === kind && !isJobItem(q) && skipOn(q, fixtureId) != null)
    .sort(byPlace)
    .map((question) => ({ question, skip: skipOn(question, fixtureId)! }))
}

/** A stage's template split into its two groups, as the sheet and the read-out draw them. */
export interface TemplateGroups {
  company: StageChecklistQuestion[]
  job: StageChecklistQuestion[]
}

export function templateGroups(template: readonly StageChecklistQuestion[]): TemplateGroups {
  return { company: template.filter((q) => !isJobItem(q)), job: template.filter(isJobItem) }
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

/** How an answer was signed (#237 PR 2): `type` = one press placed the name in cursive; `draw` = the signer drew it. */
export type ChecklistSignatureMode = 'type' | 'draw'

/** The signature on an answer, as its row keeps it: the record, not the mark. */
export interface ChecklistSignature {
  mode: ChecklistSignatureMode
  printedName: string
  /** The drawn PNG's path in the checklist bucket; null for a typed signature. */
  storagePath: string | null
  signedAt: string
  signedById: string | null
  /** The hash of the answer as given at signing; the signature stands only while it still matches. */
  hash: string
}

/** An answer taken back (#237 PR 2): who, when and why. The row and its signature stay as the record. */
export interface ChecklistAnswerVoid {
  at: string
  by: string
  byId?: string | null
  why: string
}

/**
 * The crew's answer on one question, as its row keeps it. A row with no pick is a note or a photo left before the
 * pick. The stamp (#237): who pressed, and when, ISO. A signed answer carries its signature; one taken back carries
 * its void, and reads on no surface as the question's answer.
 */
export interface StageChecklistAnswer {
  questionId: string
  pick: StageChecklistPick | null
  note: string
  photo: StageChecklistPhoto | null
  answeredBy?: string
  answeredAt?: string | null
  signature?: ChecklistSignature | null
  voided?: ChecklistAnswerVoid | null
}

/** True for an answer taken back: the row is the record, never the question's answer. */
export function isVoidedAnswer(answer: Pick<StageChecklistAnswer, 'voided'> | null | undefined): boolean {
  return Boolean(answer?.voided)
}

/**
 * The hash a signature binds to (#237 PR 2): the question's words, the pick and the note as given, through the lien
 * notice's own hash. It detects a change after signing; it is not a secret.
 */
export function checklistAnswerHash(input: { questionWords: string; pick: StageChecklistPick; note: string }): string {
  return lienFieldsHash({ words: input.questionWords.trim(), pick: input.pick, note: input.note.trim() })
}

/**
 * The answer's signature while it still counts: the row is signed, not taken back, and the answer as it stands is the
 * answer that was signed. Null for an unsigned row, a voided one, or one whose pick or note changed after signing.
 */
export function signatureStands(question: Pick<StageChecklistQuestion, 'words'>, answer: StageChecklistAnswer | null | undefined): ChecklistSignature | null {
  if (!answer?.signature || !answer.pick || isVoidedAnswer(answer)) return null
  return answer.signature.hash === checklistAnswerHash({ questionWords: question.words, pick: answer.pick, note: answer.note }) ? answer.signature : null
}

/** What a question still waits on: the crew's pick, the signature the author asked for, the photo it asks for, or nothing. */
export type QuestionWaitsOn = 'pick' | 'signature' | 'photo' | null

/** The parts of a question the waits-on rule reads. */
export type QuestionAsks = Pick<StageChecklistQuestion, 'asksPhoto' | 'needsSignature' | 'words'>

/**
 * A question is answered when it has its pick, the signature where the author asked for one (Not here signs too), and
 * the photo it asks for. Not here needs no photo: there is nothing there to photograph. The photo counts from the moment
 * it is taken, before the sweep files it. An answer taken back is no answer: the question waits on its pick again.
 */
export function questionWaitsOn(question: QuestionAsks, answer: StageChecklistAnswer | null | undefined): QuestionWaitsOn {
  if (!answer?.pick || isVoidedAnswer(answer)) return 'pick'
  if (question.needsSignature && !signatureStands(question, answer)) return 'signature'
  if (question.asksPhoto && answer.pick !== 'not_here' && !answer.photo) return 'photo'
  return null
}

export function questionAnswered(question: QuestionAsks, answer: StageChecklistAnswer | null | undefined): boolean {
  return questionWaitsOn(question, answer) === null
}

/** How a stage stands against its checklist: none to fill, filled, or not yet. */
export type StageChecklistStanding = 'none' | 'ready' | 'not_ready'

export interface StageChecklistState {
  kind: StageChecklistKind | null
  /** The live questions for the stage's kind, less any skipped on it. 0 when the stage has no checklist. */
  asked: number
  answered: number
  standing: StageChecklistStanding
  /** True unless the stage has a checklist with a question left. The Pipeline's one more state is `!ready`. */
  ready: boolean
  /** The open requests on the stage's checks with Dispatch (punch list #245, PR 3), when the read carried them: the flag on the Pipeline's mark. */
  withDispatch?: number
}

export interface StageChecklistStateInput {
  stageName: string | null | undefined
  /** The stage's id, so the items added for it count (#237); without it the company's questions alone. */
  fixtureId?: string | null
  /** Every live question, any kind; the stage's own are picked out by its kind and its id. */
  questions: readonly StageChecklistQuestion[]
  /** The stage's answers, by question id. */
  answers: ReadonlyMap<string, StageChecklistAnswer> | readonly StageChecklistAnswer[]
}

function answersById(answers: StageChecklistStateInput['answers']): ReadonlyMap<string, StageChecklistAnswer> {
  if (answers instanceof Map) return answers
  return liveAnswersById(answers as readonly StageChecklistAnswer[])
}

/** The live answer of each question, by question id: a row taken back is left out, so the question reads unanswered. */
export function liveAnswersById<A extends StageChecklistAnswer>(answers: readonly A[]): Map<string, A> {
  return new Map(answers.filter((a) => !isVoidedAnswer(a)).map((a) => [a.questionId, a]))
}

/** The answers taken back on one question, oldest first: the *Taken back* lines under its row. */
export function voidedAnswersOf<A extends StageChecklistAnswer>(answers: readonly A[], questionId: string): A[] {
  return answers.filter((a) => a.questionId === questionId && isVoidedAnswer(a)).sort((a, b) => (a.voided?.at ?? '').localeCompare(b.voided?.at ?? ''))
}

export function stageChecklistState(input: StageChecklistStateInput): StageChecklistState {
  const kind = stageChecklistKindOf(input.stageName)
  const template = kind ? templateFor(input.questions, kind, input.fixtureId) : []
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
    .map((s) => ({ ...s, state: stageChecklistState({ stageName: s.name, fixtureId: s.fixtureId, questions, answers: answersByFixture.get(s.fixtureId) ?? [] }) }))
}

/** True when any of the job's stages has a checklist, filled or not: the strip has something to show. */
export function jobHasChecklists(stages: readonly JobStageChecklist[]): boolean {
  return stages.some((s) => s.state.standing !== 'none')
}

// ── The sheet's second pass (#237): one row open at a time ───────────────────

/** Where a stage's list stands: the counts, what is left, and the next question to answer. */
export interface ChecklistProgress {
  asked: number
  answered: number
  left: number
  /** The first question not yet answered, the sheet's one open row; null when every row is answered or none is asked. */
  next: StageChecklistQuestion | null
  /** True when the list has questions and every one is answered. */
  complete: boolean
}

export function checklistProgress(template: readonly StageChecklistQuestion[], answers: ReadonlyMap<string, StageChecklistAnswer> | readonly StageChecklistAnswer[]): ChecklistProgress {
  const byId = answersById(answers)
  const answered = template.filter((q) => questionAnswered(q, byId.get(q.id))).length
  const next = template.find((q) => !questionAnswered(q, byId.get(q.id))) ?? null
  return { asked: template.length, answered, left: template.length - answered, next, complete: template.length > 0 && next == null }
}

/** The line under the sheet's title: *2 of 5 answered · 3 left*, *5 of 5 answered*, or *No questions yet*. */
export function progressWords(p: Pick<ChecklistProgress, 'asked' | 'answered' | 'left'>): string {
  if (p.asked === 0) return 'No questions yet'
  if (p.left === 0) return `${p.asked} of ${p.asked} answered`
  return `${p.answered} of ${p.asked} answered · ${p.left} left`
}

/** *2 of 2* or *none*, after a group's heading. */
export function groupCountWords(p: Pick<ChecklistProgress, 'asked' | 'answered'>): string {
  return p.asked === 0 ? 'none' : `${p.answered} of ${p.asked}`
}

// ── The stamp (#237): the name and the time on every row ─────────────────────

/** *Luis Ortega · Nov 1 · 9:14 am*, the company's day and clock; the name alone without a time; *someone* without a name. */
export function stampWords(name: string | null | undefined, atIso: string | null | undefined): string {
  const who = (name ?? '').trim() || 'someone'
  const ms = atIso ? Date.parse(atIso) : NaN
  if (!Number.isFinite(ms)) return who
  return `${who} · ${formatDenverCalendarDayShort(ms)} · ${formatDenverTimeOnly(ms).toLowerCase()}`
}

/** The stamp on an answered row, or '' while the row has no pick. */
export function answerStampWords(answer: Pick<StageChecklistAnswer, 'pick' | 'answeredBy' | 'answeredAt'> | null | undefined): string {
  if (!answer?.pick) return ''
  return stampWords(answer.answeredBy, answer.answeredAt)
}

/** Under an item added for the job: *Added by Pat Sample · Nov 1*; *You added this · Nov 1* for the adder; '' on a company question. */
export function addedByWords(q: Pick<StageChecklistQuestion, 'fixtureId' | 'addedBy' | 'addedAt' | 'addedById'>, viewerId?: string | null): string {
  if (!isJobItem(q)) return ''
  const ms = q.addedAt ? Date.parse(q.addedAt) : NaN
  const day = Number.isFinite(ms) ? ` · ${formatDenverCalendarDayShort(ms)}` : ''
  if (viewerId && q.addedById === viewerId) return `You added this${day}`
  const name = (q.addedBy ?? '').trim()
  return name ? `Added by ${name}${day}` : `Added for this job${day}`
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

/** What the sheet says for a stage whose kind has no questions yet and no item added for it. */
export function noQuestionsWords(stageName: string): string {
  const kind = stageChecklistKindOf(stageName)
  if (!kind) return `${stageName} has no checklist. Checklists are for Rough In, Top Out and Trim Set.`
  return `No questions for ${STAGE_CHECKLIST_KIND_NAMES[kind]} yet. The office writes them on Settings, under Jobs, bills and liens.`
}

/** What a question row says it still waits on. */
export function waitsOnWords(waits: QuestionWaitsOn): string {
  return waits === 'pick' ? 'Pick Yes, No or Not here.' : waits === 'signature' ? 'Sign the answer. This one needs a signature.' : waits === 'photo' ? 'Take the photo this one asks for.' : ''
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
