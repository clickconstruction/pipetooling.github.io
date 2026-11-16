/**
 * The box page on the client (punch list #294, v2.6797): what a scanned cage or box label opens with no sign-in, and the
 * read of what the `box-read` function answers. The pure kernel is shared with the function
 * (`supabase/functions/_shared/boxPage.ts`); tests live beside this file.
 *
 * Since v2.7379 (Taunya's call of 2026-11-15) the page says whose the box is and how to reach the office, and what is
 * inside needs a sign-in: the function answers the name, the kind, the code and the office's number and nothing else.
 * Since v2.7405 it is the company's card (her drawing of the same evening): the company first, the box right under it
 * on one plate, and two rows that each open a choice of a text or an email, so the answer also carries the company's
 * email and the address a bid ask goes to.
 */
export {
  BOX_PAGE_COMPANY_KEY,
  BOX_PAGE_LOCKED_WORDS,
  BOX_PAGE_SIGN_IN_ERROR,
  boxPageAsksInside,
  boxPageCode,
  boxPageCodeWords,
  boxPageCompanyEmail,
  boxPageCompanyPhone,
  boxPageEarlyAnswer,
  boxPageEmail,
  boxPageKind,
  boxPageNoun,
  boxPageOfficePhone,
  boxPagePlate,
  boxPageStickerAnswer,
  buildBoxPagePayload,
  parseBoxPageResponse,
  type BoxPageKind,
  type BoxPageOffice,
  type BoxPagePayload,
  type BoxPageRefusal,
  type BoxPageStickerAnswer,
  type BoxPageStickerRow,
} from '../../../supabase/functions/_shared/boxPage'
import { boxPageCodeWords, boxPageEmail, boxPageKind, boxPageNoun, parseBoxPageResponse, type BoxPageKind, type BoxPageOffice, type BoxPagePayload } from '../../../supabase/functions/_shared/boxPage'
import { portalFailureCause, type PortalFailureCause } from '../portal/portalFailure'

/** The page's state from the function's answer. */
export type BoxPageView =
  | { kind: 'loading' }
  | { kind: 'box'; payload: BoxPagePayload }
  | { kind: 'not_found' }
  /** A retired box: the day it left, and since v2.6874 its stencil, its kind and the office's number when the function answers them. */
  | { kind: 'retired'; retiredOn: string | null; stencil: string | null; boxKind: BoxPageKind | null; phone: string | null }
  | { kind: 'locked' }
  /** A sticker on no box yet (v2.7072, punch list #329): its number and nothing else. */
  | { kind: 'sticker_blank'; number: number }
  /** A sticker that was marked lost: its number and the day. */
  | { kind: 'sticker_lost'; number: number; lostOn: string | null }
  /** The box did not open: its class or the function's own known sentence, never other text. */
  | { kind: 'error'; failure: PortalFailureCause }

/** A sticker's answer read off the body: its number when the body names that refusal, else null. */
function stickerNumberOf(body: unknown, refusal: 'sticker_blank' | 'sticker_lost'): number | null {
  if (!body || typeof body !== 'object') return null
  const b = body as { error?: unknown; number?: unknown }
  return b.error === refusal && typeof b.number === 'number' && Number.isInteger(b.number) && b.number > 0 ? b.number : null
}

export function boxPageView(status: number, body: unknown): BoxPageView {
  if (status === 404) {
    const number = stickerNumberOf(body, 'sticker_blank')
    return number ? { kind: 'sticker_blank', number } : { kind: 'not_found' }
  }
  if (status === 410 && stickerNumberOf(body, 'sticker_lost')) {
    const lostOn = (body as { lostOn?: unknown }).lostOn
    return { kind: 'sticker_lost', number: stickerNumberOf(body, 'sticker_lost')!, lostOn: typeof lostOn === 'string' && lostOn.trim() ? lostOn.trim() : null }
  }
  if (status === 410) {
    const b = body && typeof body === 'object' ? (body as { retiredOn?: unknown; stencil?: unknown; kind?: unknown; phone?: unknown }) : {}
    const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    const stencil = text(b.stencil)
    return { kind: 'retired', retiredOn: text(b.retiredOn), stencil, boxKind: stencil && typeof b.kind === 'string' ? boxPageKind(b.kind) : null, phone: text(b.phone) }
  }
  if (status === 429 && body && typeof body === 'object' && (body as { code?: unknown }).code === 'locked') return { kind: 'locked' }
  const payload = parseBoxPageResponse(body)
  if (!payload || status >= 400) return { kind: 'error', failure: portalFailureCause(status, body, 'open') }
  return { kind: 'box', payload }
}

