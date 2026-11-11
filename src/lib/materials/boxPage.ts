/**
 * The box page on the client (punch list #294, v2.6797): what a scanned cage or box label opens with no sign-in, and the
 * read of what the `box-read` function answers. The pure kernel is shared with the function
 * (`supabase/functions/_shared/boxPage.ts`); tests live beside this file.
 */
export {
  BOX_PAGE_FIND_MAX,
  BOX_PAGE_GONE_DAYS,
  BOX_PAGE_LOCKED_WORDS,
  boxPageCode,
  boxPageCodeWords,
  boxPageFind,
  boxPageFindWords,
  boxPageGoneLines,
  boxPageKind,
  boxPageLines,
  boxPageNoun,
  boxPagePhotoUrl,
  buildBoxPagePayload,
  compareStencils,
  parseBoxPageFindResponse,
  parseBoxPageResponse,
  type BoxPageFindBox,
  type BoxPageFindPayload,
  type BoxPageKind,
  type BoxPageLine,
  type BoxPagePayload,
  type BoxPagePhoto,
  type BoxPageRefusal,
} from '../../../supabase/functions/_shared/boxPage'
import { boxPageCodeWords, boxPageKind, boxPageNoun, parseBoxPageFindResponse, parseBoxPageResponse, type BoxPageFindPayload, type BoxPageKind, type BoxPagePayload } from '../../../supabase/functions/_shared/boxPage'
import { portalFailureCause, type PortalFailureCause } from '../portal/portalFailure'
import { STALE_COUNT_DAYS } from './onSite'

/** The page's state from the function's answer. */
export type BoxPageView =
  | { kind: 'loading' }
  | { kind: 'box'; payload: BoxPagePayload }
  | { kind: 'not_found' }
  /** A retired box: the day it left, and since v2.6874 its stencil, its kind and the office's number when the function answers them. */
  | { kind: 'retired'; retiredOn: string | null; stencil: string | null; boxKind: BoxPageKind | null; phone: string | null }
  | { kind: 'locked' }
  /** The box did not open: its class or the function's own known sentence, never other text. */
  | { kind: 'error'; failure: PortalFailureCause }

export function boxPageView(status: number, body: unknown): BoxPageView {
  if (status === 404) return { kind: 'not_found' }
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

/** Whole days from one YYYY-MM-DD to a later one; null when either is not a day. */
function daysBetweenYmd(fromYmd: string, toYmd: string): number | null {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fromYmd)
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(toYmd)
  if (!a || !b) return null
  return Math.round((Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3])) - Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]))) / 86_400_000)
}

/**
 * Whether the counts can be trusted, in words (v2.6868): the day of the last count read against the app's own rule,
 * `STALE_COUNT_DAYS`, the one the office's *due a count* badge uses. `fresh` is green, `due` amber, `never` grey.
 */
export type BoxPageCountVerdict = { kind: 'fresh' | 'due' | 'never'; words: string; detail: string }

export function boxPageCountVerdict(lastCountedOn: string | null, todayYmd: string): BoxPageCountVerdict {
  if (!lastCountedOn) return { kind: 'never', words: 'Never counted', detail: '' }
  const days = daysBetweenYmd(lastCountedOn, todayYmd)
  // A day that cannot be read against today still says when: the day alone, with no verdict on its age.
  if (days == null) return { kind: 'fresh', words: `Counted ${boxPageDayWords(lastCountedOn)}`, detail: '' }
  const ago = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
  if (days >= STALE_COUNT_DAYS) return { kind: 'due', words: 'Due a count', detail: `last counted ${ago}` }
  return { kind: 'fresh', words: `Counted ${ago}`, detail: boxPageDayWords(lastCountedOn) }
}

/** *1 part* / *6 parts*: how many lines the box holds, beside the list's heading. Nothing for none. */
export function boxPagePartsWords(count: number): string {
  return count <= 0 ? '' : count === 1 ? '1 part' : `${count} parts`
}

/** *2 could not be found since the count*: the Can't find presses on a line since its last count (v2.6874). */
export function boxPageCannotFindWords(count: number): string {
  return `${count} could not be found since the count`
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

/** The search's state from the function's answer (PR 3, v2.6799). */
export type BoxPageFindView =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'found'; payload: BoxPageFindPayload }
  | { kind: 'error'; failure: PortalFailureCause }

export function boxPageFindView(status: number, body: unknown): BoxPageFindView {
  const payload = parseBoxPageFindResponse(body)
  if (!payload || status >= 400) return { kind: 'error', failure: portalFailureCause(status, body, 'open') }
  return { kind: 'found', payload }
}

/** *3 boxes hold a line that matches.* / *1 box holds a line that matches.* */
export function boxPageFoundWords(total: number, max: number): string {
  if (total === 0) return ''
  const n = Math.min(total, max)
  const head = n === 1 ? '1 box holds' : `${n} boxes hold`
  return total > max ? `${head} a line that matches, the first ${max} of ${total}. Type one more word to narrow it.` : `${head} a line that matches.`
}

/** The page's own address with the search open, for the Scan a label page's press. */
export function boxPageFindPath(code: string): string {
  return `${boxPagePath(code)}?find=1`
}
