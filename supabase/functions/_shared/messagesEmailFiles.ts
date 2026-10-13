/**
 * Messages, cut 7e: the files on an email from the reply box, as `messages-email` takes them (`BUILD_PLAN.md` → *Cut 7*,
 * the mock-up `files-out-mockups.html` on spike/gc-mode, screens 4 and 6). The app decides how each file goes with
 * `src/lib/documents/outgoing.ts` (`waysOut`, `linkFor`); the function holds every send to the same limits, whatever
 * the app sent, reads each file from where it lives, and writes how it went on the line.
 *
 * Where a file comes from, and its `ref`:
 * - `drive`: a file or a plan set's folder in the job's Drive folder, by its Drive id.
 * - `arrived`: a file that came in on a message, our copy in `message-attachments`, by its `message_attachments` id.
 * - `sent`: a file on a copy of what we sent, by its `sent_documents` id, with its `path` in `sent-documents`.
 * - `paper`: a paper the app makes, `<paper>:<id>`. Only our contract is stored, so only it goes as the file; the others
 *   go as their portal page (the lead, 2026-10-13), and their PDF writers come later.
 * - `device`: a file from this computer or a photo, as base64. It goes into the job's Team only first (Sent by us, or
 *   Photos), so nothing goes out that Documents does not hold.
 *
 * No imports, so the app's tests import it as the function does. The limits and the portal's lines are the app's own
 * (`outgoing.ts`, `jobFiles.ts`), copied here and held equal by `messagesEmailFiles.test.ts`.
 */

/** One file on an email, up to the trade portal's upload cap. */
export const EMAIL_FILE_LIMIT_BYTES = 10 * 1024 * 1024

/** The files on one email together, the sent copy's cap. */
export const EMAIL_MESSAGE_LIMIT_BYTES = 20 * 1024 * 1024

/** How many files one email takes. */
export const EMAIL_FILES_MAX = 20

export type EmailFileSource = 'drive' | 'arrived' | 'sent' | 'paper' | 'device'

/** How a file goes: the file itself, our link (or their portal's), or a photo on the email. */
export type EmailFileWay = 'file' | 'link' | 'picture'

export type EmailPaper = 'contract' | 'payapp' | 'co' | 'sow' | 'schedule'

export type PortalPageKey = 'plans' | 'sow' | 'schedule' | 'contract' | 'bills' | 'changes' | 'papers'

/** Each portal page's line on an email or a text, and whose portal has it (`jobFiles.ts`'s `PORTAL_PAGES`). */
export const PORTAL_PAGE_LINES: Readonly<Record<PortalPageKey, { line: string; audiences: readonly ('trade' | 'customer')[] }>> = {
  plans: { line: 'The plans are in your portal', audiences: ['trade'] },
  sow: { line: 'The statement of work is in your portal', audiences: ['trade'] },
  schedule: { line: 'The schedule is in your portal', audiences: ['trade', 'customer'] },
  contract: { line: 'Our contract is in your portal', audiences: ['customer'] },
  bills: { line: 'Your bills are in your portal', audiences: ['trade', 'customer'] },
  changes: { line: 'The change orders are in your portal', audiences: ['trade', 'customer'] },
  papers: { line: 'Your papers are in your portal', audiences: ['trade', 'customer'] },
}

/** The page each paper the app makes lives on (`jobFiles.ts`'s `PAPER_PAGE`). */
export const PAPER_PAGE: Readonly<Record<EmailPaper, PortalPageKey>> = { sow: 'sow', contract: 'contract', payapp: 'bills', co: 'changes', schedule: 'schedule' }

