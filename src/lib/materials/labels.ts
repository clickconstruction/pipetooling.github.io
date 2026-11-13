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

/**
 * The letters and number a name starts with (v2.7195): `G12` of `G12 COPPER 90`, `G24B` of `G24B`. One letter after
 * the number stays, since G24 and G24B are two boxes. Null when the name does not start that way (`CONCRETE MIX`).
 */
export function labelPlate(name: string): string | null {
  const m = /^([A-Z]+\d+[A-Z]?)(?=\s|$)/i.exec(name.trim())
  return m ? m[1]!.toUpperCase() : null
}

type NamedBox = { id: string; label: string; retiredAt?: string | null }

/**
 * What each label prints in large type (the owner's ask, 2026-11-13): the letters and number alone, without the
 * words typed after them, so a label stays true when what the box holds changes. Two names print whole: one with no
 * letters and number to print, and one whose short form another live box in the list shares, since two labels that
 * read the same would send a person to the wrong box. The QR is the box's own either way.
 */
export function labelPrintNames(containers: ReadonlyArray<NamedBox>): Map<string, string> {
  const live = containers.filter((c) => !c.retiredAt)
  const shared = new Map<string, number>()
  for (const c of live) {
    const plate = labelPlate(c.label) ?? c.label.trim().toUpperCase()
    shared.set(plate, (shared.get(plate) ?? 0) + 1)
  }
  const out = new Map<string, string>()
  for (const c of containers) {
    const plate = labelPlate(c.label)
    out.set(c.id, plate && (shared.get(plate) ?? 0) <= 1 ? plate : c.label)
  }
  return out
}

/** One box's printed name out of `labelPrintNames`, the whole name when the box is not in the list. */
export function labelPrintName(names: ReadonlyMap<string, string>, box: { id: string; label: string }): string {
  return names.get(box.id) ?? box.label
}

/**
 * The line under the pick when a ticked label prints shorter than its name, so nobody is surprised at the printer.
 * Null when every ticked label prints its whole name.
 */
export function shortenedLabelsNote(picked: ReadonlyArray<{ id: string; label: string }>, names: ReadonlyMap<string, string>): string | null {
  const short = picked.filter((c) => labelPrintName(names, c) !== c.label)
  const first = short[0]
  if (!first) return null
  const more = short.length - 1
  const lead = `${first.label} prints as ${labelPrintName(names, first)}${more > 0 ? `, and ${more} more like it` : ''}.`
  return `${lead} A label carries the letter and number alone.`
}
