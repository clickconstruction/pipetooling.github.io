/**
 * Evidence on a person's file (design spike, 2026-11-02, the owner's second call): a piece of evidence is a RECORD,
 * never a bare file — the day it is about, a title, a memo on what it shows, and its files. The files are staged in the
 * app's private `hr-files` bucket as they are picked and filed by `hr-evidence-drive` into the People folder in Drive,
 * under *<Person> › <date> · <title>*, the way a box photo or a company paper travels; the record keeps the Drive ids,
 * so the folder opens in one tap and the file is found by Drive's own search. Pure: no React, no supabase, no app
 * import — it lives in `supabase/functions/_shared/` so the panel and the dev MCP's `plan_person_evidence` /
 * `apply_person_evidence` stage a file under one path rule and one set of caps; `src/lib/people/personEvidence.ts`
 * is the app's door to it.
 */

export { NO_PEOPLE_FOLDER_WORDS } from './whereFilesGo.ts'

export type PersonEvidenceFile = {
  id: string
  evidence_id: string | null
  entry_id: string | null
  filename: string
  mime_type: string | null
  size_bytes: number | null
  storage_path: string | null
  drive_file_id: string | null
  drive_url: string | null
  filed_at: string | null
  fail_why: string | null
  created_at: string
  /** The SHA-256 of the staged bytes as picked (v2.6544), lower-case hex; null on a linked file and on older rows. */
  sha256?: string | null
}

/** The custody hash for a chip's tip: `sha256 3a7bd3e2360a…`; '' when the row has none. */
export function evidenceHashWords(sha256: string | null | undefined): string {
  const s = (sha256 ?? '').trim().toLowerCase()
  return /^[0-9a-f]{64}$/.test(s) ? `sha256 ${s.slice(0, 12)}…` : ''
}

export type PersonEvidenceRecord = {
  id: string
  person_id: string
  /** The entry it proves, when it was attached to one; null for a record of its own. */
  entry_id: string | null
  /** The day it is about, `YYYY-MM-DD`. */
  dated_on: string
  title: string
  memo: string
  created_by: string | null
  author_label: string | null
  created_at: string
  drive_folder_id: string | null
  drive_folder_url: string | null
  filed_at: string | null
  fail_why: string | null
  /** v2.6554: kept here only — never filed in Drive, never read by the agent or by the seat as deployed. */
  counsel_only?: boolean
  files: PersonEvidenceFile[]
}

export type PersonEvidenceDraft = { datedOn: string; title: string; memo: string; /** v2.6554: the counsel-only tick. */ counselOnly?: boolean }

/**
 * A linked file (v2.6541): a file that already lives in Drive and is never staged — a recording over the cap, a file
 * the office filed by hand. Its row has `drive_url` and no `storage_path`; the filer leaves it alone and the panel opens
 * the link. The name is what the chip reads.
 */
export type PersonEvidenceLink = { name: string; driveUrl: string }

/** A Drive link: a file, a folder or a doc on drive.google.com or docs.google.com. */
const DRIVE_URL = /^https:\/\/(drive|docs)\.google\.com\/\S+$/i

/** The Drive id a link names, when it names one: `/file/d/<id>`, `/folders/<id>`, `/document/d/<id>`, `?id=<id>`; null otherwise. */
export function driveFileIdFromUrl(url: string): string | null {
  const m = url.match(/\/(?:file|document|spreadsheets|presentation)\/d\/([A-Za-z0-9_-]{10,})/) ?? url.match(/\/folders\/([A-Za-z0-9_-]{10,})/) ?? url.match(/[?&]id=([A-Za-z0-9_-]{10,})/)
  return m?.[1] ?? null
}

/** Why a link cannot stand; null when it can: a name, and a Drive address. */
export function evidenceLinkProblem(l: { name: string; driveUrl: string }): string | null {
  if (!l.name.trim()) return 'Give the linked file a name.'
  if (l.name.trim().length > 200) return 'The linked file’s name is over 200 characters.'
  const url = l.driveUrl.trim()
  if (!url) return `Paste the Drive link for ${l.name.trim()}.`
  if (!DRIVE_URL.test(url)) return `${l.name.trim()}: the link is not a Drive address (drive.google.com or docs.google.com).`
  return null
}

