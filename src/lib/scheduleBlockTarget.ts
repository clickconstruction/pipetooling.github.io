/**
 * What a schedule block's opaque anchor id points at (J18-F1, journey-map
 * Tier-1 #6c).
 *
 * Hub plumbing carries one string per block: the job uuid for job blocks, or
 * `bid:<uuid>` for bid-anchored blocks (v2.1613, `scheduleBlockAnchorId` in
 * `jobScheduleBlocks.ts`). The week grid's "open it" gesture used to hand that
 * string straight to `?jobId=`, so a bid block opened a per-job week grid that
 * fed `bid:<uuid>` into uuid filters — a broken link that failed and, before
 * v2.2843, was reported as "No connection". This kernel is the one place the
 * sender and the receiver decide which kind of thing a block id names.
 *
 * Kept free of the supabase-backed `jobScheduleBlocks.ts` so both routers can
 * import it without pulling the client into a pure test.
 */

export type ScheduleBlockTarget = { kind: 'job'; id: string } | { kind: 'bid'; id: string }

/** Must match `SCHEDULE_BID_ANCHOR_PREFIX` in `jobScheduleBlocks.ts`. */
const BID_PREFIX = 'bid:'

export function scheduleBlockTarget(anchorId: string): ScheduleBlockTarget {
  const id = anchorId.trim()
  if (id.startsWith(BID_PREFIX)) return { kind: 'bid', id: id.slice(BID_PREFIX.length).trim() }
  return { kind: 'job', id }
}

/**
 * Where the Bids page opens one bid: the Edit Bid deep link
 * (`?bidId=<uuid>&openBidEdit=1`, the same URL `BidPreviewModalContext` uses
 * for "Edit bid"). Returns null for an empty id so a malformed `bid:` link goes
 * back to the hub instead of to a Bids page hunting for nothing.
 */
export function bidOpenPath(bidId: string, openBidEditQuery: string): string | null {
  const id = bidId.trim()
  if (!id) return null
  const q = new URLSearchParams()
  q.set('bidId', id)
  q.set(openBidEditQuery, '1')
  return `/bids?${q.toString()}`
}
