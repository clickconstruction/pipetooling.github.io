/**
 * A named document from a Drive file (v2.6712, punch list #286): `plan_person_doc` / `apply_person_doc` take
 * `drive_file_id` (or `drive_url`) in place of `markdown`, and the server reads the file's bytes itself through the
 * service account — as `drive-link` reads a file for the index — so a long document never rides through the agent.
 * The text goes to `dev_person_doc_write` as the document's `markdown` with `source_drive_file_id` and `source_sha256`,
 * so the row remembers the file and which bytes it was; the plan hash commits to the text, so a file changed in Drive
 * between plan and apply refuses the apply. Text files only — `.md`, `.txt` and a Google Doc exported as plain text —
 * under the document limit; a PDF or an image is refused with the door that takes it. The pure half: the source named
 * on the doc, the kind check, the decode, the facts the plan names, the rewritten arguments, the words. `readDriveDoc`
 * does the two Drive reads with the `fetch` it is handed, so a test stands in for Drive.
 */
import { DRIVE, driveFileIdFromUrl } from './driveUpload.ts'

/** The most bytes a Drive file may hold to become a document: the document limit is a million characters, four bytes each at the widest. */
export const DRIVE_DOC_MAX_BYTES = 4 * 1024 * 1024
/** The document limit, dev_person_doc_write's own (20261107013000). */
export const DRIVE_DOC_MAX_CHARS = 1_000_000
/** The one Google kind read as text: a Doc, exported as plain text. A Sheet or Slides is not a document. */
export const DRIVE_DOC_EXPORT_KIND = 'application/vnd.google-apps.document'
const DRIVE_FOLDER_KIND = 'application/vnd.google-apps.folder'
const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{10,}$/
const TEXT_MIMES = new Set(['text/plain', 'text/markdown', 'text/x-markdown'])
const TEXT_NAMES = /\.(md|markdown|txt)$/i

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

/** The Drive file's metadata as `readDriveDoc` asks for it. */
export interface DriveDocMeta {
  id: string
  name: string
  mimeType: string
  size?: string | null
  modifiedTime?: string | null
  webViewLink?: string | null
  trashed?: boolean | null
}

/** What the plan names about the file: where it came from, its size, its sha256, the first heading. */
export interface DriveDocFacts {
  drive_file_id: string
  name: string
  mime: string
  /** The bytes as read (a Google Doc's: the export's). */
  size_bytes: number
  sha256: string
  chars: number
  lines: number
  first_heading: string | null
  modified_time: string | null
  url: string
}

/**
 * The Drive source a `plan_person_doc` doc names, or null when it names none. `drive_file_id` or `drive_url` (either;
 * both when they agree), never beside `markdown` or `ops`, and never for the summary or the narrative, which are written
 * from the entries.
 */
export function driveDocSource(doc: Record<string, unknown> | null): { ok: true; fileId: string } | { ok: false; error: string } | null {
  if (!doc) return null
  const rawId = typeof doc.drive_file_id === 'string' ? doc.drive_file_id.trim() : ''
  const rawUrl = typeof doc.drive_url === 'string' ? doc.drive_url.trim() : ''
  if (!rawId && !rawUrl) return null
  const fromUrl = rawUrl ? (driveFileIdFromUrl(rawUrl) ?? googleDocIdFromUrl(rawUrl)) : null
  if (rawUrl && !fromUrl) return { ok: false, error: `drive_url does not carry a Drive file id (${rawUrl.slice(0, 80)}); use the file's Open link or its drive_file_id.` }
  if (rawId && !DRIVE_FILE_ID.test(rawId)) return { ok: false, error: `drive_file_id "${rawId.slice(0, 80)}" is not a Drive file id.` }
  if (rawId && fromUrl && rawId !== fromUrl) return { ok: false, error: `drive_file_id (${rawId}) and drive_url (${fromUrl}) name two files; send one.` }
  if (typeof doc.markdown === 'string' || Array.isArray(doc.ops)) return { ok: false, error: 'A Drive file is the whole text: send drive_file_id (or drive_url) alone, without markdown or ops.' }
  const kind = typeof doc.kind === 'string' ? doc.kind.trim() : ''
  if (kind) return { ok: false, error: `A Drive file becomes a named document (doc_id or title), not the ${kind}: the summary and the narrative are written from the entries.` }
  return { ok: true, fileId: rawId || fromUrl! }
}

/** docs.google.com/document/d/<id> → the Doc's id (a Google Doc's own link, which driveFileIdFromUrl does not read); null otherwise. */
export function googleDocIdFromUrl(url: string): string | null {
  const m = /docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([\w-]{20,})/.exec(url)
  return m?.[1] ?? null
}

