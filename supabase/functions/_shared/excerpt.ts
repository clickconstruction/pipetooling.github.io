/**
 * The excerpt under a Find a file hit (v2.6306): the first place a file's text says the searched words, cut to about one
 * line around it, with the spans to bold. Drive's own search names the files that match but never the passage, so this
 * is our read of the file. Pure: `drive-link`'s search hands it the text it read, the client's tests hand it strings.
 */
export type Excerpt = { text: string; marks: [number, number][] }

/** About one line of text around the words. */
export const EXCERPT_WIDTH = 160
/** How far apart the words may sit and still count as one place. */
const EXCERPT_WINDOW = 240

const ELLIPSIS = '…'

/** The searched words as Drive matches them: lowercase, quotes and end punctuation off, one letter dropped, each once. */
export function excerptTokens(words: string): string[] {
  const seen = new Set<string>()
  for (const raw of words.toLowerCase().split(/\s+/)) {
    const w = raw.replace(/^["'“”‘’(\[]+/, '').replace(/["'“”‘’)\],.;:!?]+$/, '')
    if (w.length >= 2) seen.add(w)
  }
  return Array.from(seen)
}

function allIndexes(hay: string, needle: string): number[] {
  const out: number[] = []
  let i = hay.indexOf(needle)
  while (i !== -1) {
    out.push(i)
    i = hay.indexOf(needle, i + needle.length)
  }
  return out
}

/**
 * The line around the words, or null when the text never says them. The anchor is the earliest place from which every
 * found word occurs within the window, else the first occurrence of any; the cut keeps whole words and marks every
 * occurrence of each word inside it.
 */
export function excerptOf(raw: string, words: string, width = EXCERPT_WIDTH): Excerpt | null {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return null
  const tokens = excerptTokens(words)
  if (tokens.length === 0) return null
  const lower = text.toLowerCase()
  const found = tokens.map((t) => ({ t, at: allIndexes(lower, t) })).filter((f) => f.at.length > 0)
  if (found.length === 0) return null

  const positions = found.flatMap((f) => f.at).sort((a, b) => a - b)
  let anchor = positions[0]!
  for (const a of positions) {
    if (found.every((f) => f.at.some((b) => b >= a && b - a <= EXCERPT_WINDOW))) {
      anchor = a
      break
    }
  }

  let start = Math.max(0, anchor - Math.floor(width / 3))
  let end = Math.min(text.length, start + width)
  if (end - start < width) start = Math.max(0, end - width)
  if (start > 0) {
    const sp = text.indexOf(' ', start)
    if (sp !== -1 && sp < anchor) start = sp + 1
  }
  if (end < text.length) {
    const sp = text.lastIndexOf(' ', end)
    if (sp > anchor) end = sp
  }

  const cut = text.slice(start, end)
  const cutLower = cut.toLowerCase()
  const lead = start > 0 ? ELLIPSIS.length : 0
  const marks: [number, number][] = []
  for (const { t } of found) for (const i of allIndexes(cutLower, t)) marks.push([i + lead, i + lead + t.length])
  marks.sort((a, b) => a[0] - b[0])
  const out = (start > 0 ? ELLIPSIS : '') + cut + (end < text.length ? ELLIPSIS : '')
  // Overlapping marks merge, and so do two words a single space apart, so "rock clause" bolds as one.
  const merged: [number, number][] = []
  for (const m of marks) {
    const last = merged[merged.length - 1]
    if (last && (m[0] <= last[1] || (m[0] === last[1] + 1 && out[last[1]] === ' '))) last[1] = Math.max(last[1], m[1])
    else merged.push([m[0], m[1]])
  }
  return { text: out, marks: merged }
}
