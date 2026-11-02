/**
 * Search every file deeply (punch list #240, PR 1, v2.6319): the rules of our own file index, pure, so the app's tests
 * read them as the functions do. One row per Drive file in the jobs Shared Drive (`file_index`): which kinds of file
 * we read the text of and how, which folder of the job a file sits in, which files a pass must index and which it may
 * skip, how a pass keeps inside one request's budget, how the sweep's cursor moves, and how the index's `ts_headline`
 * becomes the excerpt the box draws. No imports but a type, so `src/lib/documents/fileIndexKernel.test.ts` imports it
 * as `drive-link`, `file-index-sweep` and `dev-mcp` do.
 */
import type { Excerpt } from './excerpt.ts'

/** The text kept on a row: plenty for ranking, and the generated tsvector reads the same cut. */
export const INDEX_TEXT_MAX_CHARS = 200_000
/** The caps on one file's read (v2.6306's, shared with the excerpt line): a PDF past them is `big`. */
export const TEXT_PDF_MAX_BYTES = 8 * 1024 * 1024
export const TEXT_PDF_MAX_PAGES = 40
export const TEXT_PLAIN_MAX_BYTES = 2 * 1024 * 1024
/** Under this many characters, a PDF's text layer is nothing: the file is a scan. */
export const PDF_SCAN_MAX_CHARS = 20
/** How long a search's excerpt read may take; how long an index read may take (the platform's CPU limit is the real cap). */
export const EXCERPT_READ_MS = 3000
export const INDEX_READ_MS = 20_000
/** One indexing request stops taking new files after this long, and answers what remains. */
export const INDEX_BUDGET_MS = 25_000
/** How many files one `index_job` request takes at most, and how many the sweep takes per run. */
export const INDEX_JOB_MAX_FILES = 40
export const SWEEP_MAX_FILES = 40
/** How many rows the sweep asks Drive about per run, oldest check first, so a trashed file loses its row within days. */
export const SWEEP_RECHECK_ROWS = 20
/** The sweep lists files changed since its stamp less this, so a file that landed as the last run listed is not missed. */
export const SWEEP_OVERLAP_MS = 2 * 60 * 1000
/** The `app_settings` key the sweep stamps with the last modified time it has taken whole. */
export const SWEEP_STAMP_KEY = 'file_index_sweep_last_at'

export const GOOGLE_TEXT_KINDS = new Set(['application/vnd.google-apps.document', 'application/vnd.google-apps.spreadsheet', 'application/vnd.google-apps.presentation'])
export const DRIVE_FOLDER_KIND = 'application/vnd.google-apps.folder'

/** A file as Drive lists it to the functions, the fields every list asks for. */
export interface DriveFileMeta {
  id: string
  name: string
  mimeType: string
  size?: string | null
  modifiedTime?: string | null
  parents?: string[] | null
  webViewLink?: string | null
}

/** Where a row's text came from, and why a row has none. The words `file_index` keeps. */
export type TextSource = 'export' | 'pdf_layer' | 'plain' | 'ocr'
export type TextWhy = 'scan' | 'kind' | 'big' | 'slow' | 'error' | 'reading'

/** How a file's text is read: a Google file exported, a PDF's layer, a text file's bytes, a picture (a scan, for OCR), or a kind we do not read. */
export type TextKind = 'export' | 'pdf' | 'plain' | 'image' | 'kind'

export function textKindOf(f: Pick<DriveFileMeta, 'name' | 'mimeType'>): TextKind {
  if (GOOGLE_TEXT_KINDS.has(f.mimeType)) return 'export'
  if (f.mimeType === 'application/pdf' || /\.pdf$/i.test(f.name)) return 'pdf'
  if (f.mimeType.startsWith('text/') || /\.(csv|md|txt)$/i.test(f.name)) return 'plain'
  if (f.mimeType.startsWith('image/') || /\.(jpe?g|png|heic|heif|gif|tiff?|webp)$/i.test(f.name)) return 'image'
  return 'kind'
}

