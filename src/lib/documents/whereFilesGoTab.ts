/**
 * Where files go, the tab (punch list #211, PR 2): the pure pieces behind Documents → Where files go. The office reads
 * the four settings through `job-drive-folders`' `settings` verb, checks a folder through `check` and saves through
 * `set` (`whereFilesGoIo.ts` makes the calls); this file shapes the answers, writes the root card's lines, picks the
 * live example, edits a pattern, plans the two presses under the cards and counts the held line. The rules the
 * functions share (`folderName`, `writeCheckWords`, the parsers) stay in `folderName.ts`.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { batchWords, countedLabel, type BatchWords } from '../batchWords'
import { tidyOutcomeWords, type TidyCounts } from './folderName'
import { jobDriveLinkState } from '../jobs/jobDriveFolders'
import {
  BID_FOLDER_PIECES,
  DEFAULT_BID_FOLDER_PATTERN,
  DEFAULT_JOB_FOLDER_PATTERN,
  JOB_FOLDER_PIECES,
  parseFolderPattern,
  parseFoldersMade,
  type BidFolderFacts,
  type BidFolderPiece,
  type FoldersMade,
  type JobFolderFacts,
  type JobFolderPiece,
} from './folderName'

/** Who sets where files go: the four office roles, never the estimator (the function's `SETTINGS_ROLES`). */
export function canSetWhereFilesGo(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'controller'
}

/** A folder as Drive describes it to the app, for the root card (`DriveFolderFacts` on the function). */
export interface RootFolderFacts {
  id: string
  name: string
  /** From the top: the Shared Drive's name, then each parent, the folder itself not among them. */
  path: string[]
  owner: string | null
  drive: string | null
  folders: number | null
}

/** The jobs root as the `settings` verb answers it. */
export interface WhereFilesGoRoot {
  id: string
  url: string
  from: 'setting' | 'env' | null
  ok: boolean
  words: string
  folder: RootFolderFacts | null
}

/** The tab's settings, as the page holds them. */
export interface WhereFilesGo {
  appEmail: string
  root: WhereFilesGoRoot | null
  jobPattern: JobFolderPiece[]
  bidPattern: BidFolderPiece[]
  foldersMade: FoldersMade
}

