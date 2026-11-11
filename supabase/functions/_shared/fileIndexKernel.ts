/**
 * Search every file deeply (punch list #240, PR 1, v2.6319): the rules of our own file index, pure, so the app's tests
 * read them as the functions do. One row per Drive file in the jobs Shared Drive (`file_index`): which kinds of file
 * we read the text of and how, which folder of the job a file sits in, which files a pass must index and which it may
 * skip, how a pass keeps inside one request's budget, how the sweep's cursor moves, and how the index's `ts_headline`
 * becomes the excerpt the box draws. No imports but a type, so `src/lib/documents/fileIndexKernel.test.ts` imports it
 * as `drive-link`, `file-index-sweep` and `dev-mcp` do.
 */
import type { Excerpt } from './excerpt.ts'
import { ocrDue, ocrTakes } from './ocrKernel.ts'

/** The text kept on a row: plenty for ranking, and the generated tsvector reads the same cut. */
export const INDEX_TEXT_MAX_CHARS = 200_000
/**
 * The caps on one PDF's read for the index. Over the bytes it is `big`, with no download: the file is held whole in
 * memory to parse, and the platform's 256 MB is the limit that bites. On prod a 25 MB plan set alone ended its worker
 * with *Memory limit exceeded* while an 11 MB one read through (v2.6408; v2.6332 had raised the cap to 50 MB). The
 * pages cap rarely bites, since the time budget or the text cap stops a long PDF first.
 */
export const TEXT_PDF_MAX_BYTES = 12 * 1024 * 1024
export const TEXT_PDF_MAX_PAGES = 1000
export const TEXT_PLAIN_MAX_BYTES = 2 * 1024 * 1024
/**
 * What parsing may spend, in milliseconds of the clock while nothing waits on the network (so never less than its CPU).
 * The platform kills a request at about 2 s of CPU and takes every office request in that worker with it, so one file
 * stops at the first and one request at the second, with room for the rest of the request's work.
 */
export const PDF_READ_BUDGET_MS = 800
export const PASS_READ_BUDGET_MS = 1200
/** The PDF bytes one request holds at most, past the first file: memory is shared by every read in a worker, and the parse holds several times the file. */
export const PASS_READ_MAX_BYTES = 16 * 1024 * 1024
/** What a PDF is expected to cost before it is read: the parse is about this much per megabyte, up to its budget. */
const PDF_ESTIMATE_BASE_MS = 50
const PDF_ESTIMATE_MS_PER_MB = 100

/** The limits of one PDF read. `passBudgetMs` and `passMaxBytes` are what the whole request may have spent and held for this parse to start at all. */
export interface PdfReadLimits {
  maxBytes: number
  maxPages: number
  budgetMs: number
  passBudgetMs: number
  passMaxBytes: number
}

export const INDEX_PDF_LIMITS: PdfReadLimits = { maxBytes: TEXT_PDF_MAX_BYTES, maxPages: TEXT_PDF_MAX_PAGES, budgetMs: PDF_READ_BUDGET_MS, passBudgetMs: PASS_READ_BUDGET_MS, passMaxBytes: PASS_READ_MAX_BYTES }
/** A search reads ten hits' excerpts at once, so it keeps v2.6306's small caps, a short budget for each and the bytes the ten may hold together. */
export const EXCERPT_PDF_LIMITS: PdfReadLimits = { maxBytes: 8 * 1024 * 1024, maxPages: 40, budgetMs: 300, passBudgetMs: 1000, passMaxBytes: 24 * 1024 * 1024 }

/** What one request has spent parsing PDFs, shared by every read in it. */
export interface PassSpend {
  ms: number
  bytes: number
}