/** The read of one file's text, or why there is none. `pages` is a PDF's count. */
export type FileTextRead = { text: string; source: TextSource; pages: number | null } | { why: Exclude<TextWhy, 'reading'> }

/** The job or bid whose folder holds a file, as the box names it; `customerId` rides along for the row. */
export type FileHome =
  | { kind: 'job'; id: string; hcpNumber: string | null; clickNumber: string | null; name: string | null; customerId: string | null }
  | { kind: 'bid'; id: string; number: string | null; name: string | null; customerId: string | null }

/** A home keyed by one of its folders; `via` names the folder when it is not the home's own (Plans, Customer Pictures). */
export type HomeAt = { home: FileHome; via: string | null }

/** How many folders up a walk climbs before giving up on a home. */
export const WALK_MAX = 8

/**
 * Climbs a file's folders until one is a home or the jobs root, naming the folders between (top down). `metaOf` reads
 * one folder's name and parent; the callers cache it. Pure given the reader, so the test hands it a map.
 */
export async function walkUp(
  startId: string | null,
  homes: ReadonlyMap<string, HomeAt>,
  rootId: string,
  metaOf: (id: string) => Promise<{ name: string; parent: string | null }>,
): Promise<{ home: FileHome | null; via: string | null; names: string[]; path: string }> {
  const names: string[] = []
  let id = startId
  for (let i = 0; id && i < WALK_MAX; i++) {
    const at = homes.get(id)
    if (at) {
      const between = names.reverse()
      return { home: at.home, via: at.via, names: between, path: [at.via, ...between].filter((n): n is string => Boolean(n)).join(' › ') }
    }
    if (id === rootId) break
    const m = await metaOf(id)
    names.push(m.name)
    id = m.parent
  }
  const between = names.reverse().filter(Boolean)
  return { home: null, via: null, names: between, path: between.join(' › ') }
}

/** Which of a job's folders a file sits in, from the walk: the names are the folders between the home and the file. */
export type FolderKind = 'top' | 'plans' | 'pictures' | 'photos' | 'sent' | 'other'

export function folderKindOf(home: FileHome | null, via: string | null, names: readonly string[]): FolderKind {
  if (!home || home.kind !== 'job') return 'other'
  const first = via ?? names[0] ?? null
  const second = via ? names[0] ?? null : names[1] ?? null
  if (!first) return 'top'
  if (first === 'Plans') return 'plans'
  if (first === 'Customer Pictures') return 'pictures'
  if (first === 'Team only') {
    if (second === 'Photos') return 'photos'
    if (second === 'Sent by us') return 'sent'
  }
  return 'other'
}

/** A `file_index` row as the functions write it. */
export interface FileIndexRow {
  drive_file_id: string
  jobs_ledger_id: string | null
  bid_id: string | null
  customer_id: string | null
  folder_kind: FolderKind
  path: string
  name: string
  mime: string
  bytes: number | null
  modified_at: string | null
  text: string | null
  text_source: TextSource | null
  text_why: TextWhy | null
  pages: number | null
  indexed_at: string
  checked_at: string
}

/** The row's home columns from a walk. */
export function homeColumns(home: FileHome | null): Pick<FileIndexRow, 'jobs_ledger_id' | 'bid_id' | 'customer_id'> {
  if (!home) return { jobs_ledger_id: null, bid_id: null, customer_id: null }
  if (home.kind === 'job') return { jobs_ledger_id: home.id, bid_id: null, customer_id: home.customerId }
  return { jobs_ledger_id: null, bid_id: home.id, customer_id: home.customerId }
}

