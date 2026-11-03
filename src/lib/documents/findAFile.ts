/**
 * Find a file (v2.6305, the owner's ask after punch list #236 put every job's files in one Drive folder): one box on
 * the Documents page that searches every job's Drive files by their words. The search is Drive's own full-text index,
 * which already reads the words inside PDFs and the scans it has OCR'd, asked through `drive-link`'s `search` as the
 * service account over the jobs Shared Drive; each hit comes back walked up to the job or bid whose folder holds it,
 * with the folder path under that job. This file is the words and the shapes, pure; the io is `findAFileIo.ts`.
 */
import type { Excerpt } from '../../../supabase/functions/_shared/excerpt'
import { driveViewUrl } from '../../../supabase/functions/_shared/driveLink'
import { headlineToExcerpt } from '../../../supabase/functions/_shared/fileIndexKernel'
import { fileDayWords, fileSizeWords } from '../jobs/jobFolderFiles'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'

export type { Excerpt }

/** Why a hit has no excerpt (v2.6306): a scan with no text layer, a kind we do not read, a file past the cap, a read past the timer. */
export type ExcerptWhy = 'scan' | 'kind' | 'big' | 'slow'
const WHYS: readonly ExcerptWhy[] = ['scan', 'kind', 'big', 'slow']

/** The job or bid whose folder holds a hit. */
export type FileHome =
  | { kind: 'job'; id: string; hcpNumber: string | null; clickNumber: string | null; name: string | null }
  | { kind: 'bid'; id: string; number: string | null; name: string | null }

export type FoundFile = {
  id: string
  name: string
  mime: string
  bytes: number | null
  modified: string | null
  url: string
  home: FileHome | null
  /** The folders between the home and the file, joined with ›; empty at the top of the home's folder. */
  path: string
  /** The line around the words, with the spans to bold (v2.6306), or null with `excerptWhy` saying why. */
  excerpt: Excerpt | null
  excerptWhy: ExcerptWhy | null
}

/** Who answered (punch list #240, PR 1): our own index first, Drive's own search as the floor when the index has nothing. */
export type FindSource = 'index' | 'drive'

export type FindAFileRead = { hits: FoundFile[]; more: boolean; noRoot: boolean; source: FindSource }

/**
 * Drive's search fills in behind the index, as the hint promises: the index's hits first, then Drive's hits the index
 * did not name, with Drive's `more`. While the index is only part full (the backfill running, a file not yet swept) a
 * hit from the index must never hide the file Drive would have found.
 */
export function driveBehindIndex(index: FindAFileRead, drive: FindAFileRead): FindAFileRead {
  if (drive.hits.length === 0) return index
  const named = new Set(index.hits.map((h) => h.id))
  return { ...index, hits: [...index.hits, ...drive.hits.filter((h) => !named.has(h.id))], more: drive.more, noRoot: index.noRoot || drive.noRoot }
}

/** How many hits the index answers; Drive's search answers its own 30. */
export const FIND_MAX_HITS = 30

/** Fewer letters than this searches nothing: Drive's index is by word. */
export const FIND_MIN_CHARS = 2
/** The pause after the last keystroke before the search runs. */
export const FIND_DEBOUNCE_MS = 450

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)

function homeOf(v: unknown): FileHome | null {
  const o = (v ?? null) as Record<string, unknown> | null
  if (!o || typeof o.id !== 'string') return null
  if (o.kind === 'job') return { kind: 'job', id: o.id, hcpNumber: str(o.hcpNumber), clickNumber: str(o.clickNumber), name: str(o.name) }
  if (o.kind === 'bid') return { kind: 'bid', id: o.id, number: str(o.number), name: str(o.name) }
  return null
}

function excerptOfAnswer(v: unknown): Excerpt | null {
  const o = (v ?? null) as Record<string, unknown> | null
  if (!o || typeof o.text !== 'string') return null
  const marks: [number, number][] = []
  for (const m of Array.isArray(o.marks) ? o.marks : []) {
    if (Array.isArray(m) && typeof m[0] === 'number' && typeof m[1] === 'number' && m[0] >= 0 && m[1] > m[0] && m[1] <= o.text.length) marks.push([m[0], m[1]])
  }
  return { text: o.text, marks }
}

