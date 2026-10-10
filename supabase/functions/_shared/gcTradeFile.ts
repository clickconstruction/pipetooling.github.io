/**
 * GC mode, the trade partner portal's P5a-1 (to-dos/gc-mode/mockups/portal-p5a.md): the kind `file`, a trade's file
 * into the job's Drive folder. `submit-gc-trade-portal` reads the request with these rules, finds the folder, uploads
 * the bytes and keeps the link in `gc_trade_files`; the page then sends the kind that stores the link (decision 9).
 * Pure, with no Deno or browser API, so `src/lib/gc/gcTradeFile.test.ts` holds them:
 *   - the shape: what the file is for, the record it is for, its name, and its bytes as base64;
 *   - the type, read from the file's first bytes, never its name: a PDF, a JPEG, a PNG, or a phone's HEIC or HEIF;
 *   - the size, 10 MB at most once decoded (decision 9);
 *   - the folder each file goes to and its name in Drive, which never meets another file's.
 */
import { APP_CALENDAR_TZ } from './appTimeZone.ts'

/** The most a file may weigh, once decoded (PORTAL_REAL_BUILD.md decision 9). */
export const TRADE_FILE_MAX_BYTES = 10 * 1024 * 1024

/** Files a company may put in Drive in an hour, apart from the free-text writes (portal-p5a.md decision 5). */
export const TRADE_FILE_HOURLY_CAP = 20

export const TRADE_FILE_FOR = ['submittal', 'change', 'quote'] as const
export type TradeFileFor = (typeof TRADE_FILE_FOR)[number]

export type TradeFileMime = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/heic' | 'image/heif'

/** A file as the function uploads it. `recordId` is the submittal, the trade a change is asked on, or the ask a quote answers. */
export interface TradeFileUpload {
  for: TradeFileFor
  recordId: string
  name: string
  bytes: Uint8Array
  mime: TradeFileMime
}

/** The field each kind of file names its record by. */
const RECORD_FIELD: Record<TradeFileFor, string> = { submittal: 'submittalId', change: 'packageId', quote: 'inviteId' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The brands an ISO media file names after `ftyp` for a phone's photo. */
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis']
const HEIF_BRANDS = ['mif1', 'msf1', 'heif']

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  return bytes.length >= magic.length && magic.every((m, i) => bytes[i] === m)
}

function ascii(bytes: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...bytes.slice(from, to))
}

/** The file's type by its first bytes, or null when it is none the portal takes. */
export function fileMimeOf(bytes: Uint8Array): TradeFileMime | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return 'application/pdf'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12)
    if (HEIC_BRANDS.includes(brand)) return 'image/heic'
    if (HEIF_BRANDS.includes(brand)) return 'image/heif'
  }
  return null
}

/** A file's name as Drive keeps it: no path or control characters, trimmed, 200 characters at most. Empty: none. */
export function cleanFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
    .trim()
}

function bytesOf(base64: string): Uint8Array | null {
  const raw = base64.trim()
  const b64 = raw.startsWith('data:') ? raw.slice(raw.indexOf(',') + 1) : raw
  if (b64 === '') return null
  try {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/**
 * A `file` request read: what it is for, its record, its name and its bytes with their type. `fileTooBig` and
 * `fileType` are the company's refusals; null is a shape the portal never sends.
 */
export function parseTradeFile(b: Record<string, unknown>): TradeFileUpload | 'fileTooBig' | 'fileType' | null {
  const forWhat = b.for
  if (typeof forWhat !== 'string' || !(TRADE_FILE_FOR as readonly string[]).includes(forWhat)) return null
  const f = forWhat as TradeFileFor
  const recordId = b[RECORD_FIELD[f]]
  if (typeof recordId !== 'string' || !UUID.test(recordId)) return null
  if (typeof b.name !== 'string' || b.name.length > 400) return null
  const name = cleanFileName(b.name)
  if (name === '') return null
  // The base64 of a file at the cap is a third larger; anything longer is over the cap before it is decoded.
  if (typeof b.base64 !== 'string' || b.base64.length > Math.ceil((TRADE_FILE_MAX_BYTES * 4) / 3) + 200) return typeof b.base64 === 'string' ? 'fileTooBig' : null
  const bytes = bytesOf(b.base64)
  if (!bytes || bytes.length === 0) return null
  if (bytes.length > TRADE_FILE_MAX_BYTES) return 'fileTooBig'
  const mime = fileMimeOf(bytes)
  if (!mime) return 'fileType'
  return { for: f, recordId, name, bytes, mime }
}

/** Where a file goes under the job's folder: a submittal's to Submittals (Building's decision 6), any other to Team only → From trades → the company (decision 9). */
export function tradeFileFolders(f: TradeFileFor, company: string): string[] {
  return f === 'submittal' ? ['Submittals'] : ['Team only', 'From trades', cleanFileName(company) || 'A trade partner']
}

/** The minute in the app's time zone, as a Drive name starts: `2026-10-10 1342`. */
export function driveMinute(at: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}${parts.minute}`
}

/**
 * A file's name in Drive, which never meets another's: a submittal's carries its number and round
 * (`26 24 16-01 round 2 - panelboards.pdf`), any other the minute it came (`2026-10-10 1342 - chairs.jpg`).
 */
export function tradeFileDriveName(f: TradeFileFor, name: string, at: Date, submittal?: { number: string; round: number }): string {
  return f === 'submittal' && submittal ? `${cleanFileName(submittal.number)} round ${submittal.round} - ${name}` : `${driveMinute(at)} - ${name}`
}

/** The link the office opens a file by. */
export function driveFileUrl(id: string): string {
  return `https://drive.google.com/file/d/${id}/view`
}