/** The row for a file whose text was read, or whose read answered why not. `now` is the stamp. */
export function indexRowOf(f: DriveFileMeta, walk: { home: FileHome | null; via: string | null; names: readonly string[]; path: string }, read: FileTextRead | { why: 'reading' }, now: Date): FileIndexRow {
  const stamp = now.toISOString()
  const bytes = f.size == null || f.size === '' ? null : Number(f.size)
  return {
    drive_file_id: f.id,
    ...homeColumns(walk.home),
    folder_kind: folderKindOf(walk.home, walk.via, walk.names),
    path: walk.path.slice(0, 2000),
    name: (f.name || 'Untitled').slice(0, 1000),
    mime: (f.mimeType || 'application/octet-stream').slice(0, 200),
    bytes: bytes != null && Number.isFinite(bytes) ? bytes : null,
    modified_at: f.modifiedTime ?? null,
    text: 'text' in read ? read.text.replace(/\u0000/g, '').slice(0, INDEX_TEXT_MAX_CHARS) : null,
    text_source: 'text' in read ? read.source : null,
    text_why: 'text' in read ? null : read.why,
    pages: 'text' in read ? read.pages : null,
    indexed_at: stamp,
    checked_at: stamp,
  }
}

/** The row stamped before a read starts: a request the platform stops mid-read leaves `reading`, which the next pass reads as `slow`. */
export function readingRowOf(f: DriveFileMeta, walk: { home: FileHome | null; via: string | null; names: readonly string[]; path: string }, now: Date): FileIndexRow {
  return indexRowOf(f, walk, { why: 'reading' }, now)
}

/** What a pass knows of a file already in the table. */
export interface KnownRow {
  drive_file_id: string
  modified_at: string | null
  text_why: TextWhy | null
  text_source: TextSource | null
}

/** Why a listed file is passed over. */
export type SkipWhy = 'current' | 'held'

/**
 * Which listed files a pass indexes: one not in the table, or modified since its row; one whose row is held (`big`,
 * `kind`, `slow`, `error`, or `reading` from a stopped request) only with `retry`. A row with text and the same
 * modified time is current. A folder is never a file.
 */
export function indexPlan(listed: readonly DriveFileMeta[], known: ReadonlyMap<string, KnownRow>, opts: { retry?: boolean } = {}): { toIndex: DriveFileMeta[]; skipped: { id: string; why: SkipWhy }[] } {
  const toIndex: DriveFileMeta[] = []
  const skipped: { id: string; why: SkipWhy }[] = []
  const seen = new Set<string>()
  for (const f of listed) {
    if (f.mimeType === DRIVE_FOLDER_KIND || seen.has(f.id)) continue
    seen.add(f.id)
    const row = known.get(f.id)
    if (!row) {
      toIndex.push(f)
      continue
    }
    const changed = (f.modifiedTime ?? null) !== (row.modified_at ?? null)
    if (changed) {
      toIndex.push(f)
      continue
    }
    if (row.text_why && row.text_why !== 'scan' && row.text_why !== 'kind' && opts.retry) {
      toIndex.push(f)
      continue
    }
    skipped.push({ id: f.id, why: row.text_why && row.text_why !== 'scan' && row.text_why !== 'kind' ? 'held' : 'current' })
  }
  return { toIndex, skipped }
}

/** A file a pass could not read, named with its reason for the report. */
export interface HeldFile {
  id: string
  name: string
  why: Exclude<TextWhy, 'reading'>
}

/** The answer of one indexing request: what it took, what it held, and how many files are left for the next call. */
export interface IndexPassAnswer {
  indexed: number
  held: HeldFile[]
  remaining: number
}

/** The pass's answer with what the sweep's cursor needs: the modified time of the last listed file the pass handled, if any. */
export interface IndexPassResult extends IndexPassAnswer {
  planned: number
  skipped: number
  cursorModified: string | null
}

/**
 * The sweep's cursor after a pass: the modified time of the last file, in the list's order, that the pass handled
 * (taken, or passed over as current or held), stopping at the first file the pass left untaken. So a run whose listed
 * files are all current still moves on, and the stamp never passes a file that is still waiting. Null when the pass
 * handled nothing.
 */
