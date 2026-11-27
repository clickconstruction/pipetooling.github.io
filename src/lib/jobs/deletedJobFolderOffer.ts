/**
 * A deleted ZZ test job's Drive folder goes to Drive's trash (punch list #443, row 18): the app's half, pure.
 *
 * Making a job makes a folder tree in the company's Shared Drive, and **Delete** on the job left every folder.
 * When a dev deletes a ZZ-named job, the app now asks the `job-drive-folders` function to move the job's own folder
 * to Drive's trash, right after the delete. The function decides: it reads the deleted job from Deleted records and
 * refuses anything that is not a deleted ZZ test job's own folder with nothing of a person's in it
 * (`supabase/functions/_shared/deletedJobFolderTrash.ts`). This file is what the app asks, shows and says.
 *
 * - The ask is made for a dev alone, on a ZZ-named job that keeps a Drive link. Everyone else's delete is as it was:
 *   no call, no line, no toast.
 * - The Delete window says it before the press, in one line.
 * - The delete never waits on Drive and never fails for it. The folder's outcome comes after, as a toast: what went
 *   to the trash, or why the folder stays.
 */
import { isZzTestJob } from './zzTestJobSweep'

/** The columns of a job the offer reads. */
export interface JobFolderTrashJob {
  job_name?: string | null
  customer_name?: string | null
  google_drive_link?: string | null
}

/** Whether deleting this job also sends its Drive folder to the trash: a dev, a ZZ-named job, a link on record. */
export function jobFolderTrashOffered(role: string | null | undefined, job: JobFolderTrashJob | null | undefined): boolean {
  if (role !== 'dev' || !job) return false
  return isZzTestJob(job) && String(job.google_drive_link ?? '').trim() !== ''
}

/** The line the Delete window adds for such a job. */
export const JOB_FOLDER_TRASH_CONFIRM_LINE = 'This is a ZZ test job, so its Drive folder goes to Drive’s trash with it. The folder can be restored there for 30 days.'

/** What the function did, when it did not refuse. */
export type JobFolderTrashAct = 'trashed' | 'none' | 'already' | 'gone'

export interface JobFolderTrashAnswer {
  act: JobFolderTrashAct
  words: string
}

const ACTS: ReadonlyArray<JobFolderTrashAct> = ['trashed', 'none', 'already', 'gone']

/** The function's answer as the app reads it; null for anything that is not one. */
export function jobFolderTrashAnswer(data: unknown): JobFolderTrashAnswer | null {
  if (!data || typeof data !== 'object') return null
  const d = data as { act?: unknown; words?: unknown }
  const act = ACTS.find((a) => a === d.act)
  if (!act || typeof d.words !== 'string' || !d.words.trim()) return null
  return { act, words: d.words.trim() }
}

/** The function as it was before this take-back answers a `trash` body with this, having read no `job_id`. */
export const JOB_FOLDER_TRASH_OLD_ANSWER = 'job_id is required'

/** What the app says when the function deployed is the one from before this take-back. */
export const JOB_FOLDER_TRASH_NOT_KNOWN = 'The app’s Drive function does not know this take-back yet. Its Drive folder stays.'

/** A refusal's words, with the old function's answer turned into a sentence a person can act on. */
export function jobFolderTrashProblem(words: string): string {
  return words.trim() === JOB_FOLDER_TRASH_OLD_ANSWER ? JOB_FOLDER_TRASH_NOT_KNOWN : words.trim()
}

/** What the toast says after the delete: the job is gone, then what became of its folder. */
export function jobFolderTrashToast(outcome: { answer: JobFolderTrashAnswer } | { problem: string }): { words: string; tone: 'success' | 'warning' } {
  if ('answer' in outcome) return { words: `The job is deleted. ${outcome.answer.words}`, tone: 'success' }
  return { words: `The job is deleted. ${outcome.problem}`, tone: 'warning' }
}
