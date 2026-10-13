/**
 * Messages, cut 7b (v2.5383): the drive-link function's rules, pure, so the app's tests read them as the function does.
 * Our own link to one Drive file of one job (`drive_links`, cut 7a) opens at `<app>/f/<link>`. The page asks the function,
 * which counts the open and answers how to hand the file over: Drive's own viewer for a file in the job's Plans half,
 * which is open to anyone with the folder's link already; our stream for a file in Team only, so Team only is never
 * opened up; or the turned-off words for a link cut off, ended or unknown. The office's door asks for a job's folder, puts a
 * file in it, makes a link and saves a file that came in; `parseOfficeAsk` reads what it asked.
 *
 * No imports, so the app's tests import it as the function does.
 */

/** A file's own link lives this long from the day it is made (the lead, 2026-10-12). */
export const LINK_DAYS = 30

/** Over this, a Team only file does not come through our stream, which never holds a file whole (the lead, 2026-10-12). */
export const STREAM_CAP_BYTES = 50 * 1024 * 1024

/** A link's token: 16 random bytes as base64url, 22 characters, short enough for a text. */
export const LINK_TOKEN_BYTES = 16

/** What a link's row says, as the open door reads it. */
export interface LinkRow {
  id: string
  half: 'plans' | 'team_only'
  drive_file_id: string
  name: string
  mime: string | null
  size_bytes: number | null
  ends_at: string
  cut_at: string | null
}

/** Why a link opens nothing. A link ended reads the same as one cut off. */
export type OffWhy = 'cut' | 'ended' | 'unknown' | 'tooBig'

/** How the open door hands the file over. */
export type OpenAnswer = { kind: 'drive'; url: string; name: string } | { kind: 'stream'; name: string } | { kind: 'off'; why: OffWhy }

/** A Drive folder's type. A plan set is often a folder in Plans. */
export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'

/** Drive's own viewer for a file, or a folder's own page. */
export function driveViewUrl(fileId: string, mime: string | null = null): string {
  if (mime === DRIVE_FOLDER_MIME) return `https://drive.google.com/drive/folders/${encodeURIComponent(fileId)}`
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`
}

/** The open door's answer for a link's row, or none. */
export function openAnswer(row: LinkRow | null, now: Date): OpenAnswer {
  if (!row) return { kind: 'off', why: 'unknown' }
  if (row.cut_at) return { kind: 'off', why: 'cut' }
  if (new Date(row.ends_at).getTime() <= now.getTime()) return { kind: 'off', why: 'ended' }
  if (row.half === 'plans') return { kind: 'drive', url: driveViewUrl(row.drive_file_id, row.mime), name: row.name }
  // A folder has no bytes to stream. The office door links one from Plans alone.
  if (row.mime === DRIVE_FOLDER_MIME) return { kind: 'off', why: 'unknown' }
  if (row.size_bytes != null && row.size_bytes > STREAM_CAP_BYTES) return { kind: 'off', why: 'tooBig' }
  return { kind: 'stream', name: row.name }
}

/** A token as the link carries it: base64url, long enough to be unguessable, short enough for a text. */
export function linkTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{16,64}$/.test(token)
}

/** A new link's token from random bytes. */
export function linkToken(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The link a person gets: the app's own page, never Drive's. */
export function fileLinkUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/f/${token}`
}

/**
 * Where a Team only file's bytes stream from: the function's public address. Never the request's own, which inside the
 * edge runtime is the gateway's, with `/functions/v1` stripped (job-share met it).
 */