export function newPassSpend(): PassSpend {
  return { ms: 0, bytes: 0 }
}
/** Under this many characters, a PDF's text layer is nothing: the file is a scan. */
export const PDF_SCAN_MAX_CHARS = 20
/** How long a search's excerpt read may take; how long an index read may take (the platform's CPU limit is the real cap). */
export const EXCERPT_READ_MS = 3000
export const INDEX_READ_MS = 20_000
/** One indexing request stops taking new files after this long, and answers what remains. */
export const INDEX_BUDGET_MS = 25_000
/** How many files one `index_job` request takes at most, and how many the sweep takes per run. */
export const INDEX_JOB_MAX_FILES = 40
/** With `retry`, a held row is taken again only when its last check is older than this: a run that holds a file again moves on instead of taking it first on every call. */
export const RETRY_HOLD_MS = 60 * 60 * 1000
export const SWEEP_MAX_FILES = 40
/** How many scans the sweep sends to OCR per run once it is set up (the cost cap: 144 runs a day). */
export const SWEEP_OCR_ROWS = 5
/** How many held rows the sweep takes again per run (v2.6491): rows `slow` or `reading` whose last check is an hour old (`RETRY_HOLD_MS`), oldest first. */
export const SWEEP_RETAKE_ROWS = 5
/** The holds a retake takes: a read that ran out of time, or a request the platform stopped mid-read. A `big`, `error` or `kind` hold waits for a press with retry, as before. */
export const RETAKE_WHYS: readonly TextWhy[] = ['slow', 'reading']
/** How many rows the sweep asks Drive about per run, oldest check first, so a trashed file loses its row within days. */
export const SWEEP_RECHECK_ROWS = 20
/** The sweep lists files changed since its stamp less this, so a file that landed as the last run listed is not missed. */
export const SWEEP_OVERLAP_MS = 2 * 60 * 1000
/** The mark a stamp carries when it is a listed file's modified time (exact, listed from inclusively, no overlap) and not a wall clock. */
export const SWEEP_CURSOR_MARK = '#cursor'
/** The `app_settings` key the sweep stamps with the last modified time it has taken whole. */
export const SWEEP_STAMP_KEY = 'file_index_sweep_last_at'

export const GOOGLE_TEXT_KINDS = new Set(['application/vnd.google-apps.document', 'application/vnd.google-apps.spreadsheet', 'application/vnd.google-apps.presentation'])
export const DRIVE_FOLDER_KIND = 'application/vnd.google-apps.folder'

/** The kind a Google file exports as: a Sheet as CSV (Drive refuses text/plain for one), a Doc or Slides as plain text. */
export function exportMimeOf(mimeType: string): string {
  return mimeType === 'application/vnd.google-apps.spreadsheet' ? 'text/csv' : 'text/plain'
}

/**
 * Whether two time strings name the same instant: Drive lists `2026-10-14T15:00:00.000Z` and PostgREST reads the row's
 * `modified_at` back as `2026-10-14T15:00:00+00:00`, so a string compare calls every known row changed.
 */
export function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return !a && !b
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  return Number.isFinite(ta) && Number.isFinite(tb) ? ta === tb : a === b
}

/** A file as Drive lists it to the functions, the fields every list asks for. */
export interface DriveFileMeta {
  id: string
  name: string
  mimeType: string
  size?: string | null
  modifiedTime?: string | null
  parents?: string[] | null
  webViewLink?: string | null
  /** Drive's trashed flag, asked for so a single file's meta (`fileMeta`) tells a trashed file from a live one. */
  trashed?: boolean | null
}

/** Where a row's text came from, and why a row has none. The words `file_index` keeps. */
export type TextSource = 'export' | 'pdf_layer' | 'plain' | 'ocr'
export type TextWhy = 'scan' | 'kind' | 'big' | 'slow' | 'error' | 'reading'

/** How a file's text is read: a Google file exported, a PDF's layer, a text file's bytes, an email's parts decoded (`eml`, #285), a picture (a scan, for OCR), or a kind we do not read. */
export type TextKind = 'export' | 'pdf' | 'plain' | 'eml' | 'image' | 'kind'

