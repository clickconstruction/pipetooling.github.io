/**
 * A job's last-work facts, written back into a list of jobs that is already on screen (v2.7208).
 *
 * The owner, 2026-11-13, looking at the Lien desk's Deadlines tab behind a job's Lien window: *"when a day is set the
 * underlying jobs don't refresh with the new dates … when I close the modal I don't want to lose my place on the page
 * but I do want the main page to update"*. The window saved the day and re-read it for itself. Its openers re-read the
 * lien clocks and the desk. But the row behind the window counts from `job.lien_last_work_on` on the jobs list the page
 * already holds (`lienCalendarRows.ts`, the Pipeline's billed rows), and nothing wrote the new day there, so the row
 * kept its old dates until the page was loaded again.
 *
 * These put the fresh facts on the one job and hand back the list. The list is the same array when nothing changed,
 * and every other job is the same object, so the page keeps its rows mounted and its place. Pure.
 */
import type { LienLastWorkJob } from './lienLastWorkDay'

/** The columns a last-day save or clear writes, and the clock's own last approved day beside them. */
export const LIEN_LAST_WORK_COLUMNS = ['last_work_date', 'lien_last_work_on', 'lien_last_work_note', 'lien_last_work_set_at', 'lien_last_work_set_by'] as const

export type LienLastWorkColumn = (typeof LIEN_LAST_WORK_COLUMNS)[number]

/** A fresh read of those columns for one job; a reader that selects only some of them hands over only those. */
export type LienLastWorkFacts = Partial<Pick<LienLastWorkJob, LienLastWorkColumn>>

/**
 * A row read from `jobs_ledger`, cut down to the last-work columns it carries: what the Lien window hands its opener
 * after a save, whatever else the read brought back. Null for no row.
 */
export function lienLastWorkFactsOf(row: Record<string, unknown> | null | undefined): LienLastWorkFacts | null {
  if (!row) return null
  const facts: LienLastWorkFacts = {}
  for (const key of LIEN_LAST_WORK_COLUMNS) {
    const v = row[key]
    if (key in row && (v == null || typeof v === 'string')) facts[key] = v ?? null
  }
  return facts
}

/** The same value, where a missing one, a null and an empty string all mean none. */
function same(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '') === (b ?? '')
}

function patched<J extends { id: string }>(job: J, facts: LienLastWorkFacts): J {
  const have = job as J & LienLastWorkFacts
  let next: (J & LienLastWorkFacts) | null = null
  for (const key of LIEN_LAST_WORK_COLUMNS) {
    if (!(key in facts) || facts[key] === undefined) continue
    if (same(have[key], facts[key])) continue
    next = next ?? { ...have }
    next[key] = facts[key] ?? null
  }
  return next ?? job
}

/**
 * The list with one job's last-work facts replaced. The same array when the job is not in it, when there are no
 * facts, or when the job already reads that way.
 */
export function withJobLastWork<J extends { id: string }>(jobs: J[], jobId: string | null | undefined, facts: LienLastWorkFacts | null | undefined): J[] {
  if (!jobId || !facts) return jobs
  return withJobsLastWork(jobs, [{ id: jobId, ...facts }])
}

/**
 * The list with each named job's last-work facts replaced, for a reader that holds a fresh copy of several jobs (the
 * Lien desk's own read carries the hand day and the clock's last day of every job on its lists). A row for a job the
 * list does not hold is passed over. The same array when no job changed.
 */
export function withJobsLastWork<J extends { id: string }>(jobs: J[], rows: ReadonlyArray<{ id: string } & LienLastWorkFacts> | null | undefined): J[] {
  if (!rows || rows.length === 0 || jobs.length === 0) return jobs
  const byId = new Map(rows.map((r) => [r.id, r] as const))
  let changed = false
  const next = jobs.map((job) => {
    const facts = byId.get(job.id)
    if (!facts) return job
    const p = patched(job, facts)
    if (p !== job) changed = true
    return p
  })
  return changed ? next : jobs
}