/** `2026-11-05` → *Wednesday, Nov 5*; the day as the page reads it. Anything else comes back as given. */
export function boxPageDayWords(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** A US number as a phone dials it, `+15125550142`; null when it is not ten digits, or eleven starting with 1. */
export function boxPageDialNumber(phone: string | null | undefined): string | null {
  const d = (phone ?? '').replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return null
}

/** What the text to the office opens with: the box as its label names it, then a colon for the person's own words. */
export function boxPageTextWords(kind: BoxPageKind, stencil: string, code: string): string {
  return `${boxPageNoun(kind)} ${stencil}, ${boxPageCodeWords(code)}: `
}

/**
 * What *Ask for a bid* opens with (v2.7379; an email since v2.7405): the ask, then the box that was scanned, so the
 * office can tell which site the person was standing on, then a colon for their own words.
 */
export function boxPageBidWords(kind: BoxPageKind, stencil: string, code: string): string {
  return `I would like a bid. I scanned ${boxPageNoun(kind, false)} ${stencil}, ${boxPageCodeWords(code)}: `
}

/** What *Work with us* opens the text or the email with (v2.7379): the same, for someone who wants a job. */
export function boxPageWorkWords(kind: BoxPageKind, stencil: string, code: string): string {
  return `I would like to work with Click. I scanned ${boxPageNoun(kind, false)} ${stencil}, ${boxPageCodeWords(code)}: `
}

/** *Our cage on this site*, *Our box on this site*: the small line over the box's name on the plate (v2.7405). */
export function boxPageOursWords(kind: BoxPageKind): string {
  return `Our ${boxPageNoun(kind, false)} on this site`
}

/** *Cage ZZ1*, *Box G81*: the box's name on the plate, the kind said with it (v2.7405). */
export function boxPageNameWords(kind: BoxPageKind, stencil: string): string {
  return `${boxPageNoun(kind)} ${stencil}`
}

/** *Let us know about cage ZZ1.*: the line under *Moved, damaged or in the way?* (v2.7405). */
export function boxPageKnowLine(kind: BoxPageKind, stencil: string): string {
  return `Let us know about ${boxPageNoun(kind, false)} ${stencil}.`
}

/** The same row's line for someone who reads Spanish first. Cage, box and pile are all feminine in Spanish. */
export const BOX_PAGE_KNOW_LINE_ES = '¿Estorba o está dañada? Avísenos.'

/** The company's website as the foot of the page reads it. No setting holds one. */
export const BOX_PAGE_WEBSITE = 'clickplumbing.com'

/**
 * A link that opens the phone's own Mail with the address, a subject and the opening words filled in (v2.7405). Null
 * when the address is not one (`boxPageEmail`). Like the text link, it writes nothing to the app.
 */
export function boxPageMailHref(to: string | null | undefined, subject: string, words: string): string | null {
  const address = boxPageEmail(to)
  return address ? `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(words)}` : null
}

/** The subject of the email *Ask for a bid* opens. */
export const BOX_PAGE_BID_SUBJECT = 'Bid request'

/** The box as the page's words name it. */
type BoxPageNamed = { kind: BoxPageKind; stencil: string; code: string }

/**
 * Where *Ask for a bid* goes (v2.7405): an email to the bids box, which the app reads, with the scanned box in the
 * words. With no bids address it is an email to the company's own, and with neither a text to the company's number,
 * as it was from v2.7379. Null when there is no way at all, and the press is not drawn.
 */
export function boxPageBidHref(box: BoxPageNamed, office: BoxPageOffice | null): { href: string; by: 'email' | 'text' } | null {
  const words = boxPageBidWords(box.kind, box.stencil, box.code)
  const mail = boxPageMailHref(office?.bidsEmail, BOX_PAGE_BID_SUBJECT, words) ?? boxPageMailHref(office?.email, BOX_PAGE_BID_SUBJECT, words)
  if (mail) return { href: mail, by: 'email' }
  const text = boxPageTextHref(office?.phone, words)
  return text ? { href: text, by: 'text' } : null
}

/** The two rows that open a choice (v2.7405): *Moved, damaged or in the way?* and *Work with us*. */
export type BoxPageSheetKind = 'know' | 'work'

/** One sheet: its words, and the two ways to the office. A way with no number or address is null and not drawn. */
export type BoxPageSheet = {
  kind: BoxPageSheetKind
  title: string
  words: string
  textHref: string | null
  phone: string | null
  mailHref: string | null
  email: string | null
}

const SHEET_WORDS: Record<BoxPageSheetKind, { title: string; words: string }> = {
  know: { title: 'Let us know', words: 'Send us a photo and we will work to make it right.' },
  work: { title: 'Work with us', words: 'Always hiring motivated teammates. How would you like to reach the office?' },
}

/**
 * The sheet a row opens (v2.7405, Taunya's word of 2026-11-15): a text to the company's number or an email to the
 * company's address, each opening with the box that was scanned so the office knows where the person stood. Null when
 * the office has neither a number a phone can text nor an address, and the row is not drawn.
 */
export function boxPageSheet(kind: BoxPageSheetKind, box: BoxPageNamed, office: BoxPageOffice | null): BoxPageSheet | null {
  const opening = kind === 'know' ? boxPageTextWords(box.kind, box.stencil, box.code) : boxPageWorkWords(box.kind, box.stencil, box.code)
  const subject = kind === 'know' ? `${boxPageNameWords(box.kind, box.stencil)}, ${boxPageCodeWords(box.code)}` : 'Work with Click'
  const textHref = boxPageTextHref(office?.phone, opening)
  const mailHref = boxPageMailHref(office?.email, subject, opening)
  if (!textHref && !mailHref) return null
  return { kind, ...SHEET_WORDS[kind], textHref, phone: textHref ? (office?.phone ?? null) : null, mailHref, email: mailHref ? boxPageEmail(office?.email) : null }
}

/**
 * *Text the office* (v2.6874): a link that opens the phone's own Messages with the number and the box's name filled in.
 * It writes nothing to the app: the page stays read-only signed out. `?&body=` is the form both iPhone and Android take.
 */
export function boxPageTextHref(phone: string | null | undefined, words: string): string | null {
  const n = boxPageDialNumber(phone)
  return n ? `sms:${n}?&body=${encodeURIComponent(words)}` : null
}

export function boxPageCallHref(phone: string | null | undefined): string | null {
  const n = boxPageDialNumber(phone)
  return n ? `tel:${n}` : null
}

/** The Scan a label page, where a typed code opens a box. */
export const BOX_SCAN_PATH = '/b'

/** Where the sign-in comes back to: the same box. */
export function boxPagePath(code: string): string {
  return `/b/${code.toLowerCase()}`
}
