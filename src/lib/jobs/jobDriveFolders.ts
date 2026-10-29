/**
 * A Pipeline job's Google Drive folders, made by the app (Materials on site, punch list #209, v2.6054): the pure
 * pieces behind the press **Make the job's Drive folders** on the materials page's Deliveries card and the job
 * window's Documents tab, and the Materials desk's backfill across every live job without one. The folders are
 * made by the `job-drive-folders` edge function (`jobDriveFoldersIo.ts` calls it); this file reads a job's link,
 * shapes the function's answer, writes the line under the press and plans the desk's batch in the shape of
 * `batchWords` (`CLAUDE.md` → *Do what is ready, never all or nothing*).
 */
import { batchOutcomeWords, batchWords, type BatchOutcome, type BatchWords } from '../batchWords'

/** drive.google.com/drive/folders/<id> → the folder id; null otherwise. The edge's `driveFolderIdFromUrl`, kept in step. */
export function driveFolderIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const m = /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([\w-]{20,})/.exec(url)
  return m?.[1] ?? null
}

/** What a job's Drive link is: nothing yet, a Drive folder, or a link that is not a folder (a file, another site). */
export type JobDriveLinkState = 'none' | 'folder' | 'not_a_folder'

export function jobDriveLinkState(link: string | null | undefined): JobDriveLinkState {
  const s = (link ?? '').trim()
  if (!s) return 'none'
  return driveFolderIdFromUrl(s) ? 'folder' : 'not_a_folder'
}

/** The roles the function lets press it: the office and the estimators, as gc-drive-access. */
export function canMakeJobDriveFolders(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'controller' || role === 'estimator'
}

/** Where a folder came from: the job's own link kept, its bid's folder, found under Jobs, or made there. */
export type JobDriveFolderSource = 'kept' | 'bid' | 'found' | 'made'

export interface JobDriveFolderOut {
  url: string
  source: JobDriveFolderSource
  /** Whether the app can put a file there: false for a kept link it cannot open or write in, null for a kept link that is not a Drive folder. */
  writable: boolean | null
}

/** The function's answer, in the page's words. */
export interface JobDriveFolders {
  /** The service account's address, the one to share a hand-made folder with. */
  appEmail: string
  folder: JobDriveFolderOut
  pictures: JobDriveFolderOut
  plans: JobDriveFolderOut
  teamUrl: string
  photosUrl: string
  sentUrl: string
  /** The `jobs_ledger` columns the press wrote. */
  stamped: string[]
}

/** The three columns the press may write, as a patch on the job row the window holds. */
export type JobDriveLinksPatch = { google_drive_link?: string; job_pictures_link?: string; job_plans_link?: string }

