/**
 * Settings → Jobs, bills and liens → Stage checklists (punch list #164, PR 2; read-only since punch list #237, PR 4). The card
 * was the office's editor for the company's questions, three lists the office typed in order. Since PR 4 the questions
 * are written on a job's Documents tab, where the answers are read, and this card is a mirror: the company's live
 * questions per kind, each with its photo and signature asks and a source line that says which job it came from
 * (`promoted_from`, the job item a company row was added to the company's list from) or who wrote it, and under each
 * kind the questions taken off the company's list with who, when and why. The card goes in a later release.
 *
 * Pure; `stageChecklistIo.ts` reads the mirror.
 */
import { formatDenverCalendarDayShort, formatDenverTimeOnly } from '../../utils/dateUtils'
import { STAGE_CHECKLIST_KIND_NAMES, isJobItem, stampWords, type StageChecklistKind, type StageChecklistQuestion } from './stageChecklist'

export const EDITOR_TITLE = 'Stage checklists'
export const MIRROR_INTRO = 'The company’s questions are written on a job’s Documents tab now, where the answers are read. This card reads them back and says which job each came from.'
export const MIRROR_RULE = 'A stage reads not ready on the Pipeline until every question is answered. A stage kind with no questions has no checklist and reads as it does today. A question that needs a signature is answered only once the crew signs it.'
/** The press the empty kind points at, on the Documents tab. */
export const MIRROR_DOOR = 'Open a job with the stage, press Documents, and add a check with the company picked.'

/** Where a company question came from, as the mirror reads it beside the row. */
export interface QuestionSource {
  /** The job the question was added to the company's list from: *Job 1042 · Riders Walk*. Null on a question written for the company directly. */
  jobLabel: string | null
  /** Who wrote it, or who added it on the job it came from. */
  by: string
  /** When the company's row was made, ISO. */
  at: string | null
}

/** A company question taken off the company's list with a reason (#237 PR 4). */
export interface TakenOffQuestion {
  id: string
  kind: StageChecklistKind
  words: string
  by: string
  at: string | null
  why: string
}

/** What the mirror reads: the company's live questions, where each came from, and the ones taken off with a reason. */
export interface CompanyMirror {
  questions: StageChecklistQuestion[]
  sources: ReadonlyMap<string, QuestionSource>
  takenOff: TakenOffQuestion[]
}

/** The company's live questions of one kind in their order, never an item added for a job. */
export function companyQuestionsOf(questions: readonly StageChecklistQuestion[], kind: StageChecklistKind): StageChecklistQuestion[] {
  return questions.filter((q) => q.kind === kind && !isJobItem(q)).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

/** The words under a kind's heading: how many questions, how many ask for a photo, how many need a signature. */
export function kindSummary(questions: ReadonlyArray<Pick<StageChecklistQuestion, 'asksPhoto' | 'needsSignature'>>): string {
  const n = questions.length
  if (n === 0) return ''
  const photos = questions.filter((d) => d.asksPhoto).length
  const signed = questions.filter((d) => d.needsSignature === true).length
  const words = n === 1 ? '1 question' : `${n} questions`
  return [words, photos > 0 ? `${photos} with a photo` : '', signed > 0 ? `${signed} with a signature` : ''].filter(Boolean).join(', ')
}

/** The row's asks, as short tags: *asks for a photo*, *needs a signature*. */
export function questionTags(q: Pick<StageChecklistQuestion, 'asksPhoto' | 'needsSignature'>): string[] {
  return [q.asksPhoto ? 'asks for a photo' : '', q.needsSignature === true ? 'needs a signature' : ''].filter(Boolean)
}

/**
 * The source line under a company question: *From Job 1042 · Riders Walk, where Pat Sample added it · Nov 3 · 9:14 am*
 * for one added to the company's list from a job, *Written by Pat Sample · Nov 3 · 9:14 am* for one written for the
 * company on a job's Documents tab, *Written on Settings · Nov 3 · 9:14 am* for one the old editor saved with no name.
 */
export function sourceLineWords(source: QuestionSource | null | undefined): string {
  if (!source) return 'Written on Settings'
  const by = source.by.trim()
  const when = whenWords(source.at)
  if (source.jobLabel) return `From ${source.jobLabel}, where ${by || 'someone'} added it${when}`
  return by ? `Written by ${by}${when}` : `Written on Settings${when}`
}

/** * · Nov 3 · 9:14 am* after a name, or '' with no time. */
function whenWords(atIso: string | null | undefined): string {
  const ms = atIso ? Date.parse(atIso) : NaN
  if (!Number.isFinite(ms)) return ''
  return ` · ${formatDenverCalendarDayShort(ms)} · ${formatDenverTimeOnly(ms).toLowerCase()}`
}

/** A taken-off line: *Did the test hold? · Taken off by Pat Sample · Nov 5 · 10:20 am · “the inspector no longer asks”*. */
export function takenOffLineWords(row: Pick<TakenOffQuestion, 'words' | 'by' | 'at' | 'why'>): string {
  return `${row.words} · Taken off by ${stampWords(row.by, row.at)} · “${row.why.trim()}”`
}

/** The fold's summary under a kind: *Taken off · 2*; '' with none. */
export function takenOffSummary(count: number): string {
  return count > 0 ? `Taken off · ${count}` : ''
}

/** The empty kind's words: no questions yet, and the Documents tab is the door. */
export function emptyKindWords(kind: StageChecklistKind): string {
  return `No questions for ${STAGE_CHECKLIST_KIND_NAMES[kind]} yet.`
}
