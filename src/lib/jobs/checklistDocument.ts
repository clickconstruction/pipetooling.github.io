/**
 * Stage checklists as documents (design spike, punch list #237): a checklist on
 * a job stage is a record — its items (the company's for the stage kind, and
 * those added for this job), an answer per item stamped with who and when, a
 * signature where the item's author asked for one, and a record that files
 * itself when the last row is answered. Pure; the spike's store sits beside it.
 */
import { stageChecklistKindOf, type StageChecklistKind, STAGE_CHECKLIST_KIND_NAMES } from './stageChecklist'

export type { StageChecklistKind }
export { STAGE_CHECKLIST_KIND_NAMES }

export type ChecklistPick = 'yes' | 'no' | 'not_here'
export const PICK_WORDS: Record<ChecklistPick, string> = { yes: 'Yes', no: 'No', not_here: 'Not here' }
export const PICK_GLYPH: Record<ChecklistPick, string> = { yes: '✓', no: '✗', not_here: '—' }

export type ChecklistItem = {
  id: string
  /** The company's list for every stage of this kind, or a check for one job's stage. */
  scope: 'company' | 'job'
  kind: StageChecklistKind
  /** The stage the check was added for (job scope). */
  fixtureId: string | null
  words: string
  /** The plan sheet or detail the check came from (`P-201 · detail 4`), so the crew can open it. */
  sheet: string | null
  needsSignature: boolean
  asksPhoto: boolean
  addedBy: string
  addedAt: string
  /** The one-line reason the check is here (`the slab pours Thursday`). */
  why: string | null
  retiredAt: string | null
  retiredBy: string | null
  retiredWhy: string | null
  /** Order among the job's checks on this stage; company checks keep their added order. */
  order: number
}

/** A company check that does not apply on one job's stage: skipped there with who and why; the company's list stays whole. */
export type ChecklistSkip = { itemId: string; fixtureId: string; by: string; at: string; why: string }

/** An answer taken back keeps its mark: the voided row, with who took it back and why. */
export type ChecklistVoided = { answer: ChecklistAnswer; by: string; at: string; why: string }

export type ChecklistSignature = { mode: 'type' | 'draw'; printedName: string; pngDataUrl: string | null; at: string }

export type ChecklistAnswer = {
  itemId: string
  fixtureId: string
  pick: ChecklistPick
  note: string
  by: string
  at: string
  signature: ChecklistSignature | null
  photoTakenAt: string | null
}

/** A filed record: the list as it stood at the last answer, numbered per job. */
export type ChecklistRecord = { fixtureId: string; version: number; recordNo: number; filedAt: string; answerCount: number; signedCount: number }

export type ChecklistWho = { userId: string | null; name: string }

/** The live items for a stage: the company's for its kind, then those added for this job's stage, each in the order added. */
export function itemsForStage(items: readonly ChecklistItem[], kind: StageChecklistKind, fixtureId: string): ChecklistItem[] {
  const live = items.filter((i) => i.retiredAt == null && i.kind === kind && (i.scope === 'company' || i.fixtureId === fixtureId))
  const byOrder = (a: ChecklistItem, b: ChecklistItem) => (a.order ?? 0) - (b.order ?? 0) || a.addedAt.localeCompare(b.addedAt)
  return [...live.filter((i) => i.scope === 'company').sort(byOrder), ...live.filter((i) => i.scope === 'job').sort(byOrder)]
}

/** The checks that read No on a stage: the thing the office acts on. */
export function noCount(items: readonly ChecklistItem[], answers: ReadonlyMap<string, ChecklistAnswer>): number {
  return items.filter((i) => answers.get(i.id)?.pick === 'no').length
}

/** What an answer still owes: a signature where the author asked, a photo where asked (not on Not here). */
export function answerOwes(item: ChecklistItem, a: ChecklistAnswer | undefined): Array<'signature' | 'photo'> {
  if (!a) return []
  const owes: Array<'signature' | 'photo'> = []
  if (item.needsSignature && !a.signature) owes.push('signature')
  if (item.asksPhoto && a.pick !== 'not_here' && !a.photoTakenAt) owes.push('photo')
  return owes
}

export function itemAnswered(item: ChecklistItem, a: ChecklistAnswer | undefined): boolean {
  return !!a && answerOwes(item, a).length === 0
}

export type ChecklistProgress = { asked: number; answered: number; left: number; next: ChecklistItem | null; complete: boolean }

/** The sheet's header and its one open row: the first item not yet answered. */
export function checklistProgress(items: readonly ChecklistItem[], answers: ReadonlyMap<string, ChecklistAnswer>): ChecklistProgress {
  const answered = items.filter((i) => itemAnswered(i, answers.get(i.id))).length
  const next = items.find((i) => !itemAnswered(i, answers.get(i.id))) ?? null
  return { asked: items.length, answered, left: items.length - answered, next, complete: items.length > 0 && next == null }
}

export function progressWords(p: ChecklistProgress): string {
  if (p.asked === 0) return 'No checks on this stage yet'
  if (p.complete) return `${p.asked} of ${p.asked} answered`
  return `${p.answered} of ${p.asked} answered · ${p.left} left`
}

/** `CL-<job number>-<n>`, counted per job. */
export function recordId(jobNumber: string | number, n: number): string {
  return `CL-${jobNumber}-${n}`
}

/** The stamp on a row: the name and the clock, in the app's words. */
export function stampWords(by: string, atIso: string): string {
  const d = new Date(atIso)
  const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const clock = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
  return `${by || 'someone'} · ${day} · ${clock}`
}

/** The signature sheet's gravity words: what is being claimed, where it goes, who reads it. */
export function signingWords(pick: ChecklistPick, item: ChecklistItem, jobLabel: string, stageName: string): string {
  const note = pick === 'no' ? ' and your note on why' : ''
  return `You are signing ${PICK_WORDS[pick]} to “${item.words}”. It goes on ${jobLabel}'s ${stageName} record with your name, the time${note}. The office, the GC and an inspector can read it.`
}

/** What filing did, on the paper's foot. */
export function filedFootWords(stageName: string, nos: number): string {
  const ready = `${stageName} now reads ready on the Pipeline and its draw can bill.`
  return nos > 0 ? `${ready} ${nos === 1 ? 'One check reads No' : `${nos} checks read No`}; the office acts on that before the draw goes out.` : ready
}

export const AGREED_LINE = 'I did this check myself and the answer is true.'

/** The kinds a job's stage lines carry, with the stage each. */
export function checklistStagesOf(fixtures: ReadonlyArray<{ id: string; name: string; stage_kind?: string | null; sequence_order?: number }>): Array<{ fixtureId: string; name: string; kind: StageChecklistKind }> {
  return fixtures
    .filter((f) => f.stage_kind === 'order')
    .map((f) => ({ fixtureId: f.id, name: f.name, kind: stageChecklistKindOf(f.name) }))
    .filter((s): s is { fixtureId: string; name: string; kind: StageChecklistKind } => s.kind != null)
}
