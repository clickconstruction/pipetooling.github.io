/**
 * The dev-only 🤖 Queue lens (v2.2542): every robot-able bid on the board,
 * requested ones first. Requested sorts oldest-request-first (fairness);
 * ready sorts by due date (nulls last). A bid with an existing twin copy is
 * never queued — it's already done.
 */
import { robotBidReadiness, type RobotReadinessBidFields } from './robotBidReadiness'

export interface RobotQueueBidFields extends RobotReadinessBidFields {
  id: string
  robot_requested_at: string | null
  robot_requested_by: string | null
  bid_date_sent: string | null
  outcome: string | null
}

export interface RobotQueue<B extends RobotQueueBidFields> {
  requested: B[]
  ready: B[]
}

export function buildRobotQueue<B extends RobotQueueBidFields>(
  bids: readonly B[],
  twinExistsForBidId: (bidId: string) => boolean,
  opts?: {
    /** YMD; a bid whose due date is BEFORE this is stale and left off the queue. */
    staleDueBefore?: string
  },
): RobotQueue<B> {
  const requested: B[] = []
  const ready: B[] = []
  for (const bid of bids) {
    // Queue = bids still worth robot-bidding: unsent and undecided (the same
    // shape twin-mcp get_shadow_queue uses). The board icon stays board-wide.
    if (bid.bid_date_sent || bid.outcome) continue
    if (opts?.staleDueBefore && bid.bid_due_date && bid.bid_due_date < opts.staleDueBefore) continue
    if (twinExistsForBidId(bid.id)) continue
    if (robotBidReadiness(bid).state !== 'ready') continue
    if (bid.robot_requested_at) requested.push(bid)
    else ready.push(bid)
  }
  requested.sort((a, b) => (a.robot_requested_at ?? '').localeCompare(b.robot_requested_at ?? ''))
  ready.sort((a, b) => {
    if (a.bid_due_date && b.bid_due_date) return a.bid_due_date.localeCompare(b.bid_due_date)
    if (a.bid_due_date) return -1
    if (b.bid_due_date) return 1
    return 0
  })
  return { requested, ready }
}
