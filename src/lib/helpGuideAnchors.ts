/**
 * Heading anchors for help guides (v2.3594). The guide sanitizer strips `id`
 * attributes, so anchors are assigned on the rendered article: every `h2` /
 * `h3` gets `id = headingAnchor(text)`, and a `#fragment` on the guide URL
 * scrolls to it. `helpGuideHref` builds the address a surface links to —
 * `/help?g=<slug>#<anchor>` — from the heading's text, so a door and the guide
 * cannot drift apart (the text is the key on both sides).
 */

import { GUIDE_DOOR_PARAM, type GuideDoor } from './guideOpenTelemetry'

export function headingAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/§/g, 's')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function helpGuideHref(slug: string, headingText?: string | null, door?: GuideDoor): string {
  // The door (punch list #187 PR 1): which press opened the guide, for the Usage readout; a link that names none reads as `link`.
  const base = `/help?g=${encodeURIComponent(slug)}${door ? `&${GUIDE_DOOR_PARAM}=${door}` : ''}`
  const anchor = headingText ? headingAnchor(headingText) : ''
  return anchor ? `${base}#${anchor}` : base
}

/**
 * The `##` / `###` headings a guide's body writes a second time (v2.6339): the text of each
 * line whose anchor an earlier heading already took. The page numbers a repeat `-2`, so
 * nothing breaks, but a heading's text is its address (`helpGuideHref`) — a door built from
 * it lands on the first copy and the reader meets the section twice. The merge queue's squash
 * of a stack of PRs has put a whole section in twice (v2.6305).
 */
export function repeatedHeadings(body: string): string[] {
  const seen = new Set<string>()
  const repeats: string[] = []
  for (const line of body.split('\n')) {
    const m = /^#{2,3} (.+)$/.exec(line)
    if (!m) continue
    const anchor = headingAnchor(m[1]!)
    if (!anchor) continue
    if (seen.has(anchor)) repeats.push(m[1]!)
    else seen.add(anchor)
  }
  return repeats
}

/** Stamp ids on the article's headings; returns the ids in document order. */
export function applyHeadingAnchors(root: ParentNode): string[] {
  const ids: string[] = []
  const seen = new Map<string, number>()
  for (const h of root.querySelectorAll('h2, h3')) {
    const base = headingAnchor(h.textContent ?? '')
    if (!base) continue
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    const id = n === 1 ? base : `${base}-${n}`
    h.id = id
    ids.push(id)
  }
  return ids
}
