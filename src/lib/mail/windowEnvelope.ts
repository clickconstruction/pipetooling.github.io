/**
 * The window envelope (the Docsmit train, PR 4 — `docs/DOCSMIT_LIEN_RUN_PLAN.md`, "The window
 * envelope"): Docsmit mails a US-Letter PDF tri-folded in a double-window #10, so the owner's
 * page 1 (counsel's cover letter) must carry the recipient block where the lower window shows,
 * and the pay page's QR and short link under it. Pure: the zone, the lines, the link the QR
 * carries and the code the pay page reads back. The zone is the standard #10 double-window
 * geometry; the first Tracksmit run is read on paper and the numbers amended here if it is off.
 */

/** Where the lower (recipient) window shows on a tri-folded US-Letter page, in millimetres from the page's top-left. */
export const WINDOW_ZONE_MM = { left: 22, top: 48, width: 95, height: 30 } as const

/** The QR's side on the page, and the gap under the window block before it. */
export const WINDOW_QR_MM = 22

export type WindowAddressInput = { name: string; organization: string; address1: string; address2: string; city: string; state: string; postalCode: string }

/** The lines the window shows: the company or the person, the street, a suite, then "City, ST ZIP". Blank parts fall out. */
export function windowAddressLines(a: WindowAddressInput): string[] {
  const who = a.organization.trim() || a.name.trim()
  const cityLine = [a.city.trim(), [a.state.trim().toUpperCase(), a.postalCode.trim()].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return [who, a.address1.trim(), a.address2.trim(), cityLine].filter((l) => l.length > 0)
}

/** No 0/O/1/I: a code read off paper over the phone must not be mistaken. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const MAIL_SHORT_CODE_LENGTH = 8

/** A piece's short code; `random` is (0, 1) per call, `Math.random` unless a test hands one in. */
export function mailShortCode(random: () => number = Math.random): string {
  let out = ''
  for (let i = 0; i < MAIL_SHORT_CODE_LENGTH; i++) out += CODE_ALPHABET[Math.min(CODE_ALPHABET.length - 1, Math.floor(random() * CODE_ALPHABET.length))]
  return out
}

export function isMailShortCode(s: string): boolean {
  return /^[A-Z0-9]{6,16}$/.test(s)
}

/** The link the owner's QR carries: the bill's pay page with this piece's code, so the open is this piece's own event. */
export function mailOpenUrl(payUrl: string, code: string): string {
  const u = new URL(payUrl)
  u.searchParams.set('m', code)
  return u.toString()
}

/** The same link in words under the code, without its scheme. */
export function mailOpenDisplay(payUrl: string, code: string): string {
  return mailOpenUrl(payUrl, code).replace(/^https?:\/\//, '')
}

/** The code the pay page reads from its own address; null when there is none or it is not a code. */
export function mailOpenCodeFrom(search: string): string | null {
  const code = (new URLSearchParams(search.startsWith('?') ? search : `?${search}`).get('m') ?? '').trim().toUpperCase()
  return isMailShortCode(code) ? code : null
}

/** The line printed beside the code on the letter. */
export const WINDOW_QR_CAPTION = 'Scan to see and pay the bills this notice is about.'
