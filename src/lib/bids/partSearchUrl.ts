/**
 * Look a part up on Google (v2.4055).
 *
 * Estimators were copying part names out of the takeoff sheet and pasting them
 * into Google. The search icon at the end of every part name does that for them:
 * the query is the part name exactly as written on the line (owner's pick,
 * 2026-09-28 — not just the part number after "PN:"), and the search opens in a
 * new tab so the takeoff stays where it was.
 */

const GOOGLE_SEARCH = 'https://www.google.com/search'

/** The name as it will be searched: trimmed, inner runs of whitespace collapsed. */
export function partSearchQuery(name: string | null | undefined): string {
  return (name ?? '').replace(/\s+/g, ' ').trim()
}

/** The Google search URL for a part name, or null when there is nothing to search. */
export function partSearchUrl(name: string | null | undefined): string | null {
  const q = partSearchQuery(name)
  if (!q) return null
  const params = new URLSearchParams({ q })
  return `${GOOGLE_SEARCH}?${params.toString()}`
}

/**
 * Splits a name into everything before its last word and the last word itself,
 * so the icon can be bound to the last word with `white-space: nowrap` — a long
 * name that wraps carries the icon down with it instead of leaving it alone on a
 * line. `head` is '' for a one-word name.
 */
export function splitTrailingWord(name: string): { head: string; tail: string } {
  const q = partSearchQuery(name)
  const at = q.lastIndexOf(' ')
  if (at < 0) return { head: '', tail: q }
  return { head: q.slice(0, at), tail: q.slice(at + 1) }
}