/** The `check` verb's answer. */
export interface FolderCheck {
  ok: boolean
  words: string
  appEmail: string
  url: string | null
  folder: RootFolderFacts | null
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

function factsOf(v: unknown): RootFolderFacts | null {
  if (!v || typeof v !== 'object') return null
  const f = v as { id?: unknown; name?: unknown; path?: unknown; owner?: unknown; drive?: unknown; folders?: unknown }
  return {
    id: str(f.id),
    name: str(f.name),
    path: Array.isArray(f.path) ? f.path.filter((p): p is string => typeof p === 'string') : [],
    owner: strOrNull(f.owner),
    drive: strOrNull(f.drive),
    folders: typeof f.folders === 'number' && Number.isFinite(f.folders) ? f.folders : null,
  }
}

/** The `settings` (or `set`) answer as the tab reads it; a field missing reads as its default, never throws. */
export function whereFilesGoFromAnswer(data: unknown): WhereFilesGo {
  const r = (data && typeof data === 'object' ? data : {}) as {
    app_email?: unknown
    root?: { id?: unknown; url?: unknown; from?: unknown; ok?: unknown; words?: unknown; folder?: unknown } | null
    job_pattern?: unknown
    bid_pattern?: unknown
    folders_made?: unknown
  }
  const from = r.root?.from
  const root = r.root && typeof r.root === 'object' && str(r.root.id)
    ? {
        id: str(r.root.id),
        url: str(r.root.url),
        from: from === 'setting' ? ('setting' as const) : from === 'env' ? ('env' as const) : null,
        ok: r.root.ok === true,
        words: str(r.root.words),
        folder: factsOf(r.root.folder),
      }
    : null
  return {
    appEmail: str(r.app_email),
    root,
    jobPattern: parseFolderPattern(JSON.stringify(r.job_pattern ?? null), JOB_FOLDER_PIECES, DEFAULT_JOB_FOLDER_PATTERN),
    bidPattern: parseFolderPattern(JSON.stringify(r.bid_pattern ?? null), BID_FOLDER_PIECES, DEFAULT_BID_FOLDER_PATTERN),
    foldersMade: parseFoldersMade(str(r.folders_made)),
  }
}

/** The `check` verb's JSON as the tab reads it. */
export function folderCheckFromAnswer(data: unknown): FolderCheck {
  const r = (data && typeof data === 'object' ? data : {}) as { ok?: unknown; words?: unknown; app_email?: unknown; url?: unknown; folder?: unknown }
  return { ok: r.ok === true, words: str(r.words), appEmail: str(r.app_email), url: strOrNull(r.url), folder: factsOf(r.folder) }
}

/** The root card's lines: the folder's name, its path from the top, who owns it, how many job folders it holds, and where the root came from. */
export interface RootCardWords {
  name: string
  /** `PipeTooling Jobs › Jobs`, or null when Drive gave no path. */
  path: string | null
  /** *In the Shared Drive PipeTooling Jobs.* or *Owned by Dana Office.*; null when neither is known. */
  owner: string | null
  /** *118 job folders inside.*; null when the count did not read. */
  count: string | null
  /** Where the root came from, when the office should know: the functions' setting, or no root at all. */
  from: string | null
}

export const NO_ROOT_YET_WORDS = 'The jobs root is not set yet. Paste a folder link and press Check.'
export const ROOT_FROM_ENV_WORDS = 'Set on the functions until the office picks a folder here.'

export function rootCardWords(root: WhereFilesGoRoot | null): RootCardWords {
  if (!root) return { name: 'The jobs root', path: null, owner: null, count: null, from: NO_ROOT_YET_WORDS }
  const f = root.folder
  const name = f?.name || 'The jobs root'
  const path = f && f.path.length > 0 ? [...f.path, f.name].filter(Boolean).join(' › ') : null
  const owner = f?.drive ? `In the Shared Drive ${f.drive}.` : f?.owner ? `Owned by ${f.owner}.` : null
  const count = f && f.folders != null ? (f.folders === 1 ? '1 job folder inside.' : `${f.folders} job folders inside.`) : null
  return { name, path, owner, count, from: root.from === 'env' ? ROOT_FROM_ENV_WORDS : null }
}

/** A live job as the tab reads it from `jobs_ledger`. */
export interface WhereFilesGoJob {
  id: string
  hcp_number: string | null
  job_name: string | null
  customer_name: string | null
  job_address: string | null
  created_at: string | null
  google_drive_link: string | null
  job_pictures_link: string | null
  job_plans_link: string | null
  /** Why the folder sweep could not place this job's folder (v2.6284); null or missing when it sits in the tree. */
  drive_folder_hold?: string | null
  /** When the sweep or the press last placed the folder; null or missing when it never looked. */
  drive_folder_tidied_at?: string | null
}

/** The pieces a job's folder name is built from, as the function reads them (`jobFacts` on `job-drive-folders`). */
export function jobFolderFacts(job: WhereFilesGoJob): JobFolderFacts {
  return {
    id: job.id,
    number: job.hcp_number,
    name: job.job_name,
    customer: job.customer_name,
    address: job.job_address,
    year: job.created_at ? calendarYmdInAppTzFromIso(job.created_at).slice(0, 4) : null,
  }
}

/** A bid as the tab reads it for the live example. */
export interface WhereFilesGoBid {
  id: string
  project_name: string | null
  bid_number: string | null
  customer_name: string | null
  address: string | null
  created_at: string | null
}

export function bidFolderFacts(bid: WhereFilesGoBid): BidFolderFacts {
  return {
    id: bid.id,
    project: bid.project_name,
    number: bid.bid_number,
    customer: bid.customer_name,
    address: bid.address,
    year: bid.created_at ? calendarYmdInAppTzFromIso(bid.created_at).slice(0, 4) : null,
  }
}

/** The job the live example reads: the first with both a number and a name, else the first with either, else none. */
export function exampleJob(jobs: readonly WhereFilesGoJob[]): WhereFilesGoJob | null {
  const has = (s: string | null | undefined) => Boolean((s ?? '').trim())
  return jobs.find((j) => has(j.hcp_number) && has(j.job_name)) ?? jobs.find((j) => has(j.hcp_number) || has(j.job_name)) ?? null
}

/** A job's label on a list under the cards: `972 · Oak Hollow Bldg C`, the desk's shape. */
export function jobLabel(job: Pick<WhereFilesGoJob, 'id' | 'hcp_number' | 'job_name' | 'customer_name'>): string {
  const number = (job.hcp_number ?? '').trim()
  const name = (job.job_name ?? '').trim() || (job.customer_name ?? '').trim()
  if (!number && !name) return `job ${job.id.slice(0, 8)}`
  return [number, name].filter(Boolean).join(' · ')
}

/** A piece added at the end of a pattern; a piece already in it leaves the pattern as it is. */
export function addPiece<P extends string>(pattern: readonly P[], piece: P): P[] {
  return pattern.includes(piece) ? [...pattern] : [...pattern, piece]
}

/** A piece taken out of a pattern; the last piece stays, since a folder name needs one. */
export function removePiece<P extends string>(pattern: readonly P[], piece: P): P[] {
  if (pattern.length <= 1) return [...pattern]
  return pattern.filter((p) => p !== piece)
}

/** The pieces the tray offers: every piece not in the pattern, in the tray's order. */
export function trayPieces<P extends string>(pattern: readonly P[], pieces: readonly P[]): P[] {
  return pieces.filter((p) => !pattern.includes(p))
}

export function samePattern(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((p, i) => p === b[i])
}

/** The two choices of the tree card, as the radio reads them. */
export const FOLDERS_MADE_WORDS: Readonly<Record<FoldersMade, string>> = {
  upfront: 'Make all of it when the job is made',
  'as-needed': 'Make each folder when something first lands in it',
}

/** The words for a change to the name: the sweep carries it to every live job's folder (v2.6284). */
export const APPLIES_FROM_NOW_WORDS = 'A change reaches every live job’s folder the next time the sweep looks at it. Links keep working through a rename.'
/** The tree card's line on the level above the job (v2.6284). */
export const UNDER_CUSTOMER_WORDS = 'Under the root, each customer has a folder named by the customer. The job’s folder sits inside it. A job with no customer yet sits under No customer yet.'
export const FIXED_NAMES_WORDS = 'The five names stay as they are. The sweeps file by them.'

/** The jobs whose pasted folder the app can look at: a live job with a Drive folder link. */
export function pastedFolderJobs<T extends Pick<WhereFilesGoJob, 'google_drive_link'>>(jobs: readonly T[]): T[] {
  return jobs.filter((j) => jobDriveLinkState(j.google_drive_link) === 'folder')
}

/** The button that looks at every pasted folder: *Check 41 pasted folders*, dead at zero. */
export function checkPastedWords(n: number): { button: string; dead: boolean } {
  return { button: countedLabel('Check', n, ['pasted folder', 'pasted folders']), dead: n <= 0 }
}

/** The amber line under the cards, once the pasted folders were looked at: null when none is held. */
export function heldLineWords(held: number): string | null {
  if (held <= 0) return null
  return held === 1 ? 'Held: 1 job whose pasted folder the app cannot write to' : `Held: ${held} jobs whose pasted folder the app cannot write to`
}

/** After the pasted folders were looked at: what the line says when every folder took a file. */
export const EVERY_PASTED_OK_WORDS = 'The app can write in every pasted folder.'

/**
 * What the picker sends to the look-up among every job (v2.6073): the typed text with one space between words and
 * without the marks a filter would misread; empty when nothing is left to look for.
 */
export function pickerQuery(typed: string): string {
  return typed.replace(/[,()*%\\]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** The picker's line while a job is looked up among every job. */
export const LOOKING_UP_WORDS = 'Looking among every job…'

/** The single check's words when the job has no folder to look at. */
export const JOB_HAS_NO_FOLDER_WORDS = 'This job has no Drive folder yet. The press above makes one.'

/** The words of the batch under the cards, in the mock-up's shape: *Make the folders for 14 jobs without one*. */
export function makeFoldersWords(ready: number, held: number): BatchWords {
  return batchWords({
    verb: 'Make the folders for',
    ready,
    held,
    heldWhy: { one: 'has a link that is not a folder', many: 'have links that are not folders' },
    noun: ['job without one', 'jobs without one'],
  })
}

// --- the folder sweep's press (v2.6287, the tree under the customer) --------------------------------------------------

/** The jobs the sweep could not place, each with its reason from the row, so the line reads without a run. */
export function heldJobs<T extends Pick<WhereFilesGoJob, 'drive_folder_hold'>>(jobs: readonly T[]): { job: T; why: string }[] {
  return jobs.flatMap((job) => (job.drive_folder_hold && job.drive_folder_hold.trim() ? [{ job, why: job.drive_folder_hold.trim() }] : []))
}

/** The amber line over the held jobs: null when none is held. */
export function treeHeldLineWords(held: number): string | null {
  if (held <= 0) return null
  return held === 1 ? 'Held: 1 job whose folder is not in the tree' : `Held: ${held} jobs whose folder is not in the tree`
}

/** The press that walks every live job through the rule: *Tidy the folders for 412 live jobs*, dead at zero. */
export function tidyWords(live: number): { button: string; dead: boolean } {
  return { button: countedLabel('Tidy the folders for', live, ['live job', 'live jobs']), dead: live <= 0 }
}

/** One page of the sweep as the tab reads it. */
export interface TidySweep {
  counts: TidyCounts
  held: { jobId: string; label: string; why: string; kind: string }[]
  line: string
  nextOffset: number | null
  total: number
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** The `sweep` verb's JSON as the tab reads it; a field missing reads as zero or empty, never throws. */
export function tidySweepFromAnswer(data: unknown): TidySweep {
  const r = (data && typeof data === 'object' ? data : {}) as {
    counts?: { looked?: unknown; made?: unknown; moved?: unknown; renamed?: unknown; in_place?: unknown; held?: unknown; left?: unknown }
    held?: unknown
    line?: unknown
    next_offset?: unknown
    total?: unknown
  }
  const c = r.counts ?? {}
  const counts: TidyCounts = { looked: num(c.looked), made: num(c.made), moved: num(c.moved), renamed: num(c.renamed), inPlace: num(c.in_place), held: num(c.held), left: num(c.left) }
  const held = Array.isArray(r.held)
    ? r.held.flatMap((h) => {
        const x = (h && typeof h === 'object' ? h : {}) as { job_id?: unknown; label?: unknown; why?: unknown; kind?: unknown }
        return str(x.job_id) ? [{ jobId: str(x.job_id), label: str(x.label) || `job ${str(x.job_id).slice(0, 8)}`, why: str(x.why), kind: str(x.kind) }] : []
      })
    : []
  return { counts, held, line: str(r.line) || tidyOutcomeWords(counts), nextOffset: typeof r.next_offset === 'number' ? r.next_offset : null, total: num(r.total) }
}

/** Pages of the sweep added up: the tab's one tally over a whole walk. */
export function tidyTotals(pages: readonly TidySweep[]): TidyCounts {
  const t: TidyCounts = { looked: 0, made: 0, moved: 0, renamed: 0, inPlace: 0, held: 0, left: 0 }
  for (const p of pages) {
    t.looked += p.counts.looked
    t.made += p.counts.made
    t.moved += p.counts.moved
    t.renamed += p.counts.renamed
    t.inPlace += p.counts.inPlace
    t.held += p.counts.held
    t.left = p.counts.left
  }
  return t
}

/** The press's words while it walks: *Tidying… 75 of 412 · 3 made · 12 moved · 2 held*. */
export function tidyProgressWords(t: TidyCounts, total: number): string {
  const parts = [`${t.looked} of ${Math.max(total, t.looked)}`]
  if (t.made) parts.push(`${t.made} made`)
  if (t.moved) parts.push(`${t.moved} moved`)
  if (t.renamed) parts.push(`${t.renamed} renamed`)
  if (t.held) parts.push(`${t.held} held`)
  return `Tidying… ${parts.join(' · ')}`
}

/** The line once the walk is done: the sweep's own words over the whole of it. */
export function tidyDoneWords(t: TidyCounts): string {
  return tidyOutcomeWords({ ...t, left: 0 })
}

/** The page of the sweep to ask for next: the first from the top, then where the last one stopped; null once every job was looked at. */
export function tidyNextOffset(last: TidySweep | null): number | null {
  if (!last) return 0
  if (last.nextOffset == null || last.nextOffset >= last.total || last.counts.looked === 0) return null
  return last.nextOffset
}