export function textKindOf(f: Pick<DriveFileMeta, 'name' | 'mimeType'>): TextKind {
  if (GOOGLE_TEXT_KINDS.has(f.mimeType)) return 'export'
  if (f.mimeType === 'application/pdf' || /\.pdf$/i.test(f.name)) return 'pdf'
  if (f.mimeType === 'message/rfc822' || /\.eml$/i.test(f.name)) return 'eml'
  if (f.mimeType.startsWith('text/') || /\.(csv|md|txt)$/i.test(f.name)) return 'plain'
  if (f.mimeType.startsWith('image/') || /\.(jpe?g|png|heic|heif|gif|tiff?|webp)$/i.test(f.name)) return 'image'
  return 'kind'
}

/** The read of one file's text, or why there is none. `pages` is a PDF's count, and `pagesRead` how many of them the time allowed. */
export type FileTextRead = { text: string; source: TextSource; pages: number | null; pagesRead?: number | null } | { why: Exclude<TextWhy, 'reading'>; pages?: number | null }

/** What a read needs of pdf.js's document. */
export interface PdfDoc {
  numPages: number
  getPage(n: number): Promise<{ getTextContent(): Promise<{ items: readonly unknown[] }>; cleanup?: () => unknown }>
}

/**
 * A PDF's text one page at a time, in the shape unpdf's `extractText` merges it, until the time or the text cap is spent.
 * The first page is always read, so a call makes progress. The clock is checked between pages and never inside one:
 * cancelling pdf.js's text stream throws an uncaught rejection from its message handler, which would crash the worker, so
 * a dense sheet's own cost is the overshoot. A page takes about 17 ms of CPU per megabyte of its drawing here, three
 * times that on the platform, so the budget reads a dozen dense sheets, or hundreds of pages of a written spec. The
 * clock starts here, with the document open: loading pdf.js costs a cold worker's first file its share of the request's
 * budget (`PassSpend`), never that file's pages, or a three-page letter would stay read in part for good.
 */
