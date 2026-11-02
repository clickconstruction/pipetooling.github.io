/**
 * What is in a job's Drive folders, as the job window's Documents tab shows it (v2.6299, the owner's ask of 2026-11-01:
 * "a user knows what exists before they go looking for it"). Drive is the record of what a folder holds, so the tab
 * reads the five folders live through `job-photos`' `files` action every time it opens and keeps nothing; a file
 * someone dropped in by hand is simply there the next time anyone looks. What the app adds is where a file came from:
 * a photo or a file the app itself filed carries its record, everything else is *Added in Drive*. The words here are
 * pure; `jobFolderFilesIo.ts` reads, `JobDocumentsFolderFiles.tsx` draws.
 */

export type FolderSectionKey = 'job' | 'pictures' | 'plans' | 'photos' | 'sentByUs'

/** A photo or a file the app filed itself, by its record. */
export interface FileFromApp {
  kind: 'photo' | 'link'
  /** The photo's source as `uploaded_photos` names it (report, box, checklist, message), null for a link. */
  source: string | null
}

export interface JobFolderFile {
  id: string
  name: string
  mime: string | null
  bytes: number | null
  /** ISO, Drive's modifiedTime. */
  modified: string | null
  /** Who last changed it, as Drive names them. */
  by: string | null
  url: string | null
  from: FileFromApp | null
}

export interface JobFolderSection {
  key: FolderSectionKey
  name: string
  /** Null when the folder is not made yet (the as-needed choice makes it when something first lands). */
  folderId: string | null
  url: string | null
  /** Newest first, up to the function's cap. */
  files: JobFolderFile[]
  /** The folder holds more than the cap. */
  more: boolean
}

export interface JobFolderFilesRead {
  job: { folderId: string | null; url: string | null; hold: string | null }
  sections: JobFolderSection[]
}

/** How many rows a section shows before *and N more*. */
export const SHOW_FIRST = 5

export const SECTION_ORDER: readonly FolderSectionKey[] = ['pictures', 'plans', 'photos', 'sentByUs', 'job']

const SECTION_KEYS = new Set<string>(SECTION_ORDER)

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function fileFrom(v: unknown): FileFromApp | null {
  if (!v || typeof v !== 'object') return null
  const o = v as { kind?: unknown; source?: unknown }
  if (o.kind !== 'photo' && o.kind !== 'link') return null
  return { kind: o.kind, source: str(o.source) }
}

/** The function's answer as the tab reads it; a shape it does not know reads as empty, never throws. */
export function jobFolderFilesFromAnswer(d: unknown): JobFolderFilesRead {
  const o = (d && typeof d === 'object' ? d : {}) as { job?: unknown; sections?: unknown }
  const j = (o.job && typeof o.job === 'object' ? o.job : {}) as { folderId?: unknown; url?: unknown; hold?: unknown }
  const sections: JobFolderSection[] = []
  for (const raw of Array.isArray(o.sections) ? o.sections : []) {
    if (!raw || typeof raw !== 'object') continue
    const s = raw as { key?: unknown; name?: unknown; folderId?: unknown; url?: unknown; files?: unknown; more?: unknown }
    if (typeof s.key !== 'string' || !SECTION_KEYS.has(s.key)) continue
    const files: JobFolderFile[] = []
    for (const f of Array.isArray(s.files) ? s.files : []) {
      if (!f || typeof f !== 'object') continue
      const r = f as Record<string, unknown>
      const id = str(r.id)
      if (!id) continue
      files.push({ id, name: str(r.name) ?? 'Untitled', mime: str(r.mime), bytes: num(r.bytes), modified: str(r.modified), by: str(r.by), url: str(r.url), from: fileFrom(r.from) })
    }
    sections.push({ key: s.key as FolderSectionKey, name: str(s.name) ?? s.key, folderId: str(s.folderId), url: str(s.url), files, more: s.more === true })
  }
  sections.sort((a, b) => SECTION_ORDER.indexOf(a.key) - SECTION_ORDER.indexOf(b.key))
  return { job: { folderId: str(j.folderId), url: str(j.url), hold: str(j.hold) }, sections }
}

/** The tab has something to show when the job has a folder of its own or any of the five is made. */
export function hasAnyFolder(read: JobFolderFilesRead): boolean {
  return Boolean(read.job.folderId) || read.sections.some((s) => s.folderId)
}

/** *3 files*, *1 file*, *100 or more files*, or *Empty*. */
export function sectionCountWords(s: Pick<JobFolderSection, 'files' | 'more'>): string {
  if (s.more) return `${s.files.length} or more files`
  if (s.files.length === 0) return 'Empty'
  return s.files.length === 1 ? '1 file' : `${s.files.length} files`
}

/** A size as people read it: *412 KB*, *2.1 MB*; null when Drive did not say (a Google Doc has no size). */
export function fileSizeWords(bytes: number | null): string | null {
  if (bytes == null || bytes < 0) return null
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`
  const mb = kb / 1024
  return mb < 10 ? `${Math.round(mb * 10) / 10} MB` : `${Math.round(mb)} MB`
}

/** *Nov 1*, or *Nov 1, 2025* when it was another year. */
export function fileDayWords(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })
}

/** The row's second line: *Nov 1 · 2.1 MB · Taunya McLemore*, whatever of the three Drive said. */
export function fileMetaWords(f: Pick<JobFolderFile, 'modified' | 'bytes' | 'by'>, now: Date = new Date()): string {
  return [fileDayWords(f.modified, now), fileSizeWords(f.bytes), f.by].filter((p): p is string => Boolean(p)).join(' · ')
}

const SOURCE_WORDS: Record<string, string> = {
  report: 'a report photo',
  checklist: 'a checklist photo',
  box: 'a Tally photo',
  message: 'a photo from a text or an email',
}

/** Where a file came from: the app's own record, or a hand in Drive. */
export function fromWords(f: Pick<JobFolderFile, 'from'>): { text: string; tone: 'app' | 'hand' } {
  if (!f.from) return { text: 'Added in Drive', tone: 'hand' }
  if (f.from.kind === 'link') return { text: 'From the app · a file the app linked', tone: 'app' }
  const what = (f.from.source && SOURCE_WORDS[f.from.source]) || 'a photo the app filed'
  return { text: `From the app · ${what}`, tone: 'app' }
}

/** The empty words a section draws: not made yet, or made and empty. */
export function sectionEmptyWords(s: Pick<JobFolderSection, 'name' | 'folderId'>): { main: string; tail: string } {
  if (!s.folderId) return { main: `${s.name} is not made yet.`, tail: 'The app makes it when something first lands in it.' }
  return { main: `Nothing in ${s.name} yet.`, tail: 'Drop a file in the folder and it shows here.' }
}

/** *and 7 more in Drive* under the first rows; null when every file is shown. */
export function moreWords(s: Pick<JobFolderSection, 'files' | 'more'>): string | null {
  const rest = s.files.length - SHOW_FIRST
  if (s.more) return `and ${rest > 0 ? `${rest} or ` : ''}more in Drive`
  if (rest <= 0) return null
  return `and ${rest} more in Drive`
}

/** The read failed: its reason, in the tab's words. */
export function filesReadFailedWords(reason: string): string {
  return `The folders did not read. ${reason}`
}
