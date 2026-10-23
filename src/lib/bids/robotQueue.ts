/**
 * The 🤖 Queue lens and the Console's counts (v2.2542; one rule since v2.5753): every robot-able
 * bid on the board as the dispatcher sees it. The rule is `buildShadowQueue` in
 * `supabase/functions/_shared/shadowEligibility.ts`, the kernel twin-mcp's `next_shadow` claims
 * by and a round's check-in reports from: requested first (oldest ask), then ready by due date,
 * then the live bids with plans the rounds pass over, each with the reason. Before this the lens
 * had a rule of its own (any division, no lookback, a paired shell of any status counted as
 * done) and read *Ready · 4* while the rounds found nothing to do (2026-10-23).
 */
import { buildShadowQueue, type ShadowCandidateBid, type ShadowHeld, type ShadowRunStatus } from '../../../supabase/functions/_shared/shadowEligibility'

export interface RobotQueueBidFields extends ShadowCandidateBid {
  id: string
  robot_requested_by: string | null
}

export interface RobotQueue<B extends RobotQueueBidFields> {
  requested: B[]
  ready: B[]
  held: Array<ShadowHeld<B>>
}

export type RobotQueueInput = {
  /** The Plumbing service type's id (`plumbingServiceTypeIdOf`); null until the types load, and the division is not checked. */
  plumbingServiceTypeId: string | null
  /** The latest shadow run per reference bid number, from `list_shadow_runs`; a void run is not a robot on the bid. */
  shadowRunByBidNumber: ReadonlyMap<string, { status: string }>
  /** The twin pairing (`bids.twin_source_bid_id`), for a shell whose run the page could not read. */
  twinExistsForBidId: (bidId: string) => boolean
  todayYmd: string
  nowMs: number
}

const RUN_STATUSES: ReadonlySet<string> = new Set(['open', 'locked', 'scored', 'void'])

/** The bid's live run status as the rule reads it: the run row when known, else the pairing as an open run. */
export function robotQueueRunStatus(bid: { id: string; bid_number: string | number | null }, input: Pick<RobotQueueInput, 'shadowRunByBidNumber' | 'twinExistsForBidId'>): ShadowRunStatus | null {
  const num = bid.bid_number == null ? '' : String(bid.bid_number).trim()
  const run = num ? input.shadowRunByBidNumber.get(num) : undefined
  if (run) return RUN_STATUSES.has(run.status) ? (run.status as ShadowRunStatus) : 'open'
  return input.twinExistsForBidId(bid.id) ? 'open' : null
}

export function buildRobotQueue<B extends RobotQueueBidFields>(bids: readonly B[], input: RobotQueueInput): RobotQueue<B> {
  const byId = new Map(bids.map((b) => [b.id, b]))
  return buildShadowQueue(bids, {
    plumbingServiceTypeId: input.plumbingServiceTypeId,
    nowMs: input.nowMs,
    todayYmd: input.todayYmd,
    runStatusFor: (id) => {
      const b = byId.get(id)
      return b ? robotQueueRunStatus(b, input) : null
    },
  })
}

/** The Plumbing service type among the page's types, the division the robots bid; null when the list has none yet. */
export function plumbingServiceTypeIdOf(serviceTypes: ReadonlyArray<{ id: string; name: string | null }>): string | null {
  return serviceTypes.find((s) => /plumbing/i.test(s.name ?? ''))?.id ?? null
}