/** A file row that was linked, never staged. */
export function evidenceFileIsLinked(f: Pick<PersonEvidenceFile, 'storage_path' | 'drive_url'>): boolean {
  return !f.storage_path && !!f.drive_url
}

/** A file goes through the function as bytes it reads from the bucket; the same cap as the company folder's door. */
export const EVIDENCE_FILE_MAX_BYTES = 10 * 1024 * 1024
export const EVIDENCE_TITLE_MAX = 160
export const EVIDENCE_MEMO_MAX = 4000
/** The folder under the people root, and the folder each record gets inside the person's. */
export const PEOPLE_FOLDER_NAME = 'People'

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Why the record cannot be saved as typed; null when it can. Every piece is required: the day, a title, a memo, a file or a link to one in Drive (v2.6541). */
export function evidenceDraftProblem(d: PersonEvidenceDraft, files: ReadonlyArray<{ name: string; size: number }>, todayYmd: string, links: ReadonlyArray<PersonEvidenceLink> = []): string | null {
  if (!DAY.test(d.datedOn)) return 'Pick the day it is about.'
  if (d.datedOn > todayYmd) return 'The day it is about cannot be ahead of today.'
  if (!d.title.trim()) return 'Give it a title.'
  if (d.title.trim().length > EVIDENCE_TITLE_MAX) return `The title is over ${EVIDENCE_TITLE_MAX} characters.`
  if (!d.memo.trim()) return 'Write a memo: what it shows and why it matters.'
  if (d.memo.length > EVIDENCE_MEMO_MAX) return `The memo is over ${EVIDENCE_MEMO_MAX} characters.`
  if (files.length === 0 && links.length === 0) return 'Add at least one file, or a link to one already in Drive: a photo, a PDF, an email, a screenshot, a recording.'
  for (const f of files) {
    if (!f.name.trim()) return 'One of the files has no name.'
    if (f.size === 0) return `${f.name} is empty.`
    if (f.size > EVIDENCE_FILE_MAX_BYTES) return `${f.name} is over ${EVIDENCE_FILE_MAX_BYTES / 1024 / 1024} MB. Put it in the person's Drive folder by hand and link it here.`
  }
  for (const l of links) {
    const why = evidenceLinkProblem(l)
    if (why) return why
  }
  return null
}

