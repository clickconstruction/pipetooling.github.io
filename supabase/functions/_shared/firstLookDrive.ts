/**
 * First look in Google Drive (punch list #319 PR 2): the pure rules for where a look's files are kept and how a video
 * gets there. The owner's ask of 2026-11-11: the files live in Drive, in a **Customer supplied photos** folder under
 * the customer, with a folder a look inside it named by its day and place. No imports, so the photo sweep and the
 * app's tests read one copy (`src/lib/firstLook/drive.ts` re-exports it).
 *
 * A photo goes to Drive in one request, as every photo does. A video goes in pieces of 8 MiB read from the app's own
 * storage one range at a time, so a function never holds more than one piece, and where it stopped is kept on the row
 * so a copy that is cut off picks up on the next run.
 */

/** The folder's name, the owner's words. It holds video too. */
export const CUSTOMER_SUPPLIED_FOLDER = 'Customer supplied photos'

/** A name Drive takes: no slash, no control character, single spaces. */
function safe(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/[\\/]/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A look's own folder: its day and where the problem is, *2026-11-11 · Kitchen*, or the day alone. */
export function lookFolderName(dayYmd: string, place: string | null | undefined): string {
  const where = safe(place).slice(0, 60)
  return where ? `${dayYmd} · ${where}` : dayYmd
}

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
}

/** A file's name in the look's folder: *Photo 1.jpg*, *Video 2.mov*, and *Photo 1 (2).jpg* when that name is taken. */
export function lookFileDriveName(kind: 'photo' | 'video', n: number, mime: string | null | undefined, again = 1): string {
  const ext = EXT[(mime ?? '').trim().toLowerCase().split(';')[0] ?? ''] ?? (kind === 'photo' ? 'jpg' : 'mp4')
  return `${kind === 'photo' ? 'Photo' : 'Video'} ${n}${again > 1 ? ` (${again})` : ''}.${ext}`
}

/** How long a file waits for the customer's Send before it is filed anyway: they may have closed the page. */
export const LOOK_UNSENT_MINUTES = 30

/** A file is due for Drive once the look was sent, or once it has sat finished for half an hour with no Send. */
export function lookFileDue(file: { finished_at: string | null }, look: { sent_at: string | null }, nowMs: number): boolean {
  if (!file.finished_at) return false
  if (look.sent_at) return true
  return nowMs - Date.parse(file.finished_at) >= LOOK_UNSENT_MINUTES * 60_000
}

/**
 * A look with files in and no Send for half an hour counts as sent: its newest file is that old. The customer added
 * what they had and closed the page.
 */
export function lookCountsAsSent(look: { sent_at: string | null }, finishedAts: ReadonlyArray<string | null>, nowMs: number): boolean {
  if (look.sent_at) return false
  const times = finishedAts.filter((t): t is string => Boolean(t)).map((t) => Date.parse(t))
  if (!times.length) return false
  return nowMs - Math.max(...times) >= LOOK_UNSENT_MINUTES * 60_000
}

/** A piece of a video on its way to Drive: 8 MiB, a multiple of the 256 KiB Drive asks of every piece but the last. */
export const DRIVE_PIECE_BYTES = 8 * 1024 * 1024

/** Above this a file goes in pieces. A photo never does. */
export const DRIVE_WHOLE_MAX_BYTES = DRIVE_PIECE_BYTES

/** The next piece from an offset: the inclusive byte range and the header Drive reads. Null when nothing is left. */
export function drivePiece(offset: number, total: number): { start: number; end: number; contentRange: string } | null {
  if (!(total > 0) || offset >= total || offset < 0) return null
  const end = Math.min(offset + DRIVE_PIECE_BYTES, total) - 1
  return { start: offset, end, contentRange: `bytes ${offset}-${end}/${total}` }
}

/** How far Drive says an upload has got, from its `Range: bytes=0-N` header: N + 1, or 0 when it holds nothing yet. */
export function driveOffsetOf(rangeHeader: string | null | undefined): number {
  const m = /bytes=0-(\d+)/.exec(rangeHeader ?? '')
  return m ? Number(m[1]) + 1 : 0
}

/** What the look's card says about Drive. */
export const LOOK_DRIVE_WORDS = {
  open: 'Open in Drive',
  noCustomer: 'Files to Drive once this number has a customer.',
  soon: 'Files to Drive within a few minutes of their Send.',
  filing: (done: number, total: number) => `${done} of ${total} in Drive so far.`,
  held: (why: string) => `Not in Drive yet: ${why}`,
} as const

/** The card's Drive line: where the files are, or why they are not there yet. Null for a look with nothing in. */
export function lookDriveLine(input: { total: number; filed: number; folderUrl: string | null; hasCustomer: boolean; failWhy: string | null }): { words: string; href: string | null } | null {
  if (input.total === 0) return null
  if (!input.hasCustomer) return { words: LOOK_DRIVE_WORDS.noCustomer, href: null }
  if (input.failWhy && input.filed < input.total) return { words: LOOK_DRIVE_WORDS.held(input.failWhy), href: input.folderUrl }
  if (input.filed === 0) return { words: LOOK_DRIVE_WORDS.soon, href: null }
  if (input.filed < input.total) return { words: LOOK_DRIVE_WORDS.filing(input.filed, input.total), href: input.folderUrl }
  return { words: LOOK_DRIVE_WORDS.open, href: input.folderUrl }
}

/** A Drive folder's address. */
export function driveFolderUrl(id: string): string {
  return `https://drive.google.com/drive/folders/${id}`
}