function whyOf(v: unknown): ExcerptWhy | null {
  return WHYS.find((w) => w === v) ?? null
}

/** The function's answer as the box reads it; a shape it does not know reads as no hits. */
export function findAFileFromAnswer(d: unknown): FindAFileRead {
  const o = (d ?? {}) as Record<string, unknown>
  const hits: FoundFile[] = []
  for (const raw of Array.isArray(o.hits) ? o.hits : []) {
    const h = (raw ?? {}) as Record<string, unknown>
    if (typeof h.id !== 'string' || typeof h.name !== 'string') continue
    hits.push({
      id: h.id,
      name: h.name,
      mime: str(h.mime) ?? 'application/octet-stream',
      bytes: typeof h.bytes === 'number' && Number.isFinite(h.bytes) ? h.bytes : null,
      modified: str(h.modified),
      url: str(h.url) ?? `https://drive.google.com/file/d/${h.id}/view`,
      home: homeOf(h.home),
      path: str(h.path) ?? '',
      excerpt: excerptOfAnswer(h.excerpt),
      excerptWhy: whyOf(h.excerptWhy),
    })
  }
  return { hits, more: o.more === true, noRoot: o.noRoot === true, source: 'drive' }
}

/** A row of `search_file_index` as the RPC answers it (the columns the box reads). */
export interface IndexHitRow {
  drive_file_id: string
  jobs_ledger_id: string | null
  bid_id: string | null
  folder_kind: string | null
  path: string | null
  name: string
  mime: string | null
  bytes: number | null
  modified_at: string | null
  text_why: string | null
  headline: string | null
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  bid_number: string | null
  project_name: string | null
}

function indexWhyOf(v: unknown): ExcerptWhy | null {
  if (v === 'scan' || v === 'big' || v === 'kind') return v
  if (v === 'slow' || v === 'error' || v === 'reading') return 'slow'
  return null
}

/** The index's rows as the box reads them (punch list #240, PR 1): the headline's `<mark>` spans become the excerpt's marks. A shape it does not know reads as no hits. */
export function findAFileFromIndexRows(d: unknown): FindAFileRead {
  const hits: FoundFile[] = []
  for (const raw of Array.isArray(d) ? d : []) {
    const r = (raw ?? {}) as Partial<IndexHitRow>
    if (typeof r.drive_file_id !== 'string' || typeof r.name !== 'string') continue
    const mime = str(r.mime) ?? 'application/octet-stream'
    const home: FileHome | null = r.jobs_ledger_id
      ? { kind: 'job', id: r.jobs_ledger_id, hcpNumber: str(r.hcp_number), clickNumber: str(r.click_number), name: str(r.job_name) }
      : r.bid_id
        ? { kind: 'bid', id: r.bid_id, number: str(r.bid_number), name: str(r.project_name) }
        : null
    const headline = str(r.headline)
    const excerpt = headline && /<mark>/.test(headline) ? headlineToExcerpt(headline) : null
    hits.push({
      id: r.drive_file_id,
      name: r.name,
      mime,
      bytes: typeof r.bytes === 'number' && Number.isFinite(r.bytes) ? r.bytes : null,
      modified: str(r.modified_at),
      url: driveViewUrl(r.drive_file_id, mime),
      home,
      path: str(r.path) ?? '',
      excerpt,
      excerptWhy: excerpt ? null : indexWhyOf(r.text_why),
    })
  }
  return { hits, more: false, noRoot: false, source: 'index' }
}

/** The heading a group of hits sits under. */
export function homeWords(home: FileHome | null): string {
  if (!home) return 'Not under a job'
  if (home.kind === 'job') {
    const number = effectiveJobLedgerNumber(home.hcpNumber, home.clickNumber)
    return home.name ? `Job ${number} · ${home.name}` : `Job ${number}`
  }
  const number = home.number ? `Bid ${home.number}` : 'Bid'
  return home.name ? `${number} · ${home.name}` : number
}

