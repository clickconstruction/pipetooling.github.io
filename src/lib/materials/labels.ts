/**
 * Materials on site (punch list #209): the box label. A short code from the container's id makes a
 * small code — HTTPS://PRTS.CO/B/7D759246, all capitals so the QR packs it as letters and
 * stays a 25-module square — and the label carries the box's lines with room to write: what the
 * ledger says is in it, then blank rows for the pen. Pure.
 */

export type LabelLine = { partName: string; manufacturer: string | null; onHand: number }

/** A row of the label's table: a line the ledger holds, or null for a blank ruled row. */
export type LabelRow = LabelLine | null

/** A label always has this many rows, so an empty box still has lines to write on. */
export const LABEL_MIN_ROWS = 10
/** And at least this many blank rows under what the ledger holds, for what gets added. */
export const LABEL_BLANK_ROWS = 4

/** The short host the label points at: prts.co forwards every path to clicktooling.com (bought 2026-10-28 for this). */
export const BOX_LINK_HOST = 'prts.co'

/**
 * The scheme the QR opens with (v2.6862, punch list #304). The code carried the bare address until then, on the
 * belief that a phone's camera opens one; an iPhone's camera reads it as words and hands it to a web search, as the
 * first strip off the PT-D610BT showed. With the scheme every camera offers the page. The price is one size of QR:
 * 26 characters is a version-2, 25-module code where 18 was a 21-module one.
 */
export const BOX_LINK_SCHEME = 'https://'

/** The id's first eight characters, as the label prints them under the code. */
export function boxCode(containerId: string): string {
  return containerId.replace(/-/g, '').slice(0, 8).toUpperCase()
}

/** What the QR carries: the scheme, the short host and the code, in capitals so the QR packs it as letters. */
export function boxUrl(containerId: string): string {
  return `${BOX_LINK_SCHEME}${BOX_LINK_HOST}/b/${boxCode(containerId)}`.toUpperCase()
}

/** The same address as a person types it, under the code. */
export function boxAddress(containerId: string): string {
  return `${BOX_LINK_HOST}/b/${boxCode(containerId)}`
}

/** The code as a person reads it: four characters, a dash, four characters (v2.6796, punch list #294), so it relays over the phone. */
export function dashedCode(code: string): string {
  const c = code.replace(/[^0-9a-z]/gi, '').toUpperCase()
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c
}

/** The label's line under the QR: `7D75-9246`. The QR itself keeps `boxUrl`, with no dash. */
export function boxCodeWords(containerId: string): string {
  return dashedCode(boxCode(containerId))
}

/** The address as a person reads or relays it: `prts.co/b/7D75-9246`; typed with or without the dash it opens the same box. */
export function boxAddressWords(containerId: string): string {
  return `${BOX_LINK_HOST}/b/${boxCodeWords(containerId)}`
}

/** What Copy the label code puts on the clipboard (v2.6800): the address in capitals with its scheme and its dash, for a QR typed into Brother's app; the dash reads either way. */
export function boxClipboardWords(containerId: string): string {
  return `${BOX_LINK_SCHEME}${boxAddressWords(containerId)}`.toUpperCase()
}

/** The toast after the copy. */
export function copiedLabelWords(containerId: string): string {
  return `Copied ${boxClipboardWords(containerId)}. Paste it into the Brother app as a QR code.`
}

/** The code typed or scanned, read the way `boxCode` prints it, the dash dropped. Empty when it cannot be a code. */
export function normalizeBoxCode(code: string): string {
  const c = code.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 8)
  return c.length === 8 ? c : ''
}

/** The label's rows: the lines on hand, then blank rows — at least `blankAfter`, and enough to reach `minRows`. */
export function labelRows(lines: ReadonlyArray<LabelLine>, minRows = LABEL_MIN_ROWS, blankAfter = LABEL_BLANK_ROWS): LabelRow[] {
  const filled: LabelRow[] = lines.filter((l) => l.onHand > 0).map((l) => ({ partName: l.partName, manufacturer: l.manufacturer, onHand: l.onHand }))
  const blanks = Math.max(blankAfter, minRows - filled.length)
  return [...filled, ...Array.from({ length: blanks }, () => null)]
}
