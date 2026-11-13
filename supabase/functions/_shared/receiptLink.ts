/**
 * A receipt link for a card charge (punch list #299, PR 1, v2.7101): the pure rules the `receipt-link` function and the
 * page at `/r/<code>` share. A link opens one charge, or the few a text folds together, with no sign-in, and takes a
 * photo of the receipt. The photo is a counter ticket (#295) with `source = link`, already on its charge. This file
 * holds the link's code, what a link may take, the check of a file's first bytes, what the page is told about a charge,
 * and which job a ticket made through the link carries.
 *
 * No imports, so the app's tests import it as the function does (`src/lib/tickets/receiptLink.ts` re-exports it).
 */

// ---------------------------------------------------------------------------------------------------------------------
// The link's code: ten letters from the estimate link's alphabet (no look-alikes), kept only as its SHA-256.

export const RECEIPT_LINK_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
export const RECEIPT_LINK_CODE_LENGTH = 10
const RECEIPT_LINK_CODE_RE = /^[23456789abcdefghjkmnpqrstuvwxyz]{10}$/

/** The code as typed or tapped, lower-cased, or null when it is not ten letters of the alphabet. */
export function receiptLinkCode(raw: string | null | undefined): string | null {
  const code = (raw ?? '').trim().toLowerCase()
  return RECEIPT_LINK_CODE_RE.test(code) ? code : null
}

/**
 * Ten letters from random bytes with no letter likelier than another: 31 letters go into 248 eight times, so a byte
 * at or past 248 is thrown away, as `share_estimate_link` does. `randomBytes` is the platform's own source.
 */
export function mintReceiptLinkCode(randomBytes: (n: number) => Uint8Array): string {
  let out = ''
  let guard = 0
  while (out.length < RECEIPT_LINK_CODE_LENGTH) {
    if (++guard > 64) throw new Error('receipt link: the random source gave no usable bytes')
    for (const b of randomBytes(32)) {
      if (b >= 248) continue
      out += RECEIPT_LINK_ALPHABET[b % RECEIPT_LINK_ALPHABET.length]
      if (out.length === RECEIPT_LINK_CODE_LENGTH) break
    }
  }
  return out
}

/** Lower-case hex of a digest, for the code's SHA-256. */
export function receiptHexOf(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += b.toString(16).padStart(2, '0')
  return s
}

// ---------------------------------------------------------------------------------------------------------------------
// What a link may take.

export const RECEIPT_LINK_CAPS = {
  /** A link opens for this many days from when it is handed out. */
  days: 14,
  /** Pages on one ticket through a link. A long receipt is two; eight bounds what a forwarded link can add. */
  pages: 8,
  /** A page's bytes as they arrive. A photo is shrunk on the phone to well under this; a PDF goes as it came. */
  pageBytes: 8 * 1024 * 1024,
  /** Charges one link opens: a text folds the charges of one hour together. */
  charges: 10,
} as const

/** The day a link made now stops opening. */
export function receiptLinkExpiry(nowIso: string): string {
  return new Date(Date.parse(nowIso) + RECEIPT_LINK_CAPS.days * 24 * 60 * 60 * 1000).toISOString()
}

/** A link past its day reads closed. */
export function receiptLinkExpired(link: { expires_at: string }, nowIso: string): boolean {
  return !(Date.parse(link.expires_at) > Date.parse(nowIso))
}

export type ReceiptPageMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'

function ascii(bytes: Uint8Array, from: number, to: number): string {
  let s = ''
  for (let i = from; i < to && i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
  return s
}

/**
 * What a page really is, by its first bytes, whatever the phone called it: a JPEG, a PNG, a WebP or a PDF, the four
 * kinds the counter-tickets bucket takes. Anything else is null and is refused.
 */
export function receiptSniff(bytes: Uint8Array): ReceiptPageMime | null {
  if (bytes.length < 12) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes[0] === 0x89 && ascii(bytes, 1, 4) === 'PNG') return 'image/png'
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp'
  if (ascii(bytes, 0, 5) === '%PDF-') return 'application/pdf'
  return null
}

