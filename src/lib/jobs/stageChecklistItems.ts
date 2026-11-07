/**
 * Stage checklist items on the job (punch list #237, PR 1): beside the company's questions, a check added for one
 * job's stage by the office or the job's superintendent, and the words the sheet and the Documents tab's read-out
 * draw for them. The owner, 2026-11-01: a superintendent adds items to a checklist, the office adds items and reads
 * the checklist on the job's Documents tab, and every answer stamps its row with the name and the time.
 *
 * Who adds: the office set (dev, master, assistant, controller) anywhere, a superintendent on their own job and, since
 * PR 1b, an estimator on a job they priced. The technician answers and notes; they do not add. Who takes off: the adder
 * or the office. An item taken off is retired, never deleted, so an answer it already has stays. A job item counts
 * toward ready like a company question (`stageChecklist.ts`), so an item added after a stage read ready flips it back,
 * which is the point.
 *
 * What the walks added (PR 1b, v2.6347). The estimator authors too, on the jobs he priced. Authors skip a company
 * question on this job with a reason, put it back, and put the job's own checks in order. The office adds one job
 * item to the company's list. A check can name its plan sheet and say why it is there, and the add box stays open for
 * the next one. Who authors on a job is the database's one answer, `stage_checklist_may_author`; the role only says who
 * may ever ask.
 *
 * Authoring on Documents (PR 4, v2.6581). The company's questions are written here too, by the office alone: the add box
 * takes a scope, this job or every stage of the kind in the company; a company question comes off the company's list with
 * a reason and goes up or down the company's order with the same arrows; and *Use as the company's list* adds a job's
 * whole list at once, doing what is ready and naming what it held. Settings → Stage checklists reads the list back and
 * says which job each question came from (`stageChecklistEditor.ts`).
 *
 * Pure; the io is `stageChecklistIo.ts`.
 */
import type { UserRole } from '../../hooks/useAuth'
import { batchOutcomeWords, countedLabel } from '../batchWords'
import { jobDocumentFolderLinks } from './jobDocumentsTab'
import { QUESTION_MAX_CHARS, addedByWords, answerStampWords, isJobItem, questionWaitsOn, signatureStands, skipOn, stampWords, type JobStageChecklist, type QuestionAsks, type StageChecklistAnswer, type StageChecklistQuestion, type StageChecklistSkip, type StageChecklistState } from './stageChecklist'
import { NEEDS_SIGNATURE_WORDS } from './stageChecklistSignature'

/** The office set that adds and takes off a check anywhere, and writes the company's questions. */
const OFFICE: ReadonlySet<string> = new Set<UserRole>(['dev', 'master_technician', 'assistant', 'controller'])

/** The two roles authoring reaches past the office, on their own jobs alone. Both have the read-only job pane, with no Documents tab. */
const isFieldAuthorRole = (role: UserRole | null | undefined): boolean => role === 'superintendent' || role === 'estimator'

/** True when the read should ask the database whether this person authors on this job: nobody else's answer depends on the job. */
export function asksMayAuthor(role: UserRole | null | undefined): boolean {
  return isFieldAuthorRole(role)
}

/**
 * True when this person adds, skips and orders the checks on this job: the office anywhere, a superintendent on their
 * own job, an estimator on a job they priced. `mayAuthor` is the database's answer for this job; the office's press
 * does not wait on it. Primaries and the crew never author.
 */
export function canAuthorOnJob(role: UserRole | null | undefined, mayAuthor: boolean | null | undefined): boolean {
  if (role != null && OFFICE.has(role)) return true
  return isFieldAuthorRole(role) && mayAuthor === true
}

/**
 * True when the strip lists a stage that takes a checklist but has no question yet. A superintendent or an estimator
 * who may author on this job: the sheet is their one door, since the read-only job pane has no Documents tab. The
 * office adds from Documents, so its job window stands as before until a stage has a question, and the crew has
 * nothing to answer.
 */
export function stripListsEmptyStage(role: UserRole | null | undefined, mayAuthor: boolean | null | undefined): boolean {
  return isFieldAuthorRole(role) && mayAuthor === true
}