export function streamUrl(supabaseUrl: string, token: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/drive-link?t=${encodeURIComponent(token)}&raw=1`
}

/** The link's token from a pasted link or the page's path, or null. */
export function tokenFromLink(link: string): string | null {
  const m = /\/f\/([A-Za-z0-9_-]{16,64})(?:[?#/].*)?$/.exec(link.trim())
  return m ? m[1]! : null
}

/**
 * Whether the stream may show a file in the browser. A page, a drawing that can carry a script, or a script is saved
 * instead: a file that came by email from outside must never run on the function's address.
 */
export function streamsInline(mime: string | null): boolean {
  return !/^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml|application\/xml|text\/javascript|application\/javascript)\b/i.test((mime ?? '').trim())
}

/** How the stream names the file: shown in the browser, saved under its own name. A page or a script is only saved. */
export function contentDisposition(name: string, mime: string | null = null): string {
  const plain = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `${streamsInline(mime) ? 'inline' : 'attachment'}; filename="${plain}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

/** A job, as the spine ties a line: a bid, a GC project or a Pipeline job. */
export type JobRef = { bid_id: string } | { project_id: string } | { jobs_ledger_id: string }

/** What the office's door was asked. */
export type OfficeAsk =
  | { action: 'list'; job: JobRef }
  | { action: 'put'; job: JobRef; name: string; mime: string; where: 'sent' | 'photos' }
  | { action: 'link'; job: JobRef; driveFileId: string; messageId: string | null }
  | { action: 'save'; attachmentId: string; half: 'plans' | 'team_only' }
  | { action: 'open'; job: JobRef; driveFileId: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DRIVE_ID = /^[A-Za-z0-9_-]{10,200}$/

function jobOf(v: unknown): JobRef | null {
  const o = (v ?? {}) as Record<string, unknown>
  const set = (['bid_id', 'project_id', 'jobs_ledger_id'] as const).filter((k) => typeof o[k] === 'string' && UUID.test(o[k] as string))
  if (set.length !== 1) return null
  const k = set[0]!
  return { [k]: o[k] as string } as JobRef
}

/** The office's ask, or null when it is not one the door takes. */
export function parseOfficeAsk(body: unknown): OfficeAsk | null {
  const b = (body ?? {}) as Record<string, unknown>
  const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() !== '' && v.trim().length <= max ? v.trim() : null)
  switch (b.action) {
    case 'list': {
      const job = jobOf(b.job)
      return job ? { action: 'list', job } : null
    }
    case 'put': {
      const job = jobOf(b.job)
      const name = str(b.name, 300)
      const mime = typeof b.mime === 'string' && b.mime.length <= 200 ? b.mime : 'application/octet-stream'
      const where = b.where === 'photos' ? 'photos' : b.where === 'sent' ? 'sent' : null
      return job && name && where ? { action: 'put', job, name, mime, where } : null
    }
    case 'link': {
      const job = jobOf(b.job)
      const driveFileId = typeof b.driveFileId === 'string' && DRIVE_ID.test(b.driveFileId) ? b.driveFileId : null
      const messageId = b.messageId == null ? null : typeof b.messageId === 'string' && UUID.test(b.messageId) ? b.messageId : undefined
      return job && driveFileId && messageId !== undefined ? { action: 'link', job, driveFileId, messageId } : null
    }
    case 'save': {
      const attachmentId = typeof b.attachmentId === 'string' && UUID.test(b.attachmentId) ? b.attachmentId : null
      const half = b.half === 'plans' ? 'plans' : b.half === 'team_only' ? 'team_only' : null
      return attachmentId && half ? { action: 'save', attachmentId, half } : null
    }
    case 'open': {
      const job = jobOf(b.job)
      const driveFileId = typeof b.driveFileId === 'string' && DRIVE_ID.test(b.driveFileId) ? b.driveFileId : null
      return job && driveFileId ? { action: 'open', job, driveFileId } : null
    }
    default:
      return null
  }
}

/** Where a file goes in the job's folder: from this computer into Team only, Sent by us; a photo into Team only, Photos; a file that came in, saved, into Team only, From email, or the top of Plans. */
export function landingPath(kind: 'sent' | 'photos' | 'saved', half: 'plans' | 'team_only' = 'team_only'): readonly string[] {
  if (kind === 'sent') return ['Team only', 'Sent by us']
  if (kind === 'photos') return ['Team only', 'Photos']
  return half === 'plans' ? ['Plans'] : ['Team only', 'From email']
}

/** Save to Drive's pick for a file that came in: Team only for a quote or a photo, Plans for anything else (the lead, 2026-10-12). */
export function saveHalfFor(f: { kind: string; mime: string | null; name: string; isQuote: boolean }): 'plans' | 'team_only' {
  const image = (f.mime ?? '').startsWith('image/') || /\.(jpe?g|png|heic|heif|gif)$/i.test(f.name)
  return f.isQuote || image ? 'team_only' : 'plans'
}