/** A charge the bank failed or took back: nothing to photograph, and its link reads closed. */
const DEAD_STATUSES: ReadonlySet<string> = new Set(['failed', 'cancelled', 'canceled', 'reversed'])

export function receiptChargeDead(status: string | null | undefined): boolean {
  return DEAD_STATUSES.has(String(status ?? '').toLowerCase())
}

// ---------------------------------------------------------------------------------------------------------------------
// What the page is told about a charge.

export interface ReceiptJob {
  id: string
  /** *JP1042 · Oak Hollow Bldg C*, the ledger's short line. */
  label: string
}

/** Which door a ticket came by, as the page says it. */
export type ReceiptTicketDoor = 'link' | 'tally' | 'office'

export interface ReceiptPageTicket {
  id: string
  door: ReceiptTicketDoor
  takenAt: string
  /** The job the ticket names, as a label; null when it names none. */
  job: string | null
  jobId: string | null
  noOneJob: boolean
  pages: { id: string; pdf: boolean }[]
  /** The page may still change the job: a ticket made through a link, not yet used by the office, on a charge not yet sorted. */
  canChangeJob: boolean
  /** The page may take one more page. */
  canAddPage: boolean
}

export interface ReceiptPageCharge {
  /** The request's id: the page's handle for the charge. The bank's own id never leaves the server. */
  id: string
  store: string
  /** Dollars, never signed. */
  amount: number
  /** Money that came back to the card. */
  moneyBack: boolean
  /** When the card was swiped, or when the charge posted when the feed holds no swipe. */
  when: string | null
  /** The holder's first name; empty for a card tied to no one. */
  cardOf: string
  /** The bank failed the charge or took it back. */
  dead: boolean
  /** Where the office sorted the charge, as a label; null when it is not sorted. */
  sortedJob: string | null
  ticket: ReceiptPageTicket | null
  /** The holder's jobs around the day of the charge, offered when nobody has said the job yet. */
  dayJobs: ReceiptJob[]
}

export interface ReceiptChargeFacts {
  requestId: string
  /** Signed dollars as the bank feed has them: a purchase is below zero, money back is above. */
  amount: number
  counterpartyName: string | null
  swipeAt: string | null
  postedAt: string | null
  status: string | null
  holderName: string
  requestClosedAt: string | null
  /** The jobs the office sorted the charge to, the largest split first. */
  sortedJobIds: readonly string[]
  ticket: {
    id: string
    source: string
    taken_at: string
    job_id: string | null
    no_one_job: boolean
    used_at: string | null
    pages: readonly { id: string; page_no: number; mime: string }[]
  } | null
  /** The holder's day jobs, in Sort mode's order. */
  dayJobIds: readonly string[]
  jobLabels: ReadonlyMap<string, string>
}

/** The first word of a name. Empty when there is no name. */
export function receiptFirstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? ''
}

function doorOf(source: string): ReceiptTicketDoor {
  if (source === 'link') return 'link'
  return source === 'office' ? 'office' : 'tally'
}

/** How many day jobs the page offers as chips: the swipe day's own lead, and a long day does not bury the camera. */
export const RECEIPT_DAY_JOBS_MAX = 6

