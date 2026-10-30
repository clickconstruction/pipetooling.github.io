/**
 * A checklist per stage (punch list #164, PR 2): the office's editor, Settings → Jobs & billing → Stage checklists.
 * Three lists, one per stage kind, each a few questions the office types in order; a question may ask for a photo.
 * The editor ships with the three kinds listed and empty, by the owner's call: he writes the words himself, and no
 * placeholder question reaches prod. The checklists start the day the office types the questions.
 *
 * A save is planned as a diff against what the table holds (`planQuestionSave`): a new row is inserted, a changed one
 * updated, one taken off is retired (never deleted, so an answer already given keeps its words), and every live row
 * takes its place in the list as its sort order. Pure; `stageChecklistIo.ts` writes the plan.
 */
import { QUESTION_MAX_CHARS, STAGE_CHECKLIST_KIND_NAMES, type StageChecklistKind, type StageChecklistQuestion } from './stageChecklist'

/** A question as the editor holds it: `id` null until it is saved. */
export interface QuestionDraft {
  id: string | null
  words: string
  asksPhoto: boolean
}

export const EDITOR_TITLE = 'Stage checklists'
export const EDITOR_INTRO = 'The crew answers these questions on the phone for each stage of a job, Yes, No or Not here, with a note and a photo where a question asks for one.'
export const EDITOR_RULE = 'A stage reads not ready on the Pipeline until every question is answered. A stage kind with no questions has no checklist and reads as it does today.'
export const ADD_QUESTION = 'Add a question'
export const SAVE_QUESTIONS = 'Save the questions'
export const SAVED_TOAST = 'The questions are saved. The crew sees them on the next stage they open.'
export const NOT_SAVED = 'The questions were not saved.'

/** The drafts the table's live rows give, in order. */
export function draftsOf(questions: readonly StageChecklistQuestion[], kind: StageChecklistKind): QuestionDraft[] {
  return questions
    .filter((q) => q.kind === kind)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((q) => ({ id: q.id, words: q.words, asksPhoto: q.asksPhoto }))
}

/** The drafts with their words trimmed. */
export function cleanDrafts(drafts: readonly QuestionDraft[]): QuestionDraft[] {
  return drafts.map((d) => ({ id: d.id, words: d.words.trim().replace(/\s+/g, ' '), asksPhoto: d.asksPhoto }))
}

export function sameDrafts(a: readonly QuestionDraft[], b: readonly QuestionDraft[]): boolean {
  if (a.length !== b.length) return false
  return a.every((d, i) => d.id === b[i]!.id && d.words === b[i]!.words && d.asksPhoto === b[i]!.asksPhoto)
}

/** What stops a save, in words, or null: a question with no words, or one too long. */
export function editorProblem(kind: StageChecklistKind, drafts: readonly QuestionDraft[]): string | null {
  const name = STAGE_CHECKLIST_KIND_NAMES[kind]
  for (let i = 0; i < drafts.length; i += 1) {
    const words = drafts[i]!.words.trim()
    if (!words) return `Question ${i + 1} for ${name} has no words. Type the question or take it off.`
    if (words.length > QUESTION_MAX_CHARS) return `Question ${i + 1} for ${name} is over ${QUESTION_MAX_CHARS} characters. Shorten it.`
  }
  return null
}

/** The list with one draft moved up or down a place; the same list at either end. */
export function moveDraft(drafts: readonly QuestionDraft[], index: number, by: -1 | 1): QuestionDraft[] {
  const to = index + by
  if (index < 0 || index >= drafts.length || to < 0 || to >= drafts.length) return [...drafts]
  const out = [...drafts]
  const [d] = out.splice(index, 1)
  out.splice(to, 0, d!)
  return out
}

export interface QuestionSavePlan {
  inserts: { kind: StageChecklistKind; order: number; words: string; asksPhoto: boolean }[]
  updates: { id: string; order: number; words: string; asksPhoto: boolean }[]
  /** The ids of the live rows the drafts no longer hold. */
  retires: string[]
}

/** The writes that take the table from `before` (the kind's live rows) to the drafts, in order. */
export function planQuestionSave(kind: StageChecklistKind, before: readonly StageChecklistQuestion[], drafts: readonly QuestionDraft[]): QuestionSavePlan {
  const live = new Map(before.filter((q) => q.kind === kind).map((q) => [q.id, q]))
  const clean = cleanDrafts(drafts)
  const plan: QuestionSavePlan = { inserts: [], updates: [], retires: [] }
  const kept = new Set<string>()
  clean.forEach((d, i) => {
    const order = i + 1
    const was = d.id ? live.get(d.id) : undefined
    if (!d.id || !was) {
      plan.inserts.push({ kind, order, words: d.words, asksPhoto: d.asksPhoto })
      return
    }
    kept.add(d.id)
    if (was.order !== order || was.words !== d.words || was.asksPhoto !== d.asksPhoto) plan.updates.push({ id: d.id, order, words: d.words, asksPhoto: d.asksPhoto })
  })
  for (const id of live.keys()) if (!kept.has(id)) plan.retires.push(id)
  return plan
}

/** Whether a plan writes anything. */
export function planIsEmpty(plan: QuestionSavePlan): boolean {
  return plan.inserts.length === 0 && plan.updates.length === 0 && plan.retires.length === 0
}

/** The words under a kind's heading: how many questions, and whether a question asks for a photo. */
export function kindSummary(drafts: readonly QuestionDraft[]): string {
  const n = drafts.length
  if (n === 0) return ''
  const photos = drafts.filter((d) => d.asksPhoto).length
  const questions = n === 1 ? '1 question' : `${n} questions`
  return photos === 0 ? questions : `${questions}, ${photos} with a photo`
}