/** What the file is to this door: read as its bytes, read as a Google Doc's plain-text export, or refused with its reason. */
export function driveDocKind(meta: Pick<DriveDocMeta, 'name' | 'mimeType' | 'trashed'>): { kind: 'plain' } | { kind: 'export' } | { kind: 'refused'; error: string } {
  if (meta.trashed) return { kind: 'refused', error: `${meta.name} is in Drive's trash; restore it first.` }
  if (meta.mimeType === DRIVE_FOLDER_KIND) return { kind: 'refused', error: `${meta.name} is a folder, not a file.` }
  if (meta.mimeType === DRIVE_DOC_EXPORT_KIND) return { kind: 'export' }
  if (TEXT_MIMES.has(meta.mimeType) || TEXT_NAMES.test(meta.name)) return { kind: 'plain' }
  return { kind: 'refused', error: notTextWords(meta) }
}

/** The refusal for a PDF, an image, a Sheet or anything else that is not text: the door that takes it instead. */
export function notTextWords(meta: Pick<DriveDocMeta, 'name' | 'mimeType'>): string {
  const what = meta.mimeType === 'application/pdf' ? 'a PDF' : meta.mimeType.startsWith('image/') ? 'an image' : meta.mimeType.startsWith('application/vnd.google-apps.') ? `a Google ${meta.mimeType.split('.').pop()}` : `${meta.mimeType || 'a kind'} with no text to copy`
  return `${meta.name} is ${what}, and a named document takes text alone (.md, .txt or a Google Doc). Link the file on an evidence record instead — plan_person_evidence with files: [{ drive_url }] — where punch list #285 searches its text as a file.`
}

/** The bytes as a document's text: UTF-8, the BOM dropped, Windows line ends folded, with words, under the limit. */
export function driveDocText(bytes: Uint8Array, name: string): { ok: true; text: string } | { ok: false; error: string } {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return { ok: false, error: `${name} is not UTF-8 text; a named document takes text alone.` }
  }
  text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  if (text.trim() === '') return { ok: false, error: `${name} has no words.` }
  if (text.length > DRIVE_DOC_MAX_CHARS) return { ok: false, error: `${name} is ${text.length.toLocaleString('en-US')} characters; a document takes at most ${DRIVE_DOC_MAX_CHARS.toLocaleString('en-US')}. Split it into two documents.` }
  return { ok: true, text }
}

/** The words when the file is bigger than the door reads. */
export function tooBigWords(name: string, bytes: number): string {
  return `${name} is ${(bytes / 1024 / 1024).toFixed(1)} MB; a document is read from at most ${DRIVE_DOC_MAX_BYTES / 1024 / 1024} MB of text. Split it into two documents.`
}

/** The first markdown heading's text, or null when the text has none. */
export function firstHeading(text: string): string | null {
  for (const line of text.split('\n')) {
    const m = /^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)
    if (m && m[1] !== undefined) return m[1].trim()
  }
  return null
}

export function driveDocFacts(meta: DriveDocMeta, read: { mime: string; bytes: number; sha256: string }, text: string): DriveDocFacts {
  return {
    drive_file_id: meta.id,
    name: meta.name,
    mime: read.mime,
    size_bytes: read.bytes,
    sha256: read.sha256,
    chars: text.length,
    lines: text === '' ? 0 : text.split('\n').length,
    first_heading: firstHeading(text),
    modified_time: meta.modifiedTime ?? null,
    url: meta.webViewLink ?? `https://drive.google.com/file/d/${meta.id}/view`,
  }
}

/**
 * The call's arguments as the grammar takes them: the Drive keys out, the text in as `markdown`, the source on. A doc
 * that names no target takes the file's name without its extension as the new document's title.
 */
export function driveDocArgs(args: Record<string, unknown>, facts: DriveDocFacts, text: string): Record<string, unknown> {
  const doc = obj(args.doc) ?? {}
  const { drive_file_id: _id, drive_url: _url, ...rest } = doc
  const hasTarget = (typeof rest.doc_id === 'string' && rest.doc_id.trim() !== '') || (typeof rest.title === 'string' && rest.title.trim() !== '')
  return {
    ...args,
    doc: {
      ...rest,
      ...(hasTarget ? {} : { title: titleFromFileName(facts.name) }),
      markdown: text,
      source_drive_file_id: facts.drive_file_id,
      source_sha256: facts.sha256,
    },
  }
}

/** A document's title from a file's name: the extension off, under the title limit. */
export function titleFromFileName(name: string): string {
  const base = name.replace(/\.(md|markdown|txt)$/i, '').trim()
  return (base || name).slice(0, 160)
}

const kbWords = (n: number): string => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

/** What the plan reply adds for a Drive source: the facts and one line on what lands. */
export function driveDocPlanExtra(facts: DriveDocFacts): { source: DriveDocFacts; reads: string } {
  const heading = facts.first_heading ? `, first heading "${facts.first_heading}"` : ', no heading'
  return {
    source: facts,
    reads: `${facts.name} (${facts.mime}, ${kbWords(facts.size_bytes)}, ${facts.chars.toLocaleString('en-US')} characters${heading}, sha256 ${facts.sha256.slice(0, 12)}…) becomes the document's text; the row remembers the file and these bytes. apply reads the file again and writes only when it is the same bytes.`,
  }
}

