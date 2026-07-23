/**
 * Linkify kernel (v2.961): split free text into text/link segments so pasted
 * URLs render as SHORT clickable links (hostname) instead of full query
 * strings that overflow mobile cards.
 */

export type LinkifySegment = { kind: 'text'; text: string } | { kind: 'link'; href: string; label: string }

/** "employers.indeed.com" from a full URL; falls back to a trimmed prefix for unparseable strings. */
export function shortUrlLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host || url.slice(0, 30)
  } catch {
    return url.slice(0, 30)
  }
}

const URL_RE = /https?:\/\/\S+/g
/** Punctuation that reads as sentence-trailing, not part of the URL. */
const TRAILING_PUNCT_RE = /[).,;:!?\]]+$/

/** Text → alternating text/link segments; URLs keep their sentence-trailing punctuation as text. */
export function splitLinkSegments(text: string): LinkifySegment[] {
  const segments: LinkifySegment[] = []
  let cursor = 0
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0
    let url = match[0]
    const trailing = TRAILING_PUNCT_RE.exec(url)?.[0] ?? ''
    if (trailing) url = url.slice(0, -trailing.length)
    if (start > cursor) segments.push({ kind: 'text', text: text.slice(cursor, start) })
    segments.push({ kind: 'link', href: url, label: shortUrlLabel(url) })
    if (trailing) segments.push({ kind: 'text', text: trailing })
    cursor = start + match[0].length
  }
  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) })
  return segments
}

/** True when the text contains at least one URL (cheap gate before rendering segments). */
export function containsUrl(text: string): boolean {
  return /https?:\/\//.test(text)
}
