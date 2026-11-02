/**
 * Stage checklist items on the job (punch list #237, PR 1): beside the company's questions, a check added for one
 * job's stage by the office or the job's superintendent, and the words the sheet and the Documents tab's read-out
 * draw for them. The owner, 2026-11-01: a superintendent adds items to a checklist, the office adds items and reads
 * the checklist on the job's Documents tab, and every answer stamps its row with the name and the time.
 *
 * Who adds: the office set (dev, master, assistant, controller) and a superintendent on their own job; the database
 * holds the superintendent to the jobs assigned to them, so the press is drawn for the role and a refusal reads its
 * reason. The technician answers and notes; they do not add. Who takes off: the adder or the office. An item taken
 * off is retired, never deleted, so an answer it already has stays. A job item counts toward ready like a company
 * question (`stageChecklist.ts`), so an item added after a stage read ready flips it back, which is the point.
 *
 * Pure; the io is `stageChecklistIo.ts` (`addJobItem`, `retireJobItem`).
 */
import type { UserRole } from '../../hooks/useAuth'
import { QUESTION_MAX_CHARS, answerStampWords, isJobItem, questionAnswered, type JobStageChecklist, type StageChecklistAnswer, type StageChecklistQuestion, type StageChecklistState } from './stageChecklist'

/** The office set that adds and takes off a check anywhere, and writes the company's questions. */
const OFFICE: ReadonlySet<string> = new Set<UserRole>(['dev', 'master_technician', 'assistant', 'controller'])

/** True for the roles that add a check for a job's stage: the office, and a superintendent on their own job. */
export function canAddJobItem(role: UserRole | null | undefined): boolean {
  return role != null && (OFFICE.has(role) || role === 'superintendent')
}

/**
 * True when the strip lists a stage that takes a checklist but has no question yet. The superintendent alone: the
 * sheet is their one door, since the read-only job pane has no Documents tab. The office adds from Documents, so its
 * job window stands as before until a stage has a question, and the crew has nothing to answer.
 */
export function stripListsEmptyStage(role: UserRole | null | undefined): boolean {
  return role === 'superintendent'
}

/** True when this person may take the item off: the office, or whoever added it. */
export function canTakeOffJobItem(role: UserRole | null | undefined, item: Pick<StageChecklistQuestion, 'fixtureId' | 'addedById'>, userId: string | null | undefined): boolean {
  if (!isJobItem(item)) return false
  if (role != null && OFFICE.has(role)) return true
  return Boolean(userId) && item.addedById === userId
}

/** What stops an add, in words, or null: no words, or too many. */
export function jobItemProblem(words: string): string | null {
  const clean = words.trim()
  if (!clean) return 'Type the check as a question the crew answers with Yes, No or Not here.'
  if (clean.length > QUESTION_MAX_CHARS) return `The check is over ${QUESTION_MAX_CHARS} characters. Shorten it.`
  return null
}

/** The words typed, trimmed and one-spaced, as the row keeps them. */
export function cleanItemWords(words: string): string {
  return words.trim().replace(/\s+/g, ' ')
}

/** The add box's words, in the stage's name. */
export function addCheckWords(stageName: string): { press: string; title: string; hint: string; confirm: string; cancel: string; placeholder: string; photo: string } {
  return {
    press: `+ Add a check for ${stageName}`,
    title: `Add a check for ${stageName} on this job`,
    hint: `The crew sees it on this job's ${stageName} sheet now. It counts toward ready like the company's questions. You can take it off later, and an answer it already has stays.`,
    confirm: 'Add the check',
    cancel: 'Not now',
    placeholder: 'The question the crew answers',
    photo: 'Asks for a photo',
  }
}

/** The toast once a check is added: *Added. Trim Set is now 3 of 6.* */
export function addedWords(stageName: string, state: Pick<StageChecklistState, 'asked' | 'answered'>): string {
  return `Added. ${stageName} is now ${state.answered} of ${state.asked}.`
}

/** The two-press take off: the link, the hint, the confirm and the keep, and what a write the database refused says. */
export const TAKE_OFF_WORDS = {
  press: 'Take off',
  hint: 'The crew stops seeing it. The app keeps any answer it already has.',
  confirm: 'Take it off',
  keep: 'Keep it',
  refused: 'Only the person who added it or the office can take it off.',
} as const