type Raw = {
  app_email?: unknown
  folder?: { url?: unknown; source?: unknown }
  pictures?: { url?: unknown; source?: unknown; writable?: unknown }
  plans?: { url?: unknown; source?: unknown; writable?: unknown }
  team_url?: unknown
  photos_url?: unknown
  sent_url?: unknown
  stamped?: unknown
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const source = (v: unknown): JobDriveFolderSource => (v === 'kept' || v === 'bid' || v === 'found' || v === 'made' ? v : 'made')
const out = (v: { url?: unknown; source?: unknown; writable?: unknown } | undefined): JobDriveFolderOut => ({
  url: str(v?.url),
  source: source(v?.source),
  writable: v?.writable === true ? true : v?.writable === false ? false : null,
})

/** The function's JSON as the page reads it; a field missing reads as empty, never throws. */
export function jobDriveFoldersFromAnswer(data: unknown): JobDriveFolders {
  const r = (data && typeof data === 'object' ? data : {}) as Raw
  return {
    appEmail: str(r.app_email),
    folder: { url: str(r.folder?.url), source: source(r.folder?.source), writable: true },
    pictures: out(r.pictures),
    plans: out(r.plans),
    teamUrl: str(r.team_url),
    photosUrl: str(r.photos_url),
    sentUrl: str(r.sent_url),
    stamped: Array.isArray(r.stamped) ? r.stamped.filter((s): s is string => typeof s === 'string') : [],
  }
}

/** The job row's new links, from what the press wrote: the window and the desk patch their copy of the job with it. */
export function jobDriveLinksPatch(r: JobDriveFolders): JobDriveLinksPatch {
  const patch: JobDriveLinksPatch = {}
  if (r.stamped.includes('google_drive_link')) patch.google_drive_link = r.folder.url
  if (r.stamped.includes('job_pictures_link')) patch.job_pictures_link = r.pictures.url
  if (r.stamped.includes('job_plans_link')) patch.job_plans_link = r.plans.url
  return patch
}

export interface DriveFoldersMadeWords {
  /** What happened, in one or two short sentences. */
  line: string
  /** A folder the job keeps that the app cannot write in, with what to do; null when every folder takes a file. */
  hold: string | null
}

/** The line under the press once the folders are made, and the hold when a kept folder is closed to the app. */
export function driveFoldersMadeWords(r: JobDriveFolders): DriveFoldersMadeWords {
  const line =
    r.folder.source === 'made'
      ? 'The job’s folders are ready under Jobs.'
      : r.folder.source === 'found'
        ? 'The job’s folder was already under Jobs. The folders missing inside it are made.'
        : r.folder.source === 'bid'
          ? 'The job uses its bid’s folder. The folders missing inside it are made.'
          : 'The job keeps its folder. The folders missing inside it are made.'
  const closed = [r.pictures.writable === false ? 'pictures' : null, r.plans.writable === false ? 'plans' : null].filter((s): s is string => s !== null)
  const hold =
    closed.length === 0
      ? null
      : closed.includes('pictures')
        ? `The app cannot write in the job’s pictures folder, so photos cannot file there. Share it with ${r.appEmail} as an editor, or clear the link on the Edit tab and press again.`
        : `The app cannot write in the job’s plans folder. Share it with ${r.appEmail} as an editor, or clear the link on the Edit tab and press again.`
  return { line, hold }
}

/** A job as the desk's backfill reads it. */
export interface BackfillJob {
  id: string
  google_drive_link?: string | null
}

export interface DriveFolderBackfillPlan<T extends BackfillJob> {
  /** Jobs with no Drive link: the press makes their folders. */
  ready: T[]
  /** Jobs with a Drive link that is not a folder: held with the reason, their door is the job's Edit tab. */
  held: { job: T; why: string }[]
  words: BatchWords
}

export const NOT_A_FOLDER_WHY = 'its Drive link is not a folder'

/** The desk's button: *Make folders for 12 jobs · 1 has a link that is not a folder ▸*. */
export function deskBackfillWords(ready: number, held: number): BatchWords {
  return batchWords({
    verb: 'Make folders for',
    ready,
    held,
    heldWhy: { one: 'has a link that is not a folder', many: 'have links that are not folders' },
    noun: 'job',
  })
}

/**
 * The batch over every live job without a folder: a job with no link is ready, a job whose link is not a folder is held
 * with the reason. The desk and Documents → Where files go (punch list #211) plan from here, each with its own button's
 * words (`words`, the desk's by default), so both doors lead to one act.
 */
export function planDriveFolderBackfill<T extends BackfillJob>(jobs: readonly T[], words: (ready: number, held: number) => BatchWords = deskBackfillWords): DriveFolderBackfillPlan<T> {
  const ready: T[] = []
  const held: { job: T; why: string }[] = []
  for (const job of jobs) {
    const state = jobDriveLinkState(job.google_drive_link)
    if (state === 'none') ready.push(job)
    else if (state === 'not_a_folder') held.push({ job, why: NOT_A_FOLDER_WHY })
  }
  return { ready, held, words: words(ready.length, held.length) }
}

/** After the backfill ran past its failures: the toast, and the head over the jobs that did not get folders. */
export function driveFolderBackfillOutcome(done: number, failed: number): BatchOutcome {
  return batchOutcomeWords({ verb: 'get folders', past: 'Got folders for', done, failed, noun: 'job' })
}
