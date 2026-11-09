/**
 * The box page on the client (punch list #294, v2.6797): what a scanned cage or box label opens with no sign-in, and the
 * read of what the `box-read` function answers. The pure kernel is shared with the function
 * (`supabase/functions/_shared/boxPage.ts`); tests live beside this file.
 */
export {
  BOX_PAGE_LOCKED_WORDS,
  boxPageCode,
  boxPageCodeWords,
  boxPageKind,
  boxPageLines,
  boxPageNoun,
  boxPagePhotoUrl,
  buildBoxPagePayload,
  parseBoxPageResponse,
  type BoxPageKind,
  type BoxPageLine,
  type BoxPagePayload,
  type BoxPagePhoto,
  type BoxPageRefusal,
} from '../../../supabase/functions/_shared/boxPage'
import { parseBoxPageResponse, type BoxPagePayload } from '../../../supabase/functions/_shared/boxPage'
import { portalFailureCause, type PortalFailureCause } from '../portal/portalFailure'

/** The page's state from the function's answer. */
export type BoxPageView =
  | { kind: 'loading' }
  | { kind: 'box'; payload: BoxPagePayload }
  | { kind: 'not_found' }
  | { kind: 'retired'; retiredOn: string | null }
  | { kind: 'locked' }
  /** The box did not open: its class or the function's own known sentence, never other text. */
  | { kind: 'error'; failure: PortalFailureCause }

export function boxPageView(status: number, body: unknown): BoxPageView {
  if (status === 404) return { kind: 'not_found' }
  if (status === 410) {
    const r = body && typeof body === 'object' ? (body as { retiredOn?: unknown }).retiredOn : null
    return { kind: 'retired', retiredOn: typeof r === 'string' && r ? r : null }
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

/** Where the sign-in comes back to: the same box. */
export function boxPagePath(code: string): string {
  return `/b/${code.toLowerCase()}`
}
