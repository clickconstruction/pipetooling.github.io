/**
 * Is this job on the lien path? (v2.7504 the database, this file the rule; the owner's ask of 2026-11-16 on a job
 * whose one bill was trips to pick up checks that were not there.)
 *
 * A job leaves the Lien desk when it is paid, when it is marked Uncollectible, when an open in-kind deal pays it
 * (`lienInKind.ts`) or when its whole property is answered public (`lienPublicProperty.ts`). None of those says *this
 * one job has no lien behind it, collect it another way*. That answer lives on the job
 * (`jobs_ledger.lien_path_answer`, written only by `set_job_lien_path_answer`):
 *
 *  - **off_path**: a person took the job off, with a reason. No clock, no row, no count, no print run, no summary.
 *    Nothing is filed, voided or deleted, so its papers are where they stood when the job is put back.
 *  - **NULL**: on the lien path, as every job is until a person says otherwise.
 *
 * Who decided, when and why sit beside the answer and stay after the job is put back, as who put it back.
 *
 * Pure, and it imports nothing, so the edge copy of the desk's rules can read it. A row read before the migration is
 * pushed carries no answer, so the job is on the path, as before.
 */

/** The part of a job these rules read. */
export type LienJobPathRow = {
  lien_path_answer?: unknown
  lien_path_answered_at?: unknown
  lien_path_answered_by?: unknown
  lien_path_reason?: unknown
}

/** The column the rule reads, for a select list of `jobs_ledger` columns. */
export const LIEN_JOB_PATH_COLUMN = 'lien_path_answer' as const

/** The answer with who, when and why, for a read that shows them. */
export const LIEN_JOB_PATH_COLUMNS = 'lien_path_answer, lien_path_answered_at, lien_path_answered_by, lien_path_reason' as const

/** Whether a person took this job off the lien path. */
export function jobOffLienPath(job: LienJobPathRow | null | undefined): boolean {
  return job?.lien_path_answer === 'off_path'
}

/** The jobs a person took off the lien path, by id. */
export function lienOffPathJobIds(jobs: ReadonlyArray<LienJobPathRow & { id: string }>): Set<string> {
  const ids = new Set<string>()
  for (const j of jobs) if (jobOffLienPath(j)) ids.add(j.id)
  return ids
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** What the job says about its place on the lien path: the answer, and who last changed it, when and why. */
export type LienJobPathStanding = {
  off: boolean
  /** Why it is off the path, or why it went back on; '' when nobody ever changed it. */
  reason: string
  /** When the answer last changed, as stored; null when it never did. */
  at: string | null
  /** Who last changed it (`users.id`); null when it never did, or the person is gone. */
  by: string | null
}

export function lienJobPathStanding(job: LienJobPathRow | null | undefined): LienJobPathStanding {
  return {
    off: jobOffLienPath(job),
    reason: text(job?.lien_path_reason),
    at: text(job?.lien_path_answered_at) || null,
    by: text(job?.lien_path_answered_by) || null,
  }
}
