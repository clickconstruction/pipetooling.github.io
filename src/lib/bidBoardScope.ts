/**
 * Bid Board scope: People vs Robots (v2.2500).
 *
 * Digital-twin estimators work real bids on the shared board (DIGITAL_TWINS_PLAN:
 * "twin work is visible, humans are never fenced"). As the twin fleet took on real
 * work, its bids started polluting the human board's rollups and duplicating
 * projects humans are also bidding. The amendment: same data, same cards, two
 * SCOPES of one board — the human Bid Board excludes twin bids, and a Robot Board
 * tab shows exactly those. A lens, not a wall: one click apart, identical edit
 * affordances, so the review workflow stays effortless.
 *
 * A bid is a robot bid when its assigned estimator OR its creator is a flagged
 * twin (`users.is_digital_twin`) — assignment is the grant, and twin-created
 * unassigned bids (fence probes, mission residue) belong with the fleet too.
 */

type ScopeBid = {
  estimator_id?: string | null
  created_by?: string | null
}

export function isRobotBid(bid: ScopeBid, twinUserIds: ReadonlySet<string>): boolean {
  if (twinUserIds.size === 0) return false
  return (
    (bid.estimator_id != null && twinUserIds.has(bid.estimator_id)) ||
    (bid.created_by != null && twinUserIds.has(bid.created_by))
  )
}

/** One pass, order-preserving: people bids for the human board, robot bids for the Robot Board. */
export function partitionBidsByScope<T extends ScopeBid>(
  bids: readonly T[],
  twinUserIds: ReadonlySet<string>,
): { people: T[]; robots: T[] } {
  const people: T[] = []
  const robots: T[] = []
  for (const bid of bids) {
    if (isRobotBid(bid, twinUserIds)) robots.push(bid)
    else people.push(bid)
  }
  return { people, robots }
}
