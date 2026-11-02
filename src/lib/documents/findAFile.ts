/**
 * Find a file (v2.6305, the owner's ask after punch list #236 put every job's files in one Drive folder): one box on
 * the Documents page that searches every job's Drive files by their words. The search is Drive's own full-text index,
 * which already reads the words inside PDFs and the scans it has OCR'd, asked through `drive-link`'s `search` as the
 * service account over the jobs Shared Drive; each hit comes back walked up to the job or bid whose folder holds it,
 * with the folder path under that job. This file is the words and the shapes, pure; the io is `findAFileIo.ts`.
 */
import { fileDayWords, fileSizeWords } from '../jobs/jobFolderFiles'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'

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
}

export type FindAFileRead = { hits: FoundFile[]; more: boolean; noRoot: boolean }

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
    })
  }
  return { hits, more: o.more === true, noRoot: o.noRoot === true }
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
  hint: 'Type a few words from the file or its name. Drive reads the words inside PDFs and the scans it has read.',
  placeholder: 'rock clause, permit, change order…',
  label: 'Find a file by its words',
  searching: 'Searching…',
  openInDrive: 'Open in Drive',
  openJob: 'Open the job',
  tryAgain: 'Try again',
  failed: 'The search did not run.',
  noRoot: 'The jobs root is not set yet. Set it on Where files go and the search has a place to look.',
} as const

/** The count line over the results, or null when there is nothing to count. */
export function foundWords(read: Pick<FindAFileRead, 'hits' | 'more'>, words: string): string | null {
  const n = read.hits.length
  if (n === 0) return null
  const files = n === 1 ? '1 file says' : `${n} files say`
  return read.more ? `${files} “${words}”, and Drive has more. Add a word to narrow it.` : `${files} “${words}”.`
}

/** The empty state's one unit. */
export function emptyFindWords(words: string): { main: string } {
  return { main: `Nothing in the job folders says “${words}”. Try other words, or Drive’s own search.` }
}

/** A read that failed, with the function's own reason. */
export function findFailedWords(reason: string): string {
  return `${FIND_WORDS.failed} ${reason}`
}
