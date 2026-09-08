/**
 * Bid references inside a robot's question (v2.3174). Robots write their
 * questions as prose with the bid named the way the app names it —
 * "[audit b474 / footage · sheet P2.01] Your 4in sanitary is 50 ft…" — and the
 * estimator reading the Standing rulings panel asked for that "b474" to be a
 * link, so she can open the bid for context before answering.
 *
 * Pure: split the text into segments, collect the numbers mentioned, and
 * resolve each to a bid id from whatever the caller fetched (plus the row's
 * own `about_bid_id` when the question names exactly one bid).
 */

export type BidRefSegment = { kind: 'text'; text: string } | { kind: 'bid'; text: string; number: string }

/** "b474", "B474", "bp398" — a word on its own, digits only after the prefix. */
const BID_REF_RE = /\b(?:bp|b)(\d{1,6})\b/gi

export function splitBidRefs(text: string): BidRefSegment[] {
  const out: BidRefSegment[] = []
  let last = 0
  for (const m of text.matchAll(BID_REF_RE)) {
    const start = m.index ?? 0
    if (start > last) out.push({ kind: 'text', text: text.slice(last, start) })
    out.push({ kind: 'bid', text: m[0], number: m[1]! })
    last = start + m[0].length
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}

/** Distinct bid numbers mentioned, in first-seen order. */
export function bidNumbersIn(text: string): string[] {
  const seen = new Set<string>()
  for (const s of splitBidRefs(text)) if (s.kind === 'bid' && !seen.has(s.number)) seen.add(s.number)
  return [...seen]
}

/** Distinct bid numbers across many questions — the one lookup the panel fetches. */
export function bidNumbersAcross(texts: Iterable<string>): string[] {
  const seen = new Set<string>()
  for (const t of texts) for (const n of bidNumbersIn(t)) seen.add(n)
  return [...seen]
}

/**
 * Id for a referenced number: the fetched map first; else the row's own
 * `about_bid_id` when the question names exactly one bid (a row asked about
 * b474 that mentions only b474 is about b474 even before the lookup lands).
 */
export function resolveBidRefId(
  number: string,
  text: string,
  bidIdByNumber: Readonly<Record<string, string>>,
  aboutBidId: string | null | undefined,
): string | null {
  const fetched = bidIdByNumber[number]
  if (fetched) return fetched
  if (aboutBidId && bidNumbersIn(text).length === 1) return aboutBidId
  return null
}

/** Where a bid reference opens: the board row, scrolled to and highlighted (v2.2043 deep link). */
export function bidRefHref(bidId: string): string {
  return `/bids?tab=bid-board&bidId=${bidId}`
}

/**
 * A question that never names its bid ("the plans file on this bid…") still
 * has one: when the row carries `about_bid_id` and the text has no reference,
 * the panel appends a trailing "· b474" link. Null when the text already links
 * the bid or the number is unknown.
 */
export function trailingBidRef(
  text: string,
  aboutBidId: string | null | undefined,
  aboutBidNumber: string | null | undefined,
): { id: string; label: string } | null {
  if (!aboutBidId || !aboutBidNumber) return null
  if (bidNumbersIn(text).length > 0) return null
  return { id: aboutBidId, label: `b${aboutBidNumber}` }
}
