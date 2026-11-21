/**
 * What the filled builder's screen says and offers (punch list #404, step 3), worked out from what the database
 * holds: where a job's sheet stands, the line under the switch, the Publish press and why it is dead, the rows of
 * where a change to the usual goes, and the chips. The rules of the sheet itself are `sheet.ts`.
 *
 * Pure: no React, no supabase, no clock.
 */
import { countedLabel } from '../batchWords'
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import type { BuilderChip, DocumentBuilderEntry } from './builders'
import { jobSheetMissing, plural, sheetDefProblems, sheetDiffers, usualHeldWords, usualPublishPlan, type JobSheet, type SheetDef, type UsualPublishRow } from './sheet'
import { isBuilderRead, sameContents, type BuilderRecord } from './standing'

/** A job's sheet as the screen needs it: the saved row's facts and the own part as it is being typed. */
export type JobSheetState = {
  /** The row's id. Null for a job with no row yet. */
  id: string | null
  /** The job's own part as it now reads on the screen. */
  own: JobSheet
  /** The own part as published. Null before the first publish. */
  published: JobSheet | null
  revision: number
  usualRevision: number | null
}

/** True when the job's own part has moved on from what was published. */
export function jobHasOwnChanges(job: JobSheetState): boolean {
  return job.revision > 0 && !sameContents(job.own, job.published)
}

/** True when the usual was published again since this sheet went out. */
export function jobIsBehind(job: JobSheetState, usualRevision: number): boolean {
  return job.revision > 0 && (job.usualRevision ?? 0) < usualRevision
}

/** True when a publish would change what subs see. */
export function jobHasSomethingToPublish(job: JobSheetState, usualRevision: number): boolean {
  return job.revision === 0 || jobHasOwnChanges(job) || jobIsBehind(job, usualRevision)
}

export type PublishPress = { label: string; dead: boolean; why: string[] }

/** The press that publishes one job's sheet, and what is missing while it is dead. */
export function jobPublishPress(job: JobSheetState, usual: { def: SheetDef; revision: number }): PublishPress {
  if (!jobHasSomethingToPublish(job, usual.revision)) return { label: 'Nothing to publish', dead: true, why: [] }
  const why = jobSheetMissing(job.own, usual)
  return { label: "Publish this job's sheet", dead: why.length > 0, why }
}

/**
 * The press that publishes the usual. It says how many jobs the change goes to. With no job ready it still
 * publishes the usual itself, since the first job needs a published usual to go out on.
 */
export function usualPublishPress(draft: SheetDef, rec: BuilderRecord, plan: ReadonlyArray<UsualPublishRow>): PublishPress {
  const dirty = rec.revision === 0 || !sameContents(draft, rec.published)
  if (!dirty) return { label: 'Nothing to publish', dead: true, why: [] }
  const why = sheetDefProblems(draft)
  const ready = plan.filter((r) => r.gets).length
  return { label: ready > 0 ? countedLabel('Publish to', ready, 'job') : 'Publish your usual', dead: why.length > 0, why }
}

/**
 * The plan for the usual's publish, from every job the company runs as the GC. `heldHere` says what the page that
 * publishes holds for a job beyond its sheet as read: words typed and not saved, or a choice not yet made.
 */
export function usualPlanFor(
  jobs: ReadonlyArray<{ projectId: string; name: string }>,
  sheets: ReadonlyMap<string, JobSheetState>,
  heldHere: (projectId: string) => 'own-changes' | 'moved' | null = () => null,
): UsualPublishRow[] {
  return usualPublishPlan(
    jobs.map((j) => {
      const s = sheets.get(j.projectId)
      return { id: j.projectId, name: j.name, revision: s?.revision ?? 0, changed: s ? jobHasOwnChanges(s) : false, here: heldHere(j.projectId) }
    }),
  )
}

/**
 * Said when the usual's publish read the jobs again and they no longer were as the press said: a teammate changed or
 * published one since this page read it. Nothing is published, the rows and the press are drawn again from what was
 * just read, and the person presses again knowing where it goes.
 */
export const USUAL_PRESS_MOVED = { line: 'Nothing was published yet.', why: 'A job changed since this page read it. The rows and the button now say where your usual goes. Press it again.' } as const

/** One row of where a change to the usual goes: the job, and a chip. */
export function usualPlanChip(row: UsualPublishRow, usualDirty: boolean, revisionNow: number): BuilderChip {
  if (!row.gets) return { tone: row.why === 'no-sheet' ? 'wait' : 'warn', words: usualHeldWords(row.why) }
  return usualDirty ? { tone: 'ok', words: `Gets it, as revision ${row.asRevision}` } : { tone: 'ok', words: `Revision ${revisionNow}` }
}