/** A file the app asked to send. */
export interface EmailFileAsk {
  /** The app's key for it (`DraftFile.key`), so the answer names it. */
  key: string
  source: EmailFileSource
  ref: string
  /** A sent copy's file: its path in `sent-documents`. */
  path: string | null
  name: string
  mime: string
  way: EmailFileWay
  /** The page of their portal a link opens at, when the app's `linkFor` chose their portal. */
  page: PortalPageKey | null
  /** A device file: its bytes and where in the job's Team only it lands. */
  base64: string | null
  landing: 'sent' | 'photos' | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DRIVE_ID = /^[A-Za-z0-9_-]{10,200}$/
const SOURCES: ReadonlySet<string> = new Set<EmailFileSource>(['drive', 'arrived', 'sent', 'paper', 'device'])
const WAYS: ReadonlySet<string> = new Set<EmailFileWay>(['file', 'link', 'picture'])
const PAPERS: ReadonlySet<string> = new Set<EmailPaper>(['contract', 'payapp', 'co', 'sow', 'schedule'])
const PAGES: ReadonlySet<string> = new Set(Object.keys(PORTAL_PAGE_LINES))

/** A paper's ref read back: `contract:<uuid>`, or null. */
export function paperRef(ref: string): { paper: EmailPaper; id: string } | null {
  const at = ref.indexOf(':')
  const paper = ref.slice(0, at)
  const id = ref.slice(at + 1)
  return at > 0 && PAPERS.has(paper) && (UUID.test(id) || (paper === 'schedule' && id === 'schedule')) ? { paper: paper as EmailPaper, id } : null
}

/** A sent copy's file path: inside the bucket, never climbing out of it. */
const pathShape = (p: unknown): p is string => typeof p === 'string' && p.length > 0 && p.length <= 500 && !p.startsWith('/') && !p.split('/').includes('..')

function refFits(source: EmailFileSource, ref: string): boolean {
  if (source === 'drive') return DRIVE_ID.test(ref)
  if (source === 'arrived' || source === 'sent') return UUID.test(ref)
  if (source === 'paper') return paperRef(ref) !== null
  return ref === ''
}

/**
 * The files the app asked to send, or null when the list is not one the function takes. No list is no files. A file
 * whose source, way, ref, page or bytes do not fit makes the whole list null, so a send never goes with part of it.
 */
export function parseEmailFiles(raw: unknown): EmailFileAsk[] | null {
  if (raw == null) return []
  if (!Array.isArray(raw) || raw.length > EMAIL_FILES_MAX) return null
  const out: EmailFileAsk[] = []
  const keys = new Set<string>()
  for (const item of raw) {
    const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const key = typeof o.key === 'string' ? o.key.trim() : ''
    const source = typeof o.source === 'string' && SOURCES.has(o.source) ? (o.source as EmailFileSource) : null
    const ref = typeof o.ref === 'string' ? o.ref.trim() : source === 'device' ? '' : null
    const name = typeof o.name === 'string' ? o.name.trim() : ''
    const mime = typeof o.mime === 'string' && o.mime.length <= 200 ? o.mime.trim() : ''
    const way = typeof o.way === 'string' && WAYS.has(o.way) ? (o.way as EmailFileWay) : null
    const page = o.page == null ? null : typeof o.page === 'string' && PAGES.has(o.page) ? (o.page as PortalPageKey) : undefined
    if (!key || key.length > 300 || keys.has(key) || !source || ref === null || !refFits(source, ref) || !name || name.length > 300 || !way || page === undefined) return null
    // A page is where a link opens, so only a link names one.
    if (page && way !== 'link') return null
    let path: string | null = null
    if (source === 'sent') {
      if (!pathShape(o.path)) return null
      path = o.path
    }
    let base64: string | null = null
    let landing: 'sent' | 'photos' | null = null
    if (source === 'device') {
      if (typeof o.base64 !== 'string' || o.base64.length === 0 || o.base64.length > Math.ceil((EMAIL_FILE_LIMIT_BYTES * 4) / 3) + 200) return null
      base64 = o.base64
      landing = o.landing === 'photos' ? 'photos' : 'sent'
    }
    // A paper the app draws on demand has no file yet: it goes as its page.
    const paper = source === 'paper' ? paperRef(ref) : null
    if (paper && paper.paper !== 'contract' && way !== 'link') return null
    keys.add(key)
    out.push({ key, source, ref, path, name, mime, way, page, base64, landing })
  }
  return out
}

/** Why a file the app asked to carry cannot go as the file. */
export type CarryRefusal = 'unknownSize' | 'overFile' | 'overMessage'

/**
 * Whether the files the email carries fit, once their sizes are read: each up to 10 MB, together up to 20 MB, and none
 * of unknown size. The app's `waysOut` already makes a link of any that would not; this holds the function to it.
 */
export function carryRefusal(carried: readonly { name: string; bytes: number | null }[]): { why: CarryRefusal; name: string | null } | null {
  let total = 0
  for (const f of carried) {
    if (f.bytes == null) return { why: 'unknownSize', name: f.name }
    if (f.bytes > EMAIL_FILE_LIMIT_BYTES) return { why: 'overFile', name: f.name }
    total += f.bytes
  }
  return total > EMAIL_MESSAGE_LIMIT_BYTES ? { why: 'overMessage', name: null } : null
}

/** The refusal in words, as the send window shows it. */
export function carryWords(r: { why: CarryRefusal; name: string | null }): string {
  if (r.why === 'unknownSize') return `We do not know how big ${r.name} is, so it can only go as our link.`
  if (r.why === 'overFile') return `${r.name} is over the email limit of 10 MB, so it can only go as our link.`
  return 'The files together are over the email limit of 20 MB. Send the largest as our link.'
}

/** A link a send made, for the lines under the words. */
export interface SentLink {
  name: string
  url: string
  /** Their portal's page, or null for a file's own link. */
  page: PortalPageKey | null
}

/** The lines under the words for the files that went as links: one a portal page, however many files share it, and one a file's own link. */
export function emailLinkLines(links: readonly SentLink[]): string[] {
  const out: string[] = []
  const pages = new Set<PortalPageKey>()
  for (const l of links) {
    if (l.page) {
      if (pages.has(l.page)) continue
      pages.add(l.page)
      out.push(`${PORTAL_PAGE_LINES[l.page].line}: ${l.url}`)
    } else out.push(`${l.name}: ${l.url}`)
  }
  return out
}

/** Where a file sent as the file is kept with the line, in `message-attachments`: under `out/`, by the line and its place. */
export function outCopyPath(messageId: string, index: number, name: string): string {
  const safe = name.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'file'
  return `out/${messageId}/${index + 1}-${safe}`
}