export async function pdfPagesText(pdf: PdfDoc, limits: Pick<PdfReadLimits, 'maxPages' | 'budgetMs'>, now: () => number): Promise<{ text: string; pagesRead: number }> {
  const startedAt = now()
  const pages: string[] = []
  let chars = 0
  const last = Math.min(pdf.numPages, limits.maxPages)
  for (let n = 1; n <= last; n++) {
    if (n > 1 && (now() - startedAt >= limits.budgetMs || chars >= INDEX_TEXT_MAX_CHARS)) break
    const page = await pdf.getPage(n)
    const content = await page.getTextContent()
    let text = ''
    for (const item of content.items) {
      const it = item as { str?: unknown; hasEOL?: unknown }
      if (typeof it.str === 'string') text += it.str + (it.hasEOL ? '\n' : '')
    }
    pages.push(text)
    chars += text.length
    page.cleanup?.()
  }
  return { text: pages.join('\n').replace(/[^\S\n]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n'), pagesRead: pages.length }
}

/**
 * Whether a pass that has spent this much may start this file. The first file always may, so a call makes progress. A
 * PDF over the cap is `big` with no download and costs nothing; any other PDF needs its expected cost and its bytes to
 * fit. Past the budget nothing starts, and the caller's next request reads the rest.
 */
export function passMayTake(f: Pick<DriveFileMeta, 'name' | 'mimeType' | 'size'>, spend: PassSpend): boolean {
  if (textKindOf(f) !== 'pdf') return spend.ms < PASS_READ_BUDGET_MS
  const bytes = f.size == null || f.size === '' ? 0 : Number(f.size) || 0
  if (bytes > TEXT_PDF_MAX_BYTES) return true
  if (spend.bytes > 0 && spend.bytes + bytes > PASS_READ_MAX_BYTES) return false
  const estimate = Math.min(PDF_READ_BUDGET_MS, PDF_ESTIMATE_BASE_MS + (bytes / (1024 * 1024)) * PDF_ESTIMATE_MS_PER_MB)
  return spend.ms + estimate <= PASS_READ_BUDGET_MS
}

/** The job or bid whose folder holds a file, as the box names it; `customerId` rides along for the row. */
export type FileHome =
  | { kind: 'job'; id: string; hcpNumber: string | null; clickNumber: string | null; name: string | null; customerId: string | null }
  | { kind: 'bid'; id: string; number: string | null; name: string | null; customerId: string | null }

/** A home keyed by one of its folders; `via` names the folder when it is not the home's own (Plans, Customer Pictures). */
export type HomeAt = { home: FileHome; via: string | null }

/** How many folders up a walk climbs before giving up on a home. A plan export sat nine down, past the old eight (v2.6403). */
export const WALK_MAX = 16

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

/** Where a row came from (#285): the jobs Shared Drive, a person_file_attachments row, a legal_matter_documents row. */
export type IndexSource = 'drive' | 'hr_attachment' | 'matter_document'

/** A `file_index` row as the functions write it. */
export interface FileIndexRow {
  /** Drive's id for a Drive file; a record's file carries its own row id here (a uuid passes the key's shape). */
  drive_file_id: string
  /** The reach (#285): `drive` with no source_id, else the record's row and the person or matter it hangs on, and the evidence record's counsel-only mark. */
  source: IndexSource
  source_id: string | null
  person_id: string | null
  matter_id: string | null
  counsel_only: boolean
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
  pages_read: number | null
  indexed_at: string
  checked_at: string
  /** OCR (PR 3): when a scan was last sent, how many pages were read, the provider's reason when it refused. */
  ocr_tried_at: string | null
  ocr_pages: number | null
  ocr_note: string | null
  /** Meaning (PR 4): when the chunks were last embedded and last tried, the provider's reason when it refused. The pass sets them after the row. */
  embedded_at: string | null
  embed_tried_at: string | null
  embed_note: string | null
}

/** What one file's OCR try left behind, for the row: nothing tried, read (the text is the read's), or refused with the reason. */
export type OcrTry = { tried: false } | { tried: true; note: string | null }
export const NO_OCR_TRY: OcrTry = { tried: false }

/** The reach columns of a Drive row (#285): the source every row before v2.6714 was. */
export const DRIVE_SOURCE_COLUMNS: Pick<FileIndexRow, 'source' | 'source_id' | 'person_id' | 'matter_id' | 'counsel_only'> = { source: 'drive', source_id: null, person_id: null, matter_id: null, counsel_only: false }

/** The row's home columns from a walk. */
export function homeColumns(home: FileHome | null): Pick<FileIndexRow, 'jobs_ledger_id' | 'bid_id' | 'customer_id'> {
  if (!home) return { jobs_ledger_id: null, bid_id: null, customer_id: null }
  if (home.kind === 'job') return { jobs_ledger_id: home.id, bid_id: null, customer_id: home.customerId }
  return { jobs_ledger_id: null, bid_id: home.id, customer_id: home.customerId }
}

/** The columns a read writes on a row, as `readColumns` gives them. */
export type ReadColumns = Pick<FileIndexRow, 'text' | 'text_source' | 'text_why' | 'pages' | 'pages_read' | 'indexed_at' | 'checked_at' | 'ocr_tried_at' | 'ocr_pages' | 'ocr_note' | 'embedded_at' | 'embed_tried_at' | 'embed_note'>

/**
 * The columns one read writes: the text and its source, or why there is none; the pages; the index and check stamps;
 * the OCR try; and the chunks' stamps cleared, since every write of the text leaves the row due for the embedding pass.
 * `indexRowOf` writes them under the file's own columns; the OCR pass writes them alone on a row it already holds
 * (v2.6491), so a scan read by OCR gets the same columns whichever pass read it.
 */
export function readColumns(read: FileTextRead | { why: 'reading' }, now: Date, ocr: OcrTry = NO_OCR_TRY): ReadColumns {
  const stamp = now.toISOString()
  const fromOcr = 'text' in read && read.source === 'ocr'
  return {
    text: 'text' in read ? cutText(read.text.replace(/\u0000/g, ''), INDEX_TEXT_MAX_CHARS) : null,
    text_source: 'text' in read ? read.source : null,
    text_why: 'text' in read ? null : read.why,
    pages: 'text' in read ? read.pages : null,
    pages_read: 'text' in read ? (read.pagesRead ?? read.pages) : null,
    indexed_at: stamp,
    checked_at: stamp,
    ocr_tried_at: ocr.tried ? stamp : null,
    ocr_pages: fromOcr ? read.pages : null,
    ocr_note: ocr.tried && !fromOcr ? (ocr.note ?? 'no reason given').slice(0, 1000) : null,
    embedded_at: null,
    embed_tried_at: null,
    embed_note: null,
  }
}

/** The columns an OCR refusal writes on a scan the table already holds (v2.6491): the try and its reason, checked now. The text columns and the index stamp stay, since nothing about the text changed; the row stays a scan, due again a day later. */
export function ocrRefusedColumns(note: string | null, now: Date): Pick<FileIndexRow, 'ocr_tried_at' | 'ocr_note' | 'checked_at'> {
  const stamp = now.toISOString()
  return { ocr_tried_at: stamp, ocr_note: (note ?? 'no reason given').slice(0, 1000), checked_at: stamp }
}

/** The row for a file whose text was read, or whose read answered why not. `now` is the stamp. */
export function indexRowOf(f: DriveFileMeta, walk: { home: FileHome | null; via: string | null; names: readonly string[]; path: string }, read: FileTextRead | { why: 'reading' }, now: Date, ocr: OcrTry = NO_OCR_TRY): FileIndexRow {
  const bytes = f.size == null || f.size === '' ? null : Number(f.size)
  return {
    drive_file_id: f.id,
    ...DRIVE_SOURCE_COLUMNS,
    ...homeColumns(walk.home),
    folder_kind: folderKindOf(walk.home, walk.via, walk.names),
    path: walk.path.slice(0, 2000),
    name: (f.name || 'Untitled').slice(0, 1000),
    mime: (f.mimeType || 'application/octet-stream').slice(0, 200),
    bytes: bytes != null && Number.isFinite(bytes) ? bytes : null,
    modified_at: f.modifiedTime ?? null,
    ...readColumns(read, now, ocr),
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
  checked_at: string | null
  /** When OCR last tried the row, read by the plan once OCR is set up. */
  ocr_tried_at?: string | null
}

/** Whether a held row's last check is old enough for a retry to take it again (`RETRY_HOLD_MS`); a row with no stamp is due. */
export function retryDue(checkedAt: string | null, now: Date): boolean {
  if (!checkedAt) return true
  const t = Date.parse(checkedAt)
  return !Number.isFinite(t) || now.getTime() - t >= RETRY_HOLD_MS
}

/** Why a listed file is passed over. */
export type SkipWhy = 'current' | 'held'

/**
 * Which listed files a pass indexes: one not in the table, or modified since its row; one whose row is held (`big`,
 * `slow`, `error`, or `reading` from a stopped request) only with `retry`, and then only when its last check is an
 * hour old (`retryDue`), so a run that holds a file again moves past it instead of taking it first on every call; a
 * scan (`scan`) when OCR is set up (`ocr`), the kind is one Document AI reads and the row is due (never tried, or tried
 * over a day ago), named in `forOcr` so the pass can cap its OCR calls; a `kind` is never
 * read. A row with text and the same modified time is current. Folders and a file listed twice are passed over.
 */
export function indexPlan(listed: readonly DriveFileMeta[], known: ReadonlyMap<string, KnownRow>, opts: { retry?: boolean; ocr?: boolean; now?: Date } = {}): { toIndex: DriveFileMeta[]; skipped: { id: string; why: SkipWhy }[]; forOcr: Set<string> } {
  const toIndex: DriveFileMeta[] = []
  const skipped: { id: string; why: SkipWhy }[] = []
  const forOcr = new Set<string>()
  const seen = new Set<string>()
  for (const f of listed) {
    if (f.mimeType === DRIVE_FOLDER_KIND || seen.has(f.id)) continue
    seen.add(f.id)
    const row = known.get(f.id)
    if (!row) {
      toIndex.push(f)
      continue
    }
    const changed = !sameInstant(f.modifiedTime, row.modified_at)
    if (changed) {
      toIndex.push(f)
      continue
    }
    const held = Boolean(row.text_why && row.text_why !== 'scan' && row.text_why !== 'kind')
    if (held && opts.retry && retryDue(row.checked_at, opts.now ?? new Date())) {
      toIndex.push(f)
      continue
    }
    if (row.text_why === 'scan' && opts.ocr && ocrTakes(f) && ocrDue(row.ocr_tried_at ?? null, opts.now ?? new Date())) {
      toIndex.push(f)
      forOcr.add(f.id)
      continue
    }
    skipped.push({ id: f.id, why: held ? 'held' : 'current' })
  }
  return { toIndex, skipped, forOcr }
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

/** The text cut to the cap on a whole character: a cut inside a surrogate pair leaves a half no JSON carries, and the row's write fails. */
export function cutText(text: string, max: number): string {
  if (text.length <= max) return text
  const last = text.charCodeAt(max - 1)
  return text.slice(0, last >= 0xd800 && last <= 0xdbff ? max - 1 : max)
}

/**
 * The sweep's next stamp. The sweep lists files modified after the stamp (less the overlap), oldest first, and takes up
 * to its cap: when it handled them all and Drive had no more, the stamp is now; when files were left, the stamp is the
 * pass's cursor (`passCursor`: the last listed file handled, taken or passed over), so the next run starts there; when
 * the pass handled nothing (the budget ran out before the first file), null keeps the old stamp.
 */
export function sweepStamp(now: Date, cursorModified: string | null, left: number): string | null {
  if (left <= 0) return now.toISOString()
  return cursorModified ? `${cursorModified}${SWEEP_CURSOR_MARK}` : null
}

/** The ISO time the sweep lists from: the stamp less the overlap, or the dawn of the drive when there is no stamp. */
export function sweepSince(stamp: string | null, overlapMs = SWEEP_OVERLAP_MS): { since: string; inclusive: boolean } {
  const cursor = Boolean(stamp && stamp.endsWith(SWEEP_CURSOR_MARK))
  const bare = stamp && cursor ? stamp.slice(0, -SWEEP_CURSOR_MARK.length) : stamp
  const t = bare ? Date.parse(bare) : NaN
  if (!Number.isFinite(t)) return { since: '1970-01-01T00:00:00.000Z', inclusive: false }
  // A cursor is a file's own modified time: listed from inclusively (the file itself is current and skipped, a file
  // stamped alike is not lost) with no overlap, so a dense minute of uploads can never hold the stamp still. A wall
  // clock is listed from two minutes back, since Drive lists a file a little after it lands.
  return cursor ? { since: new Date(t).toISOString(), inclusive: true } : { since: new Date(t - overlapMs).toISOString(), inclusive: false }
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
  // A held row is indexed too (its row says why it has no words), so the line says how many have their words.
  const withWords = Math.max(0, a.indexed - a.held.length)
  const words = a.held.length > 0 && withWords > 0 ? `, ${withWords} with their words` : ''
  const held = a.held.length === 0 ? '' : a.held.length === 1 ? ', 1 held' : `, ${a.held.length} held`
  const left = a.remaining > 0 ? `, ${a.remaining} to go` : ''
  return `Indexed ${files}${words}${held}${left}.`
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
