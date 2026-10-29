/**
 * Where files go (punch list #211, 2026-10-29): the pure rules behind the office's Documents → Where files go tab.
 * The office sets the jobs root the app files under, how a job's and a bid's Drive folder is named, and whether a job's
 * folders are made up front or as something first lands in each. The settings are `app_settings` rows (the keys below,
 * mirrored by `src/lib/appSettingsKeys.ts`); the functions read them through the service client with the
 * `DRIVE_JOBS_FOLDER_ID` env as the root's fallback while the setting is empty (`driveSettings.ts`).
 *
 * No imports, so the app's tests import it as the functions do (`src/lib/documents/folderName.ts` re-exports it).
 * The five folder names inside a job's folder stay fixed: the sweeps, the sent-copies path and the plans intake read them.
 */

/** `app_settings.key` — the Drive folder id of the jobs root; empty = the `DRIVE_JOBS_FOLDER_ID` env. */
export const DRIVE_JOBS_ROOT_FOLDER_ID_KEY = 'drive_jobs_root_folder_id'
/** `app_settings.key` — a JSON list of a job folder's pieces in order, `["number","name"]` as it ships. */
export const DRIVE_JOB_FOLDER_PATTERN_KEY = 'drive_job_folder_pattern'
/** `app_settings.key` — a JSON list of a bid folder's pieces in order, `["project"]` as it ships. */
export const DRIVE_BID_FOLDER_PATTERN_KEY = 'drive_bid_folder_pattern'
/** `app_settings.key` — `upfront` (every folder when the job's is made) or `as-needed` (each when something first lands). */
export const DRIVE_FOLDERS_MADE_KEY = 'drive_folders_made'

/** The pieces a job's folder name is built from, in the order the tray offers them. */
export type JobFolderPiece = 'number' | 'name' | 'customer' | 'address' | 'year'
export const JOB_FOLDER_PIECES: readonly JobFolderPiece[] = ['number', 'name', 'customer', 'address', 'year']
export const DEFAULT_JOB_FOLDER_PATTERN: readonly JobFolderPiece[] = ['number', 'name']
export const JOB_FOLDER_PIECE_LABELS: Readonly<Record<JobFolderPiece, string>> = {
  number: 'Job number',
  name: 'Job name',
  customer: 'Customer',
  address: 'Address',
  year: 'Year',
}

/** The pieces a bid's folder name is built from. */
export type BidFolderPiece = 'project' | 'number' | 'customer' | 'address' | 'year'
export const BID_FOLDER_PIECES: readonly BidFolderPiece[] = ['project', 'number', 'customer', 'address', 'year']
export const DEFAULT_BID_FOLDER_PATTERN: readonly BidFolderPiece[] = ['project']
export const BID_FOLDER_PIECE_LABELS: Readonly<Record<BidFolderPiece, string>> = {
  project: 'Project name',
  number: 'Bid number',
  customer: 'Customer',
  address: 'Address',
  year: 'Year',
}

/** Between two pieces of a folder's name, as the Materials desk labels a job. */
export const FOLDER_NAME_SEPARATOR = ' · '
/** Drive takes longer names; the office reads them in a list. */
export const FOLDER_NAME_MAX = 120

/** When a job's folders are made: all of them with the job's folder, or each as something first lands in it. */
export type FoldersMade = 'upfront' | 'as-needed'
export const DEFAULT_FOLDERS_MADE: FoldersMade = 'upfront'

/** The five folders inside a job's folder, fixed: the sweeps, the sent-copies path and the plans intake read them. */
export const JOB_FOLDER_TREE = {
  pictures: 'Customer Pictures',
  plans: 'Plans',
  teamOnly: 'Team only',
  photos: 'Photos',
  sentByUs: 'Sent by us',
} as const

/**
 * A pattern as stored: a JSON list of pieces. A piece the tray does not offer and a piece named twice are dropped; a list
 * with nothing left, or a value that is not a list, reads as the fallback. Never throws.
 */
export function parseFolderPattern<P extends string>(raw: string | null | undefined, pieces: readonly P[], fallback: readonly P[]): P[] {
  const s = (raw ?? '').trim()
  if (!s) return [...fallback]
  let parsed: unknown
  try {
    parsed = JSON.parse(s)
  } catch {
    return [...fallback]
  }
  if (!Array.isArray(parsed)) return [...fallback]
  const out: P[] = []
  for (const p of parsed) {
    if (typeof p === 'string' && (pieces as readonly string[]).includes(p) && !out.includes(p as P)) out.push(p as P)
  }
  return out.length > 0 ? out : [...fallback]
}

export const parseJobFolderPattern = (raw: string | null | undefined): JobFolderPiece[] => parseFolderPattern(raw, JOB_FOLDER_PIECES, DEFAULT_JOB_FOLDER_PATTERN)
export const parseBidFolderPattern = (raw: string | null | undefined): BidFolderPiece[] => parseFolderPattern(raw, BID_FOLDER_PIECES, DEFAULT_BID_FOLDER_PATTERN)

/** The stored form of a pattern. */
export function folderPatternJson(pattern: readonly string[]): string {
  return JSON.stringify(pattern)
}

