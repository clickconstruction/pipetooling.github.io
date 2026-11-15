/**
 * Materials on site: what is in a box, on one line (punch list #351, PR 2, the owner's call 3 of 2026-11-14).
 *
 * Nothing said what was in a box but its part lines, so people typed it into the name (`R76 TOILETS`). The line is its
 * own thing now. **The app writes it from the box's parts until a person says it better**: one kind of part reads its
 * name and count (*Kohler toilets · 24*), several read how many and the two the box holds most of (*7 parts: 2 inch 90,
 * 1-1/2 coupling and 5 more*), and an empty box reads nothing. **A person's own words win** from the moment they are
 * typed, and clearing them hands the line back to the app. Only a person's words are saved
 * (`job_containers.description`, at most 80 characters, null until someone says); the app's line is never stored, so
 * it is never stale.
 *
 * Pure and Deno-free on purpose: the screens read it through `src/lib/materials/boxLine.ts` and the scanned page's
 * function through `boxPage.ts` beside this file, so a signed-out page reads the same line the crew does.
 */

/** `job_containers.description`'s own limit, and the most the app's own line runs to. */
export const BOX_LINE_MAX = 80

/** A part of a box as the line reads it: its name and how many are on hand. */
export type BoxLinePart = { partName: string; onHand: number }

/** A line as it is saved and shown: trimmed, one space between words. Anything but text is empty. */
export function cleanBoxLine(typed: unknown): string {
  return typeof typed === 'string' ? typed.trim().replace(/\s+/g, ' ') : ''
}

const count = (n: number): string => n.toLocaleString('en-US')

/** The parts a line is written from: something on hand, the most first, a tie in name order. */
function held(parts: ReadonlyArray<BoxLinePart>): BoxLinePart[] {
  return parts
    .filter((p) => p.onHand > 0 && cleanBoxLine(p.partName) !== '')
    .map((p) => ({ partName: cleanBoxLine(p.partName), onHand: p.onHand }))
    .sort((a, b) => b.onHand - a.onHand || a.partName.localeCompare(b.partName))
}

/** `make(name)` whole when it fits the line, else with the name cut short and an ellipsis. */
function fit(make: (name: string) => string, name: string): string {
  const whole = make(name)
  if (whole.length <= BOX_LINE_MAX) return whole
  const room = Math.max(1, name.length - (whole.length - BOX_LINE_MAX) - 1)
  return make(`${name.slice(0, room).trimEnd()}…`)
}

/**
 * The app's own line, from the parts. One kind of part: its name and count. Two: both names. More: the two the box
 * holds most of and how many more. A line past 80 characters names one part, and that name is cut short before the
 * count ever is. Nothing on hand is no line.
 */
export function boxLineFromParts(parts: ReadonlyArray<BoxLinePart>): string {
  const ps = held(parts)
  const n = ps.length
  if (n === 0) return ''
  const first = ps[0]!
  if (n === 1) return fit((name) => `${name} · ${count(first.onHand)}`, first.partName)
  const second = ps[1]!
  const both = n === 2 ? `2 parts: ${first.partName} and ${second.partName}` : `${count(n)} parts: ${first.partName}, ${second.partName} and ${count(n - 2)} more`
  if (both.length <= BOX_LINE_MAX) return both
  return fit((name) => `${count(n)} parts: ${name} and ${count(n - 1)} more`, first.partName)
}

/** Who wrote the line a screen shows: a person, the app from the parts, or nobody (an empty box nobody described). */
export type BoxLineBy = 'person' | 'app' | 'none'
export type BoxLine = { text: string; by: BoxLineBy }

/** The line a box shows: a person's words when there are any, else the app's from the parts, else nothing. */
export function boxLine(said: string | null | undefined, parts: ReadonlyArray<BoxLinePart>): BoxLine {
  const own = cleanBoxLine(said)
  if (own) return { text: own, by: 'person' }
  const app = boxLineFromParts(parts)
  return app ? { text: app, by: 'app' } : { text: '', by: 'none' }
}

/**
 * The line where there is room for a few words, a Print labels chip: a person's words as they are; the app's without
 * its count (*2 inch 90*), or how many parts when the box is mixed (*7 parts*).
 */
export function boxLineShort(said: string | null | undefined, parts: ReadonlyArray<BoxLinePart>): string {
  const own = cleanBoxLine(said)
  if (own) return own
  const ps = held(parts)
  if (ps.length === 0) return ''
  return ps.length === 1 ? ps[0]!.partName : `${count(ps.length)} parts`
}

/** A box's name with its line beside it, as a chip reads: *R76 · Kohler toilets*, or the name alone. */
export function boxNameWithLine(name: string, line: string): string {
  return line ? `${name} · ${line}` : name
}
