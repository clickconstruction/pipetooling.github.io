/**
 * Materials on site (punch list #209): the box label. A short code from the container's id makes a
 * small code — HTTPS://CLICKTOOLING.COM/B/7D759246, all capitals so the QR packs it as letters and
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

/**
 * The short host the label points at: prts.co forwards every path to clicktooling.com (bought 2026-10-28 for
 * this). No scheme in the code — the phone's camera opens a bare address — so the QR stays a 21-module square.
 */
export const BOX_LINK_HOST = 'prts.co'

/** The id's first eight characters, as the label prints them under the code. */
export function boxCode(containerId: string): string {
  return containerId.replace(/-/g, '').slice(0, 8).toUpperCase()
}

/** What the QR carries: the short host and the code, in capitals so the QR packs it as letters. */
export function boxUrl(containerId: string): string {
  return `${BOX_LINK_HOST}/b/${boxCode(containerId)}`.toUpperCase()
}

/** The same address as a person types it, under the code. */
export function boxAddress(containerId: string): string {
  return `${BOX_LINK_HOST}/b/${boxCode(containerId)}`
}

/** The code typed or scanned, read the way `boxCode` prints it. Empty when it cannot be a code. */
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