/** `upfront` or `as-needed`; anything else reads as the default. */
export function parseFoldersMade(raw: string | null | undefined): FoldersMade {
  const s = (raw ?? '').trim()
  return s === 'as-needed' || s === 'upfront' ? s : DEFAULT_FOLDERS_MADE
}

/**
 * A piece of a name as Drive and the sweeps take it: no backslashes (Drive's queries read them as escapes), no control
 * characters, one space between words, nothing at the ends. The same cleaning v2.6054's press used, so a second press finds
 * the folder the first one made.
 */
export function driveSafeName(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/\\/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** What a job's folder name can be built from. `year` is the year the job was made, in the app's calendar. */
export interface JobFolderFacts {
  id: string
  number?: string | null
  name?: string | null
  customer?: string | null
  address?: string | null
  year?: string | number | null
}

/** What a bid's folder name can be built from. */
export interface BidFolderFacts {
  id: string
  project?: string | null
  number?: string | number | null
  customer?: string | null
  address?: string | null
  year?: string | number | null
}

function joinPieces(parts: readonly (string | number | null | undefined)[]): string {
  return parts
    .map((p) => driveSafeName(p == null ? '' : String(p)))
    .filter(Boolean)
    .join(FOLDER_NAME_SEPARATOR)
    .slice(0, FOLDER_NAME_MAX)
    .trim()
}

/**
 * A job's Drive folder name from the office's pattern: the pieces in order, each cleaned, an empty one skipped, joined by
 * ` · ` and capped. A job with none of its pieces filled is named by its id, `Job 7d759246`, so a folder is always made.
 */
export function folderName(pattern: readonly JobFolderPiece[], job: JobFolderFacts): string {
  const name = joinPieces(pattern.map((p) => job[p]))
  return name || `Job ${job.id.slice(0, 8)}`
}

/** A bid's Drive folder name from the bid pattern; a bid with none of its pieces is `Bid <number>` or `Bid <id>`. */
export function bidFolderName(pattern: readonly BidFolderPiece[], bid: BidFolderFacts): string {
  const name = joinPieces(pattern.map((p) => bid[p]))
  return name || `Bid ${bid.number != null && String(bid.number).trim() ? String(bid.number).trim() : bid.id.slice(0, 8)}`
}

/** The settings as the functions and the page read them. `rootFrom` says where the root came from. */
export interface DriveSettings {
  rootFolderId: string | null
  rootFrom: 'setting' | 'env' | null
  jobPattern: JobFolderPiece[]
  bidPattern: BidFolderPiece[]
  foldersMade: FoldersMade
}

/** The four rows (any missing) and the env's root → the settings. The setting wins; the env fills in while it is empty. */
export function driveSettingsFromRows(rows: readonly { key: string; value_text: string | null }[], envRoot: string | null | undefined): DriveSettings {
  const text = (key: string) => rows.find((r) => r.key === key)?.value_text ?? null
  const setRoot = (text(DRIVE_JOBS_ROOT_FOLDER_ID_KEY) ?? '').trim()
  const env = (envRoot ?? '').trim()
  return {
    rootFolderId: setRoot || env || null,
    rootFrom: setRoot ? 'setting' : env ? 'env' : null,
    jobPattern: parseJobFolderPattern(text(DRIVE_JOB_FOLDER_PATTERN_KEY)),
    bidPattern: parseBidFolderPattern(text(DRIVE_BID_FOLDER_PATTERN_KEY)),
    foldersMade: parseFoldersMade(text(DRIVE_FOLDERS_MADE_KEY)),
  }
}

/** drive.google.com/drive/folders/<id> or a bare id → the folder id; null for anything else. */
export function driveFolderIdFromLinkOrId(s: string | null | undefined): string | null {
  const t = (s ?? '').trim()
  if (!t) return null
  const m = /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([\w-]{20,})/.exec(t)
  if (m) return m[1] ?? null
  return /^[\w-]{20,}$/.test(t) ? t : null
}

/** What Drive said when the app looked at a folder, before the words. */
export type WriteCheckSeen =
  | { kind: 'ok' }
  | { kind: 'not_a_folder' }
  | { kind: 'cannot_open'; status: number; reason: string | null }
  | { kind: 'cannot_write' }
  | { kind: 'no_link' }

export const WRITE_OK_WORDS = 'The app can write here.'

/**
 * The write check's answer in words, the same on the root card, on a job's folder and in the photo sweep's reason: *The app
 * can write here.*, or Drive's refusal with what to do, naming the account to share the folder with.
 */
export function writeCheckWords(seen: WriteCheckSeen, appEmail: string): { ok: boolean; words: string } {
  switch (seen.kind) {
    case 'ok':
      return { ok: true, words: WRITE_OK_WORDS }
    case 'no_link':
      return { ok: false, words: 'Paste a Drive folder link first.' }
    case 'not_a_folder':
      return { ok: false, words: 'This link is not a folder. Paste the link of a Drive folder.' }
    case 'cannot_write':
      return { ok: false, words: `The app can open this folder but cannot add a file to it. Share it with ${appEmail} as an editor.` }
    case 'cannot_open':
      return {
        ok: false,
        words: `The app cannot open this folder. Drive answered ${seen.status}${seen.reason ? `: ${seen.reason}` : ''}. Share it with ${appEmail} as an editor.`,
      }
  }
}