/** The strip's line under a stage with nothing to answer: a stage whose every question is skipped says so. */
export function stripEmptyStageWords(skippedCount: number): string {
  return skippedCount > 0 ? 'Every question is skipped on this job. Add a check if this job needs one.' : 'No questions yet. Add a check for this job.'
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

/** The longest plan sheet and why a check keeps, in characters (the migration's checks). */
export const PLAN_SHEET_MAX_CHARS = 40
export const ITEM_WHY_MAX_CHARS = 80

/** A short line as the row keeps it: trimmed, one-spaced, cut to its length, null when empty. */
export function cleanShortLine(raw: string | null | undefined, max: number): string | null {
  const clean = (raw ?? '').trim().replace(/\s+/g, ' ').slice(0, max).trim()
  return clean || null
}

/** The add box's words, in the stage's name. */
export function addCheckWords(stageName: string): { press: string; title: string; hint: string; confirm: string; done: string; placeholder: string; photo: string; signature: string; signatureHint: string; sheet: string; sheetPlaceholder: string; why: string; whyPlaceholder: string } {
  return {
    press: `+ Add a check for ${stageName}`,
    title: `Add a check for ${stageName} on this job`,
    hint: `The crew sees it on this job's ${stageName} sheet now. It counts toward ready like the company's questions. You can take it off later, and an answer it already has stays.`,
    confirm: 'Add the check',
    done: 'Done adding',
    placeholder: 'The question the crew answers',
    photo: 'Asks for a photo',
    signature: NEEDS_SIGNATURE_WORDS.label,
    signatureHint: NEEDS_SIGNATURE_WORDS.hint,
    sheet: 'The plan sheet it comes from, if any',
    sheetPlaceholder: 'Plan sheet, like P-201 detail 4',
    why: 'Why this check, if you want to say',
    whyPlaceholder: 'Why, like the slab pours Thursday',
  }
}

/** The add box's tally, once it has added any: *2 added*. */
export function addedSoFarWords(count: number): string {
  return count > 0 ? `${count} added` : ''
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

/** Under an item's words: who added it and when, then why it is there. '' on a company question. */
export function itemMetaWords(q: Pick<StageChecklistQuestion, 'fixtureId' | 'addedBy' | 'addedAt' | 'addedById' | 'why'>, viewerId?: string | null): string {
  if (!isJobItem(q)) return ''
  return [addedByWords(q, viewerId), (q.why ?? '').trim()].filter(Boolean).join(' · ')
}

// ── The plan-sheet chip ──────────────────────────────────────────────────────

/** The address the chip opens: the job's Plans folder when it is a web address, or null, and the chip is words alone. */
export function plansDoorUrl(rawPlansLink: string | null | undefined): string | null {
  return jobDocumentFolderLinks({ job_plans_link: rawPlansLink })[0]?.url ?? null
}

// ── Skip on this job ─────────────────────────────────────────────────────────

/** The shortest and the longest reason a skip keeps, in characters (the migration's check). */
export const SKIP_WHY_MIN_CHARS = 3
export const SKIP_WHY_MAX_CHARS = 200

/** True when this person may skip this question here: an author, on a question from the company's list. */
export function canSkipQuestion(canAuthor: boolean, q: Pick<StageChecklistQuestion, 'fixtureId'>): boolean {
  return canAuthor && !isJobItem(q)
}

/** What stops a skip, in words, or null: it needs its reason. */
export function skipProblem(why: string): string | null {
  return why.trim().length < SKIP_WHY_MIN_CHARS ? 'Say why this question is not on this job.' : null
}

/** The skip's words, in the stage's name. */
export function skipWords(stageName: string): { press: string; hint: string; label: string; placeholder: string; confirm: string; keep: string; heading: string; putBack: string } {
  return {
    press: 'Skip on this job',
    hint: `The company's ${stageName} list stays whole. Say why this question is not on this job.`,
    label: 'Why this question is not on this job',
    placeholder: 'Why, like the owner took these out',
    confirm: 'Skip on this job',
    keep: 'Keep it',
    heading: 'Skipped on this job',
    putBack: 'Put it back',
  }
}

/** A skipped line's second row: who, when and why. */
export function skippedLineWords(skip: Pick<StageChecklistSkip, 'by' | 'at' | 'why'>): string {
  return `${stampWords(skip.by, skip.at)} · ${skip.why.trim()}`
}

function countWords(stageName: string, state: Pick<StageChecklistState, 'asked' | 'answered'>): string {
  return state.asked === 0 ? `${stageName} has nothing left to answer.` : `${stageName} is now ${state.answered} of ${state.asked}.`
}

/** The toast once a question is skipped: *Skipped on this job. Trim Set is now 2 of 3.* */
export function skippedToastWords(stageName: string, state: Pick<StageChecklistState, 'asked' | 'answered'>): string {
  return `Skipped on this job. ${countWords(stageName, state)}`
}

/** The toast once a question is put back: *Put back. Trim Set is now 2 of 4.* */
export function putBackToastWords(stageName: string, state: Pick<StageChecklistState, 'asked' | 'answered'>): string {
  return `Put back. ${countWords(stageName, state)}`
}

/** What a put back the database filtered away says: no error and no row is a refusal, not a save. */
export const PUT_BACK_REFUSED = 'That question was not put back. It may be back already, or this job may not be yours to change.'

// ── Add to the company's list ────────────────────────────────────────────────

/** True when this person may add this check to the company's list: the office alone, one job item at a time. */
export function canPromoteJobItem(role: UserRole | null | undefined, q: Pick<StageChecklistQuestion, 'fixtureId'>): boolean {
  return role != null && OFFICE.has(role) && isJobItem(q)
}

/** The two-press promote: it reaches every job of the kind, so the hint says so before the confirm. */
export function promoteWords(stageName: string, q: Pick<StageChecklistQuestion, 'sheet' | 'why'>): { press: string; hint: string; confirm: string; keep: string; toast: string } {
  const left = (q.sheet ?? '').trim() || (q.why ?? '').trim() ? ' Its plan sheet and its why are left off, since they were written for this job.' : ''
  return {
    press: "Add to the company's list",
    hint: `Every ${stageName} in the company asks this from now on. This job keeps its answer.${left}`,
    confirm: `Add to every ${stageName}`,
    keep: 'Keep it on this job',
    toast: `Added to the company's list. Every ${stageName} asks it from now on.`,
  }
}

// ── The order of a stage's own checks ────────────────────────────────────────

export const MOVE_WORDS = { up: 'Move up', down: 'Move down' } as const

/** The group's ids with one moved a place up or down; null at either end or for an id not in it. */
export function movedOrder(group: ReadonlyArray<Pick<StageChecklistQuestion, 'id'>>, id: string, by: -1 | 1): string[] | null {
  const from = group.findIndex((q) => q.id === id)
  const to = from + by
  if (from < 0 || to < 0 || to >= group.length) return null
  const ids = group.map((q) => q.id)
  ids.splice(from, 1)
  ids.splice(to, 0, id)
  return ids
}

/** The questions the ids name, each at its new place, as the database numbers them: 1, 2, 3. */
export function withOrder(questions: readonly StageChecklistQuestion[], ids: readonly string[]): StageChecklistQuestion[] {
  const byId = new Map(questions.map((q) => [q.id, q]))
  return ids.flatMap((id, i) => {
    const q = byId.get(id)
    return q ? [{ ...q, order: i + 1 }] : []
  })
}

/** A new check's place: after every check on its stage, whatever order they were put in. */
export function nextItemOrder(questions: ReadonlyArray<Pick<StageChecklistQuestion, 'fixtureId' | 'order'>>, fixtureId: string): number {
  return questions.reduce((most, q) => (q.fixtureId === fixtureId ? Math.max(most, q.order) : most), 0) + 1
}

// ── The Documents tab's read-out ─────────────────────────────────────────────

export type StandingTone = 'green' | 'amber' | 'muted'

/** The chip after a stage's name on the read-out: *Ready · 4 of 4*, *Not ready · 3 of 6*, *No questions yet*, *Nothing to answer · 2 skipped*. */
export function stageStandingChip(state: Pick<StageChecklistState, 'standing' | 'asked' | 'answered'>, skippedCount = 0): { words: string; tone: StandingTone } {
  if (state.standing === 'none') return { words: skippedCount > 0 ? `Nothing to answer · ${skippedCount} skipped` : 'No questions yet', tone: 'muted' }
  if (state.standing === 'ready') return { words: `Ready · ${state.answered} of ${state.asked}`, tone: 'green' }
  return { words: `Not ready · ${state.answered} of ${state.asked}`, tone: 'amber' }
}

/** The line under the section's heading: *2 of 3 stages ready · 5 items added on this job · 1 skipped*; '' with no checklist on any stage. */
export function checklistsSummary(rows: readonly JobStageChecklist[], questions: readonly StageChecklistQuestion[]): string {
  const withList = rows.filter((r) => r.state.standing !== 'none')
  if (withList.length === 0) return ''
  const ready = withList.filter((r) => r.state.standing === 'ready').length
  const stages = withList.length === 1 ? 'stage' : 'stages'
  const stageIds = new Set(rows.map((r) => r.fixtureId))
  const items = questions.filter((q) => isJobItem(q) && stageIds.has(q.fixtureId!)).length
  const added = items === 0 ? 'nothing added on this job' : items === 1 ? '1 item added on this job' : `${items} items added on this job`
  const skipped = rows.reduce((n, r) => n + questions.filter((q) => skipOn(q, r.fixtureId) != null).length, 0)
  return `${ready} of ${withList.length} ${stages} ready · ${added}${skipped > 0 ? ` · ${skipped} skipped` : ''}`
}

/** The read-out row's standing: the pick's word, or *open* for a row not yet answered; *Yes, not signed yet* and *Yes, no photo yet* for what it still owes. */
export function rowPickWords(q: QuestionAsks, a: StageChecklistAnswer | null | undefined): string {
  const waits = questionWaitsOn(q, a)
  if (!a?.pick || waits === 'pick') return 'open'
  if (waits === 'signature') return `${pickWord(a.pick)}, not signed yet`
  if (waits === 'photo') return `${pickWord(a.pick)}, no photo yet`
  return pickWord(a.pick)
}

/** The read-out's tag on a signature item: *needs a signature* while unsigned, *signed* once the signature stands, null on any other row. */
export function rowSignatureTag(q: Pick<StageChecklistQuestion, 'needsSignature' | 'words'>, a: StageChecklistAnswer | null | undefined): { words: string; signed: boolean } | null {
  if (signatureStands(q, a)) return { words: NEEDS_SIGNATURE_WORDS.signed, signed: true }
  return q.needsSignature ? { words: NEEDS_SIGNATURE_WORDS.tag, signed: false } : null
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

/** The foot under the read-out: what the words mean, and where the company's questions are written now (PR 4). */
export const READOUT_FOOT = 'A No or a Not here is an answer. Open is what holds a stage. The company’s questions are written here too: pick the company on the add box. Settings → Jobs, bills and liens → Stage checklists reads them back.'

// ── The company's list on Documents (PR 4) ──────────────────────────────────

/** Where a new check goes: this job's stage, or the company's list for every stage of the kind. */
export type AddScope = 'job' | 'company'

/** True when this person writes the company's list from a job: the office alone, whatever the job says. */
export function canWriteCompanyList(role: UserRole | null | undefined): boolean {
  return role != null && OFFICE.has(role)
}

/** The add box's scope pick: the two labels and what the company one does. */
export function addScopeWords(stageName: string): { label: string; job: string; company: string; companyHint: string; companyConfirm: string } {
  return {
    label: 'Where the check goes',
    job: 'This job',
    company: `Every ${stageName} in the company`,
    companyHint: `Every ${stageName} in the company asks it from now on. A stage that read ready on another job reads not ready until the crew answers it. A plan sheet and a why are for one job, so the box does not ask for them.`,
    companyConfirm: `Add to every ${stageName}`,
  }
}

/** The toast once a company question is added from a job: *Added to the company's list. Every Trim Set asks it from now on.* */
export function addedCompanyWords(stageName: string): string {
  return `Added to the company's list. Every ${stageName} asks it from now on.`
}

/** A new company question's place: after every live company question of its kind. */
export function nextCompanyOrder(questions: ReadonlyArray<Pick<StageChecklistQuestion, 'kind' | 'fixtureId' | 'order'>>, kind: StageChecklistQuestion['kind']): number {
  return questions.reduce((most, q) => (q.kind === kind && !isJobItem(q) ? Math.max(most, q.order) : most), 0) + 1
}

/** True when this person may take this question off the company's list here: the office, on a company question. */
export function canTakeOffCompanyQuestion(role: UserRole | null | undefined, q: Pick<StageChecklistQuestion, 'fixtureId'>): boolean {
  return canWriteCompanyList(role) && !isJobItem(q)
}

/** The shortest and the longest reason a company take-off keeps, in characters (the migration's check). */
export const COMPANY_TAKE_OFF_WHY_MIN_CHARS = 3
export const COMPANY_TAKE_OFF_WHY_MAX_CHARS = 200

/** What stops a company take-off, in words, or null: it needs its reason. */
export function companyTakeOffProblem(why: string): string | null {
  return why.trim().length < COMPANY_TAKE_OFF_WHY_MIN_CHARS ? 'Say why this question comes off the company’s list.' : null
}

/** The two-press take-off of a company question, in the stage's name, and what a write the database refused says. */
export function companyTakeOffWords(stageName: string): { press: string; hint: string; label: string; placeholder: string; confirm: string; keep: string; refused: string } {
  return {
    press: "Take off the company's list",
    hint: `Every ${stageName} in the company stops asking it. The app keeps every answer it already has. Say why.`,
    label: 'Why this question comes off the company’s list',
    placeholder: 'Why, like the inspector no longer asks for it',
    confirm: `Take it off every ${stageName}`,
    keep: 'Keep it',
    refused: 'Only the office takes a question off the company’s list.',
  }
}

/** The toast once a company question is taken off: *Taken off the company's list. Trim Set is now 2 of 3.* */
export function companyTakenOffWords(stageName: string, state: Pick<StageChecklistState, 'asked' | 'answered'>): string {
  return `Taken off the company's list. ${countWords(stageName, state)}`
}

/** True when this person moves the company's questions with the arrows: the office, on a list with two or more. */
export function canMoveCompanyQuestions(role: UserRole | null | undefined, companyCount: number): boolean {
  return canWriteCompanyList(role) && companyCount > 1
}

/** True when the group head offers the whole list to the company: the office, with two or more of the job's own checks (one has its own press). */
export function canUseAsCompanyList(role: UserRole | null | undefined, jobItemCount: number): boolean {
  return canWriteCompanyList(role) && jobItemCount > 1
}

/** *Use as the company's list*: the press, the hint and the counted confirm, in the stage's name. */
export function companyListFromJobWords(stageName: string, jobItemCount: number): { press: string; hint: string; confirm: string; keep: string } {
  return {
    press: `Use as the company's ${stageName} list`,
    hint: `Every ${stageName} in the company asks these ${jobItemCount} checks from now on, after the company's own questions. This job keeps its answers. Plan sheets and whys are left off, since they were written for this job. A check the company's list already asks stays on this job and is named.`,
    confirm: `${countedLabel('Add', jobItemCount, 'check')} to every ${stageName}`,
    keep: 'Keep them on this job',
  }
}

/** After *Use as the company's list* ran past its refusals: the toast, and the line over the checks that stayed, in `batchOutcomeWords`' shape. */
export function companyListFromJobOutcome(done: number, failed: number): { line: string; head: string | null; tone: 'success' | 'warning' | 'error' } {
  return batchOutcomeWords({ verb: 'add', past: 'Added', done, failed, noun: 'check' })
}