/** The toast once a check is taken off: *Taken off. Trim Set is now 3 of 5.* */
export function takenOffWords(stageName: string, state: Pick<StageChecklistState, 'asked' | 'answered'>): string {
  return `Taken off. ${stageName} is now ${state.answered} of ${state.asked}.`
}

/** The two group headings on the sheet and the read-out. */
export const GROUP_WORDS = { company: "The company's questions", job: 'Added for this job' } as const

/** Under an empty *Added for this job* group. */
export function noJobItemsWords(stageName: string, canAdd: boolean): string {
  const base = `Nothing added for this job's ${stageName}.`
  return canAdd ? base : `${base} The superintendent or the office adds one.`
}

// ── The Documents tab's read-out ─────────────────────────────────────────────

export type StandingTone = 'green' | 'amber' | 'muted'

/** The chip after a stage's name on the read-out: *Ready · 4 of 4*, *Not ready · 3 of 6*, *No questions yet*. */
export function stageStandingChip(state: Pick<StageChecklistState, 'standing' | 'asked' | 'answered'>): { words: string; tone: StandingTone } {
  if (state.standing === 'none') return { words: 'No questions yet', tone: 'muted' }
  if (state.standing === 'ready') return { words: `Ready · ${state.answered} of ${state.asked}`, tone: 'green' }
  return { words: `Not ready · ${state.answered} of ${state.asked}`, tone: 'amber' }
}

/** The line under the section's heading: *2 of 3 stages ready · 5 items added on this job*; '' with no checklist on any stage. */
export function checklistsSummary(rows: readonly JobStageChecklist[], questions: readonly StageChecklistQuestion[]): string {
  const withList = rows.filter((r) => r.state.standing !== 'none')
  if (withList.length === 0) return ''
  const ready = withList.filter((r) => r.state.standing === 'ready').length
  const stages = withList.length === 1 ? 'stage' : 'stages'
  const stageIds = new Set(rows.map((r) => r.fixtureId))
  const items = questions.filter((q) => isJobItem(q) && stageIds.has(q.fixtureId!)).length
  const added = items === 0 ? 'nothing added on this job' : items === 1 ? '1 item added on this job' : `${items} items added on this job`
  return `${ready} of ${withList.length} ${stages} ready · ${added}`
}

/** The read-out row's standing: the pick's word, or *open* for a row not yet answered. */
export function rowPickWords(q: Pick<StageChecklistQuestion, 'asksPhoto'>, a: StageChecklistAnswer | null | undefined): string {
  if (!a?.pick) return 'open'
  if (!questionAnswered(q, a)) return `${pickWord(a.pick)}, no photo yet`
  return pickWord(a.pick)
}

function pickWord(pick: NonNullable<StageChecklistAnswer['pick']>): string {
  return pick === 'yes' ? 'Yes' : pick === 'no' ? 'No' : 'Not here'
}

/** The glyph before a read-out row: ✓ ✗ — or ☐ while open. */
export function rowGlyph(a: StageChecklistAnswer | null | undefined): string {
  if (!a?.pick) return '☐'
  return a.pick === 'yes' ? '✓' : a.pick === 'no' ? '✗' : '—'
}

/** True when the read-out tags a row *asks for a photo*: no photo yet, and not a Not here, which needs none. */
export function rowAsksPhotoTag(q: Pick<StageChecklistQuestion, 'asksPhoto'>, a: Pick<StageChecklistAnswer, 'pick' | 'photo'> | null | undefined): boolean {
  return q.asksPhoto && !a?.photo && a?.pick !== 'not_here'
}

/** The read-out row's second line: the stamp, the note in quotes, and where the photo is. */
export function rowMetaWords(a: StageChecklistAnswer | null | undefined): string {
  if (!a?.pick) return ''
  const parts = [answerStampWords(a)]
  if (a.note.trim()) parts.push(`“${a.note.trim()}”`)
  if (a.photo) parts.push(a.photo.state === 'filed' ? 'photo in Drive' : a.photo.state === 'failed' ? 'photo not filed yet' : 'photo on its way to Drive')
  return parts.join(' · ')
}

/** The foot under the read-out: what the words mean. */
export const READOUT_FOOT = 'A No or a Not here is an answer. Open is what holds a stage. The company’s questions are written once on Settings, under Jobs and billing.'
