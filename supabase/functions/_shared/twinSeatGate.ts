// The twin seat gate — which verbs a twin key may call, and when a held submittal
// task opens a bid's plans. Pure: twin-mcp and plan-fetch load the rows, this decides.
//
// Two seats share one server. A pricer key (users.twin_kind = 'pricer') prices
// supply-house quotes and holds no bids, so it is refused the bid verbs; a bid robot
// (estimator) is refused the pricer's. The shared verbs and the submittal robot's
// four answer to either seat. `get_plan_pages` passes the gate for a pricer only so
// the per-bid fence can decide: a bid's plans open to the twin that owns the bid, or
// to the twin holding a working read_schedule task on it (the office asked it to read
// that bid's fixture schedule) — nothing else.

export type TwinKind = 'estimator' | 'pricer'

export const PRICER_VERBS: ReadonlySet<string> = new Set([
  'get_pricing_guide', 'next_price_matrix', 'get_quote_documents', 'put_quote', 'finish_price_matrix', 'get_component_rules', 'extend_component_rules', 'get_component_corrections',
])
export const SHARED_VERBS: ReadonlySet<string> = new Set(['get_directory', 'get_harness_guide', 'get_answers', 'ask_question', 'heartbeat', 'add_bid_note', 'submit_report'])
/** The submittal robot (v2.3544) — estimator or pricer keys. */
export const SUBMITTAL_VERBS: ReadonlySet<string> = new Set(['get_submittal_guide', 'next_submittal_task', 'put_submittal_result', 'finish_submittal_task'])
/** Bid verbs a pricer reaches only through a held submittal task — the per-bid fence (twinMayReadPlans) decides. */
export const PRICER_TASK_FENCED_VERBS: ReadonlySet<string> = new Set(['get_plan_pages'])

export type SeatGateVerdict = { ok: true } | { ok: false; reason: 'bid_verb' | 'pricer_verb' }

export function seatGate(kind: TwinKind, verb: string): SeatGateVerdict {
  if (kind === 'pricer') {
    if (PRICER_VERBS.has(verb) || SHARED_VERBS.has(verb) || SUBMITTAL_VERBS.has(verb) || PRICER_TASK_FENCED_VERBS.has(verb)) return { ok: true }
    return { ok: false, reason: 'bid_verb' }
  }
  if (PRICER_VERBS.has(verb)) return { ok: false, reason: 'pricer_verb' }
  return { ok: true }
}

/** Every verb a pricer key may call, for the refusal message. */
export function pricerVerbList(): string[] {
  return [...PRICER_VERBS, ...SUBMITTAL_VERBS, ...PRICER_TASK_FENCED_VERBS, ...SHARED_VERBS]
}

export type HeldSubmittalTask = { bid_id: string; kind: string; status: string; claimed_by: string | null }

/** The one task shape that opens plans: read_schedule, working, claimed by this twin, on this bid. */
export function holdsPlanReadingTask(tasks: ReadonlyArray<HeldSubmittalTask>, twinUserId: string, bidId: string): boolean {
  return tasks.some((t) => t.bid_id === bidId && t.claimed_by === twinUserId && t.status === 'working' && t.kind === 'read_schedule')
}

/** The plan-reading fence (get_plan_pages, plan-fetch): the bid is the twin's own/assigned, or it holds the bid's read_schedule task. */
export function twinMayReadPlans(
  twinUserId: string,
  bid: { id: string; created_by: string | null; estimator_id: string | null },
  tasks: ReadonlyArray<HeldSubmittalTask>,
): boolean {
  if (bid.created_by === twinUserId || bid.estimator_id === twinUserId) return true
  return holdsPlanReadingTask(tasks, twinUserId, bid.id)
}