export type FoundGroup = { key: string; home: FileHome | null; files: FoundFile[] }

/** Hits under their home, in the order Drive ranked them: the first hit's home leads. */
export function groupByHome(hits: readonly FoundFile[]): FoundGroup[] {
  const groups: FoundGroup[] = []
  const at = new Map<string, FoundGroup>()
  for (const f of hits) {
    const key = f.home ? `${f.home.kind}:${f.home.id}` : 'none'
    let g = at.get(key)
    if (!g) {
      g = { key, home: f.home, files: [] }
      at.set(key, g)
      groups.push(g)
    }
    g.files.push(f)
  }
  return groups
}

/** Where the file sits under its home, as the line under its name reads it. */
export function pathWords(f: Pick<FoundFile, 'path' | 'home'>): string | null {
  if (f.path) return f.path
  return f.home ? 'the job’s folder' : null
}

/** The line under a hit: its folder, its day and its size, the ones known. */
export function hitMetaWords(f: Pick<FoundFile, 'path' | 'home' | 'modified' | 'bytes'>, now: Date = new Date()): string {
  return [pathWords(f), fileDayWords(f.modified, now), fileSizeWords(f.bytes)].filter((p): p is string => Boolean(p)).join(' · ')
}

/** The box's words. Each sentence is one idea, as a first-timer reads it. */
export const FIND_WORDS = {
  title: 'Find a file',
  hint: 'Type a few words from the file or its name. Our own index answers first, and Drive’s search fills in behind it.',
  placeholder: 'rock clause, permit, change order…',
  label: 'Find a file by its words',
  searching: 'Searching…',
  filling: 'Drive’s search is still looking…',
  openInDrive: 'Open in Drive',
  openJob: 'Open the job',
  tryAgain: 'Try again',
  failed: 'The search did not run.',
  noRoot: 'The jobs root is not set yet. Set it on Where files go and the search has a place to look.',
} as const

/** Who answered, as the count line names it (punch list #240, PR 1). */
export function sourceWords(source: FindSource): string {
  return source === 'index' ? 'from our index' : 'from Drive'
}

/** The count line over the results, or null when there is nothing to count. */
export function foundWords(read: Pick<FindAFileRead, 'hits' | 'more' | 'source'>, words: string): string | null {
  const n = read.hits.length
  if (n === 0) return null
  const files = n === 1 ? '1 file says' : `${n} files say`
  const from = sourceWords(read.source)
  return read.more ? `${files} “${words}”, ${from}. Drive has more. Add a word to narrow it.` : `${files} “${words}”, ${from}.`
}

/** The empty state's one unit. */
export function emptyFindWords(words: string): { main: string } {
  return { main: `Nothing in the job folders says “${words}”. Try other words, or Drive’s own search.` }
}

/** The excerpt as the line draws it: plain runs and marked runs, in order (v2.6306). */
export function excerptParts(ex: Excerpt): { text: string; mark: boolean }[] {
  const parts: { text: string; mark: boolean }[] = []
  let at = 0
  for (const [a, b] of ex.marks) {
    if (a > at) parts.push({ text: ex.text.slice(at, a), mark: false })
    parts.push({ text: ex.text.slice(a, b), mark: true })
    at = b
  }
  if (at < ex.text.length) parts.push({ text: ex.text.slice(at), mark: false })
  return parts
}

/** The quiet note under a hit with no excerpt, or null when there is nothing to say. */
export function excerptNote(why: ExcerptWhy | null): string | null {
  if (why === 'scan') return 'Matched inside the scan.'
  if (why === 'big') return 'Too big to read here.'
  return null
}

/** A read that failed, with the function's own reason. */
export function findFailedWords(reason: string): string {
  return `${FIND_WORDS.failed} ${reason}`
}