/** The line under the switch: what the person is changing, and what subs see. */
export function sheetNote(mode: 'job' | 'usual', job: JobSheetState | null, usual: { revision: number; dirty: boolean }): string {
  if (mode === 'usual') return 'You are changing your usual sheet. Every job starts on it.'
  if (!job) return 'Pick a job you run as the GC.'
  if (job.revision === 0) return 'No sub sees a sheet for this job until you publish.'
  if (jobIsBehind(job, usual.revision)) return 'Your usual changed since this sheet was published. Publish to bring it up.'
  if (jobHasOwnChanges(job)) return `Changed. Subs see revision ${job.revision} until you publish.`
  if (usual.dirty) return 'Your usual has changes not yet published. This sheet does not show them.'
  return 'Subs see what you see.'
}

/** The words over the sheet. */
export function sheetCaption(mode: 'job' | 'usual', marks: boolean): string {
  if (!marks) return 'The sheet, as a sub sees it'
  return mode === 'usual' ? 'The standing sheet. Press any words to change them for every job.' : "This job's sheet. Press any words to change them."
}

/** The stamp at the foot of the sheet: where this copy stands. */
export function sheetStamp(mode: 'job' | 'usual', job: (JobSheetState & { name: string }) | null, usualRevision: number): string {
  if (mode === 'usual' || !job) return 'The standing sheet. No job is on it.'
  if (job.revision === 0) return 'Draft. Not published.'
  const next = jobHasSomethingToPublish(job, usualRevision)
  return `Revision ${next ? `${job.revision + 1}, not yet published` : job.revision} · ${job.name}`
}

/** The chips on the open bar. The read chip is a press, so it is not among them. */
export function sheetBarChips(mode: 'job' | 'usual', job: JobSheetState | null, rec: BuilderRecord, def: SheetDef): BuilderChip[] {
  const chips: BuilderChip[] = []
  if (mode === 'usual') chips.push(rec.revision > 0 ? { tone: 'ok', words: `Your usual, revision ${rec.revision}` } : { tone: 'wait', words: 'Your usual, not published' })
  else if (job) chips.push(job.revision > 0 ? { tone: 'ok', words: `Published, revision ${job.revision}` } : { tone: 'wait', words: 'No sheet yet' })
  if (mode === 'job' && job && isBuilderRead(rec)) {
    const n = sheetDiffers(def, job.own).length
    if (n > 0) chips.push({ tone: 'warn', words: `${plural(n, 'thing differs', 'things differ')} from the checked usual` })
  }
  return chips
}

/** The read mark, as the bar's press or its chip. */
export type ReadPress = { read: true; words: string } | { read: false; words: string; canMark: boolean; formLabel: string; pressLabel: string }
export function readPress(entry: DocumentBuilderEntry, rec: BuilderRecord): ReadPress {
  if (isBuilderRead(rec) && rec.read) return { read: true, words: `${entry.reader.readBy} ${rec.read.byName}, ${formatWorkDateYmdMonthDayShort(rec.read.on)}` }
  return {
    read: false,
    words: rec.revision > 0 ? `${entry.reader.unread}. ${entry.reader.markIt}` : entry.reader.unread,
    canMark: rec.revision > 0,
    formLabel: entry.reader.who,
    pressLabel: entry.reader.markPress(rec.revision),
  }
}

/** The list row's chips for a filled builder: how many jobs have a sheet, and whether the usual is read. */
export function filledRowChips(entry: DocumentBuilderEntry, rec: BuilderRecord | null, counts: { jobs: number; withSheet: number } | null): BuilderChip[] {
  if (!rec) return [{ tone: 'wait', words: 'Not loaded yet' }]
  const chips: BuilderChip[] = []
  chips.push(rec.revision > 0 ? { tone: 'ok', words: `Your usual, revision ${rec.revision}` } : { tone: 'wait', words: 'Your usual, not published' })
  if (counts) chips.push({ tone: counts.withSheet > 0 ? 'ok' : 'wait', words: `A sheet on ${counts.withSheet} of ${plural(counts.jobs, 'job', 'jobs')}` })
  if (isBuilderRead(rec) && rec.read) chips.push({ tone: 'ok', words: `${entry.reader.readBy} ${rec.read.byName}, ${formatWorkDateYmdMonthDayShort(rec.read.on)}` })
  else chips.push({ tone: 'warn', words: entry.reader.unread })
  return chips
}