/** The words when apply's dry run no longer matches the plan and the doc came from Drive: the bytes as they read now. */
export function driveDocChangedWords(facts: DriveDocFacts, mismatch: string): string {
  return `${mismatch} The file read now: ${facts.name}, ${kbWords(facts.size_bytes)}, ${facts.chars.toLocaleString('en-US')} characters, sha256 ${facts.sha256} (modified ${facts.modified_time ?? 'at an unknown time'}) — when the plan read other bytes, the file changed in Drive since.`
}

/** Drive's refusal of the read, in words with the one fix. */
export function driveDocReadRefusal(status: number, fileId: string, serviceAccount: string | null, reason: string): string {
  const account = serviceAccount ? `the intake service account (${serviceAccount})` : 'the intake service account (the client_email in GOOGLE_SERVICE_ACCOUNT_JSON)'
  if (status === 404) return `Drive has no file ${fileId} that ${account} can see. Check the id, or share the file (or its folder) with it as a viewer.`
  if (status === 403) return `Drive refused the read of ${fileId}: ${reason.replace(/[.\s]+$/, '') || 'forbidden'}. Share the file (or its folder) with ${account} as a viewer.`
  return `Drive could not read ${fileId} (${status}): ${reason || 'no reason given'}. Try again in a minute.`
}

export type DriveDocRead = { ok: true; facts: DriveDocFacts; text: string } | { ok: false; error: string }

/** The service account's address, for the words; null when the key cannot be read. */
export function serviceAccountEmail(saJson: string): string | null {
  try {
    const email = (JSON.parse(saJson) as { client_email?: unknown }).client_email
    return typeof email === 'string' ? email : null
  } catch {
    return null
  }
}

/**
 * The file read through Drive: its metadata first (the kind check and the size cap read it), then the bytes — `alt=media`
 * for a text file, the plain-text export for a Google Doc — digested, decoded and checked. `fetchFn` is the fetch to use.
 */
export async function readDriveDoc(token: string, fileId: string, serviceAccount: string | null, fetchFn: typeof fetch = fetch): Promise<DriveDocRead> {
  const headers = { Authorization: `Bearer ${token}` }
  const metaRes = await fetchFn(`${DRIVE}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,modifiedTime,webViewLink,trashed&supportsAllDrives=true`, { headers })
  if (!metaRes.ok) return { ok: false, error: driveDocReadRefusal(metaRes.status, fileId, serviceAccount, await reasonOf(metaRes)) }
  const meta = (await metaRes.json()) as DriveDocMeta
  const kind = driveDocKind(meta)
  if (kind.kind === 'refused') return { ok: false, error: kind.error }
  const declared = meta.size == null || meta.size === '' ? null : Number(meta.size)
  if (kind.kind === 'plain' && declared != null && declared > DRIVE_DOC_MAX_BYTES) return { ok: false, error: tooBigWords(meta.name, declared) }
  const url = kind.kind === 'export'
    ? `${DRIVE}/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain`
    : `${DRIVE}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`
  const res = await fetchFn(url, { headers })
  if (!res.ok) {
    const reason = await reasonOf(res)
    if (kind.kind === 'export' && res.status === 403 && /exportSizeLimitExceeded/.test(reason)) return { ok: false, error: `${meta.name} is too big for Drive to export as text. Download it as .md or .txt into the folder and name that file instead.` }
    return { ok: false, error: driveDocReadRefusal(res.status, fileId, serviceAccount, reason) }
  }
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length > DRIVE_DOC_MAX_BYTES) return { ok: false, error: tooBigWords(meta.name, bytes.length) }
  const decoded = driveDocText(bytes, meta.name)
  if (!decoded.ok) return decoded
  const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
  const mime = kind.kind === 'export' ? 'text/plain' : TEXT_MIMES.has(meta.mimeType) ? meta.mimeType : /\.(md|markdown)$/i.test(meta.name) ? 'text/markdown' : 'text/plain'
  return { ok: true, facts: driveDocFacts(meta, { mime, bytes: bytes.length, sha256 }, decoded.text), text: decoded.text }
}

async function reasonOf(res: Response): Promise<string> {
  try {
    const text = await res.text()
    try {
      const parsed = JSON.parse(text) as { error?: { message?: unknown; errors?: Array<{ reason?: unknown }> } }
      if (parsed?.error && typeof parsed.error.message === 'string') {
        // Drive's reason codes ride along (exportSizeLimitExceeded, notFound, …), since the message alone does not name them.
        const codes = (parsed.error.errors ?? []).map((e) => e?.reason).filter((r): r is string => typeof r === 'string')
        return `${parsed.error.message.replace(/[.\s]+$/, '')}${codes.length ? ` [${codes.join(', ')}]` : ''}`.slice(0, 300)
      }
    } catch { /* plain text */ }
    return text.slice(0, 300)
  } catch {
    return ''
  }
}