export function passCursor(listed: readonly DriveFileMeta[], toIndex: ReadonlySet<string>, taken: ReadonlySet<string>): string | null {
  let cursor: string | null = null
  for (const f of listed) {
    if (toIndex.has(f.id) && !taken.has(f.id)) break
    cursor = f.modifiedTime ?? cursor
  }
  return cursor
}

/** Whether a pass has time for one more file inside its budget. */
export function budgetAllows(startedMs: number, nowMs: number, budgetMs = INDEX_BUDGET_MS): boolean {
  return nowMs - startedMs < budgetMs
}

/** The `text_why` a stopped request's `reading` stamp reads as once the pass is over. */
export function settledWhy(why: TextWhy | null): Exclude<TextWhy, 'reading'> | null {
  return why === 'reading' ? 'slow' : why
}

/**
 * The sweep's next stamp. The sweep lists files modified after the stamp (less the overlap), oldest first, and takes up
 * to its cap: when it handled them all and Drive had no more, the stamp is now; when files were left, the stamp is the
 * pass's cursor (`passCursor`: the last listed file handled, taken or passed over), so the next run starts there; when
 * the pass handled nothing (the budget ran out before the first file), null keeps the old stamp.
 */
export function sweepStamp(now: Date, cursorModified: string | null, left: number): string | null {
  if (left <= 0) return now.toISOString()
  return cursorModified
}

/** The ISO time the sweep lists from: the stamp less the overlap, or the dawn of the drive when there is no stamp. */
export function sweepSince(stamp: string | null, overlapMs = SWEEP_OVERLAP_MS): string {
  const t = stamp ? Date.parse(stamp) : NaN
  if (!Number.isFinite(t)) return '1970-01-01T00:00:00.000Z'
  return new Date(t - overlapMs).toISOString()
}

/** A query term as Drive's `q` takes it: backslashes and quotes escaped. */
export function driveQueryTerm(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/**
 * The index's `ts_headline` (StartSel `<mark>`, StopSel `</mark>`) as the box's excerpt: the plain text and the spans
 * to bold, the tags gone. A headline with no marks is the text alone.
 */
export function headlineToExcerpt(headline: string): Excerpt {
  const collapsed = headline.replace(/\s+/g, ' ').trim()
  const marks: [number, number][] = []
  let text = ''
  let i = 0
  const re = /<mark>([\s\S]*?)<\/mark>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(collapsed))) {
    text += collapsed.slice(i, m.index)
    const start = text.length
    text += m[1]
    marks.push([start, text.length])
    i = m.index + m[0].length
  }
  text += collapsed.slice(i)
  return { text, marks: mergeMarks(text, marks) }
}

/** Overlapping marks merge, and so do two a single space apart, so "rock clause" bolds as one (the excerpt line's rule). */
function mergeMarks(text: string, marks: [number, number][]): [number, number][] {
  const merged: [number, number][] = []
  for (const m of marks.sort((a, b) => a[0] - b[0])) {
    const last = merged[merged.length - 1]
    if (last && (m[0] <= last[1] || (m[0] === last[1] + 1 && text[last[1]] === ' '))) last[1] = Math.max(last[1], m[1])
    else merged.push([m[0], m[1]])
  }
  return merged
}

/** The count line's words for an index pass, as the press and the dev seat read them. */
export function indexPassWords(a: IndexPassAnswer): string {
  const files = a.indexed === 1 ? '1 file' : `${a.indexed} files`
  const held = a.held.length === 0 ? '' : a.held.length === 1 ? ', 1 held' : `, ${a.held.length} held`
  const left = a.remaining > 0 ? `, ${a.remaining} to go` : ''
  return `Indexed ${files}${held}${left}.`
}

/** Why a held file was held, in the office's words. */
export function heldWhyWords(why: HeldFile['why']): string {
  switch (why) {
    case 'scan':
      return 'a scan with no text to read'
    case 'kind':
      return 'a kind of file the index does not read'
    case 'big':
      return 'too big to read'
    case 'slow':
      return 'the read ran out of time'
    case 'error':
      return 'the read failed'
  }
}