/** One charge as the page draws it. Pure: every label is handed in. */
export function buildReceiptCharge(f: ReceiptChargeFacts): ReceiptPageCharge {
  const label = (id: string | null | undefined) => (id ? (f.jobLabels.get(id) ?? null) : null)
  const sortedJob = f.sortedJobIds.length > 0 ? (f.sortedJobIds.map((id) => label(id)).filter(Boolean).join(' and ') || 'a job') : null
  const sorted = f.sortedJobIds.length > 0
  const dead = receiptChargeDead(f.status) || Boolean(f.requestClosedAt)
  const pages = f.ticket ? [...f.ticket.pages].sort((a, b) => a.page_no - b.page_no) : []
  const ticket: ReceiptPageTicket | null = f.ticket
    ? {
        id: f.ticket.id,
        door: doorOf(f.ticket.source),
        takenAt: f.ticket.taken_at,
        job: label(f.ticket.job_id),
        jobId: f.ticket.job_id,
        noOneJob: f.ticket.no_one_job,
        pages: pages.map((p) => ({ id: p.id, pdf: p.mime === 'application/pdf' })),
        canChangeJob: f.ticket.source === 'link' && !f.ticket.used_at && !sorted && !dead,
        canAddPage: pages.length < RECEIPT_LINK_CAPS.pages && !dead,
      }
    : null
  const offersJobs = !sorted && !dead && (!ticket || ticket.canChangeJob)
  const dayJobs: ReceiptJob[] = []
  if (offersJobs) {
    for (const id of f.dayJobIds) {
      const l = label(id)
      if (l && dayJobs.length < RECEIPT_DAY_JOBS_MAX) dayJobs.push({ id, label: l })
    }
  }
  return {
    id: f.requestId,
    store: (f.counterpartyName ?? '').trim() || 'A store',
    amount: Math.abs(Number(f.amount) || 0),
    moneyBack: Number(f.amount) > 0,
    when: f.swipeAt ?? f.postedAt ?? null,
    cardOf: receiptFirstName(f.holderName),
    dead,
    sortedJob,
    ticket,
    dayJobs,
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The job a ticket made through a link carries.

/** What the page's chips say: one of the day's jobs, Not for one job, or nothing (the chips were skipped). */
export interface ReceiptJobPick {
  jobId?: string | null
  noOneJob?: boolean
}

/**
 * The job columns for a ticket written through a link. The office's sort wins: a charge already sorted takes its
 * largest split's job, and the page asked nothing. Else the chip tapped, when it is one of the day's jobs the page was
 * offered (a job id from anywhere else is dropped, since the link is no door to another job). Else no job, and the
 * office's Tickets list asks.
 */
export function receiptTicketJob(a: { sortedJobIds: readonly string[]; dayJobIds: readonly string[]; pick: ReceiptJobPick | null | undefined }): { job_id: string | null; no_one_job: boolean } {
  if (a.sortedJobIds.length > 0) return { job_id: a.sortedJobIds[0]!, no_one_job: false }
  if (a.pick?.noOneJob) return { job_id: null, no_one_job: true }
  const id = a.pick?.jobId ?? null
  if (id && a.dayJobIds.includes(id)) return { job_id: id, no_one_job: false }
  return { job_id: null, no_one_job: false }
}

/** The page number a new page takes: one past the highest the ticket holds. */
export function receiptNextPageNo(pages: readonly { page_no: number }[]): number {
  return pages.reduce((m, p) => Math.max(m, p.page_no), 0) + 1
}

// ---------------------------------------------------------------------------------------------------------------------
// The answers the function gives, in the words a person on the page reads.

export const RECEIPT_LINK_WORDS = {
  locked: 'Too many wrong links from this connection in the last hour. Wait an hour, then open your link again.',
  closed: 'This link has closed.',
  notACharge: 'That charge is not on this link.',
  dead: 'The bank took this charge back, so there is nothing to photograph.',
  tooBig: 'That file is too big to send. Take the photo again, or send a smaller file.',
  notAPicture: 'That file is not a photo or a PDF. Take a photo of the receipt.',
  full: 'This receipt has all the pages it can take. Hand the rest to the office.',
  jobHeld: 'The office has this receipt already, so the job is theirs to change.',
  failed: 'The receipt did not send. Try again.',
  deskOnly: 'Only the office can copy a receipt link.',
  hasTicket: 'This charge has its ticket already.',
} as const