/** Drive takes most characters; the slashes and the control characters go, and the name is kept readable. */
export function driveSafeWords(s: string): string {
  return s.replace(/[\\/\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** The record's folder in Drive: `2026-10-29 · Left a mess at the site`, at most 120 characters. */
export function evidenceFolderName(r: { dated_on: string; title: string }): string {
  const title = driveSafeWords(r.title)
  return `${r.dated_on} · ${title}`.slice(0, 120).trim()
}

/** Where it will sit, in words: *People › Pat Doe › 2026-10-29 · Left a mess at the site*. */
export function evidenceDrivePathWords(personName: string, r: { dated_on: string; title: string }): string {
  const who = driveSafeWords(personName) || 'this person'
  return `${PEOPLE_FOLDER_NAME} › ${who} › ${evidenceFolderName(r)}`
}

/** `<person id>/evidence/<record id>/<uuid>-<safe name>` in the `hr-files` bucket. */
export function evidenceStoragePath(personId: string, evidenceId: string, fileId: string, originalName: string): string {
  const safe = originalName.replace(/[^A-Za-z0-9._ -]+/g, '_').replace(/\s+/g, ' ').trim().slice(-120) || 'file'
  return `${personId}/evidence/${evidenceId}/${fileId}-${safe}`
}

/** The mime the file goes in as: the browser's, else from the name; `application/octet-stream` when neither says. */
export function evidenceMime(file: { type: string; name: string }): string {
  const t = (file.type || '').toLowerCase()
  if (t) return t
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  const byExt: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    gif: 'image/gif',
    eml: 'message/rfc822',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
  }
  return byExt[ext] ?? 'application/octet-stream'
}

/** `PDF` · `Photo` · `Email` · `Text` · `Word` · `Sheet` · `Audio` · `Video` · `File` */
export function evidenceKindWords(mime: string | null): string {
  const m = (mime ?? '').toLowerCase()
  if (m === 'application/pdf') return 'PDF'
  if (m.startsWith('image/')) return 'Photo'
  if (m === 'message/rfc822') return 'Email'
  if (m.startsWith('text/')) return 'Text'
  if (m.includes('wordprocessingml') || m === 'application/msword') return 'Word'
  if (m.includes('spreadsheetml') || m === 'application/vnd.ms-excel') return 'Sheet'
  if (m.startsWith('audio/')) return 'Audio'
  if (m.startsWith('video/')) return 'Video'
  return 'File'
}

/** The title the window starts with from the first file: its name without the extension, underscores as spaces. */
export function evidenceTitleFromName(name: string): string {
  return name.replace(/\.[A-Za-z0-9]{1,5}$/, '').replace(/[_]+/g, ' ').trim()
}

/** `63 KB` · `1.2 MB`; '' when unknown. */
export function evidenceSizeWords(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export type EvidenceDriveState = 'filed' | 'partly' | 'waiting' | 'held' | 'counsel'

/** A file that is in Drive: filed by the function, or linked there by hand (v2.6541). */
const inDrive = (f: Pick<PersonEvidenceFile, 'drive_file_id' | 'storage_path' | 'drive_url'>): boolean => !!f.drive_file_id || evidenceFileIsLinked(f)

/** Where the record stands with Drive, from its files: every file filed or linked, some, none yet, or a reason it could not go. */
export function evidenceDriveState(r: Pick<PersonEvidenceRecord, 'fail_why' | 'files' | 'filed_at' | 'counsel_only'>): EvidenceDriveState {
  if (r.counsel_only) return 'counsel'
  const filed = r.files.filter(inDrive).length
  if (r.files.length > 0 && filed === r.files.length) return 'filed'
  if (r.fail_why) return 'held'
  if (filed > 0) return 'partly'
  return 'waiting'
}

/** The file's whereabouts for its chip's tip: *in Drive* · *in Drive, linked* · *kept here, on its way to Drive*. */
export function evidenceFileWhereWords(f: Pick<PersonEvidenceFile, 'drive_file_id' | 'storage_path' | 'drive_url'>): string {
  if (evidenceFileIsLinked(f)) return 'in Drive, linked'
  if (f.drive_url) return 'in Drive'
  return 'kept here, on its way to Drive'
}

/** The state in words for the record's foot: *In Drive* · *In Drive, linked* · *2 of 3 files in Drive* · *On its way to Drive* · *Not in Drive: <why>*. */
export function evidenceDriveWords(r: Pick<PersonEvidenceRecord, 'fail_why' | 'files' | 'filed_at' | 'counsel_only'>): string {
  const filed = r.files.filter(inDrive).length
  switch (evidenceDriveState(r)) {
    case 'counsel':
      return 'Kept here only, counsel-only'
    case 'filed':
      return r.files.every(evidenceFileIsLinked) ? 'In Drive, linked' : 'In Drive'
    case 'partly':
      return `${filed} of ${r.files.length} files in Drive`
    case 'held':
      return `Not in Drive: ${r.fail_why}`
    default:
      return 'On its way to Drive'
  }
}

/** Newest day first; the same day falls to the newest written. */
export function sortEvidenceNewestFirst<T extends { dated_on: string; created_at: string }>(records: ReadonlyArray<T>): T[] {
  return [...records].sort((a, b) => (a.dated_on !== b.dated_on ? (a.dated_on < b.dated_on ? 1 : -1) : a.created_at < b.created_at ? 1 : -1))
}

/** The Evidence view's count line: *3 pieces of evidence, 7 files. 1 not in Drive yet.* */
export function evidenceCountWords(records: ReadonlyArray<Pick<PersonEvidenceRecord, 'files' | 'fail_why' | 'filed_at' | 'counsel_only'>>): string {
  if (records.length === 0) return ''
  const files = records.reduce((n, r) => n + r.files.length, 0)
  const counsel = records.filter((r) => r.counsel_only).length
  const notFiled = records.filter((r) => !r.counsel_only && evidenceDriveState(r) !== 'filed').length
  const pieces = records.length === 1 ? '1 piece of evidence' : `${records.length} pieces of evidence`
  const fileWords = files === 1 ? '1 file' : `${files} files`
  const tail = notFiled === 0 ? '' : notFiled === 1 ? ' 1 not in Drive yet.' : ` ${notFiled} not in Drive yet.`
  const held = counsel === 0 ? '' : counsel === 1 ? ' 1 counsel-only.' : ` ${counsel} counsel-only.`
  return `${pieces}, ${fileWords}.${tail}${held}`
}
