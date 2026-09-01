/**
 * Backtest candidates for the dev 🤖 Queue lens (v2.2594): which decided
 * historical bids are graded well enough to be practice reps, grouped by the
 * confidence axis whose Gate-B streak they would feed (owner-approved mockup
 * Variant B — grouped by axis, starvation visible).
 *
 * Grade uses field PRESENCE only (referenceGrade.ts blindness split); the
 * quality flags read the sealed value/outcome and are dev-eyes-only — they
 * sort and hide here, and never reach the robot prompt.
 */
import {
  referenceGrade,
  referenceQualityFlags,
  type ReferenceQualityFlags,
} from './referenceGrade'
import { GATE_B_STREAK, type AxisCard } from './confidenceBoard'

export interface BacktestCandidateBidFields {
  id: string
  bid_number: number | string | null
  project_name: string | null
  plans_link: string | null
  bid_value: number | string | null
  outcome: string | null
  loss_category: string | null
  bid_date_sent: string | null
  created_at: string | null
}

export interface BacktestCandidate<B extends BacktestCandidateBidFields> {
  bid: B
  grade: 'A' | 'B'
  flags: ReferenceQualityFlags
}

/**
 * Demand order mirrors where a rep helps most: an axis mid-streak ('open')
 * beats one with no runs at all ('new'), which beats shadows-in-flight
 * ('awaiting'); 'blocked' axes render dimmed (a rep can't help until the
 * audit answer lands) and 'met' gates last.
 */
export type AxisDemand = 'open' | 'new' | 'awaiting' | 'blocked' | 'met'

const DEMAND_RANK: Record<AxisDemand, number> = { open: 0, new: 1, awaiting: 2, blocked: 3, met: 4 }

export interface BacktestAxisGroup<B extends BacktestCandidateBidFields> {
  /** null = the unclassified bucket (no backtest_axis assigned yet). */
  axis: string | null
  demand: AxisDemand | null
  /** Header sub-line — why this group sits where it does. */
  why: string
  eligible: BacktestCandidate<B>[]
  /** Gate-ineligible references (round value / weak loss / uncategorized / stale). */
  flagged: BacktestCandidate<B>[]
}

/** 'B376' / 'b376' / 376 → '376', for matching bids against run-table reference numbers. */
export function normalizeBidNumber(n: number | string | null | undefined): string | null {
  if (n == null) return null
  const s = String(n).trim().replace(/^[bB]/, '')
  return s.length > 0 ? s : null
}

function decidedWhen(bid: BacktestCandidateBidFields): string {
  return bid.bid_date_sent ?? bid.created_at ?? ''
}

function flagBreakdown(flagged: readonly BacktestCandidate<BacktestCandidateBidFields>[]): string {
  const counts: Array<[string, number]> = [
    ['round value', flagged.filter((c) => c.flags.roundValue).length],
    ['weak loss', flagged.filter((c) => c.flags.weakLoss).length],
    ['uncategorized loss', flagged.filter((c) => c.flags.lossUncategorized).length],
    ['stale', flagged.filter((c) => c.flags.stale).length],
  ]
  return counts
    .filter(([, n]) => n > 0)
    .map(([label, n]) => `${n} ${label}`)
    .join(' · ')
}

export function buildBacktestCandidateGroups<B extends BacktestCandidateBidFields>(
  bids: readonly B[],
  opts: {
    /** Reads bids.backtest_axis (untyped until the post-push gen-types run) + any local override. */
    axisOf: (bid: B) => string | null
    presenceOf: (bidId: string) => { hasCounts: boolean; hasPricing: boolean } | null
    /** Normalized bid numbers already used as a reference by any run or shadow. */
    usedReferenceNumbers: ReadonlySet<string>
    /** The Scoreboard's axis cards — the one source of demand truth. */
    axisCards: readonly AxisCard[]
    /** YMD for the staleness flag. */
    todayYmd: string
  },
): BacktestAxisGroup<B>[] {
  const byAxis = new Map<string | null, { eligible: BacktestCandidate<B>[]; flagged: BacktestCandidate<B>[] }>()
  const bucket = (axis: string | null) => {
    let b = byAxis.get(axis)
    if (!b) {
      b = { eligible: [], flagged: [] }
      byAxis.set(axis, b)
    }
    return b
  }

  for (const bid of bids) {
    if (!bid.bid_date_sent && !bid.outcome) continue // undecided — that's the live queue's business
    const num = normalizeBidNumber(bid.bid_number)
    if (num != null && opts.usedReferenceNumbers.has(num)) continue // already a reference
    const presence = opts.presenceOf(bid.id)
    const grade = referenceGrade({
      hasPlans: !!bid.plans_link?.trim(),
      hasValue: bid.bid_value != null && Number(bid.bid_value) > 0,
      hasCounts: presence?.hasCounts ?? false,
      hasPricing: presence?.hasPricing ?? false,
    })
    if (grade !== 'A' && grade !== 'B') continue // C/D teach census reps, not scorecards
    const flags = referenceQualityFlags(
      {
        bid_value: bid.bid_value,
        outcome: bid.outcome,
        loss_category: bid.loss_category,
        when: bid.bid_date_sent ?? bid.created_at,
      },
      opts.todayYmd,
    )
    const candidate: BacktestCandidate<B> = { bid, grade, flags }
    const b = bucket(opts.axisOf(bid))
    ;(flags.gateEligible ? b.eligible : b.flagged).push(candidate)
  }

  const sortCandidates = (list: BacktestCandidate<B>[]) =>
    list.sort((a, b) => (a.grade !== b.grade ? (a.grade === 'A' ? -1 : 1) : decidedWhen(b.bid).localeCompare(decidedWhen(a.bid))))

  const cardByAxis = new Map(opts.axisCards.map((c) => [c.axis, c]))
  const axes = new Set<string>([...cardByAxis.keys()])
  for (const axis of byAxis.keys()) if (axis != null) axes.add(axis)

  const groups: BacktestAxisGroup<B>[] = []
  for (const axis of axes) {
    const card = cardByAxis.get(axis)
    const b = byAxis.get(axis) ?? { eligible: [], flagged: [] }
    let demand: AxisDemand
    let why: string
    if (!card) {
      demand = 'new'
      why = `no runs yet — first ${GATE_B_STREAK} reps build the gate`
    } else if (card.chip.tone === 'met') {
      demand = 'met'
      why = 'gate B met — hold the streak'
    } else if (card.chip.tone === 'blocked') {
      demand = 'blocked'
      why = `blocked — ${card.nextLine}`
    } else if (card.chip.tone === 'awaiting') {
      demand = 'awaiting'
      why = 'shadow in flight — practice reps still useful'
    } else {
      demand = 'open'
      why = `needs ${GATE_B_STREAK - card.streak} more in-band · gate B at ${card.streak}/${GATE_B_STREAK}`
    }
    groups.push({ axis, demand, why, eligible: sortCandidates(b.eligible), flagged: sortCandidates(b.flagged) })
  }

  groups.sort((a, b) => {
    const rank = DEMAND_RANK[a.demand as AxisDemand] - DEMAND_RANK[b.demand as AxisDemand]
    if (rank !== 0) return rank
    const streakA = cardByAxis.get(a.axis ?? '')?.streak ?? 0
    const streakB = cardByAxis.get(b.axis ?? '')?.streak ?? 0
    if (streakA !== streakB) return streakB - streakA // closest to gate first
    return (a.axis ?? '').localeCompare(b.axis ?? '')
  })

  // Unclassified bucket renders last, and only when it holds something.
  const un = byAxis.get(null)
  if (un && (un.eligible.length > 0 || un.flagged.length > 0)) {
    groups.push({
      axis: null,
      demand: null,
      why: 'axis unknown until someone assigns one',
      eligible: sortCandidates(un.eligible),
      flagged: sortCandidates(un.flagged),
    })
  }

  return groups
}

/** The starvation-card sentence for a group with flagged refs and nothing eligible. */
export function starvationLine<B extends BacktestCandidateBidFields>(group: BacktestAxisGroup<B>): string {
  if (group.eligible.length > 0) return ''
  if (group.flagged.length === 0)
    return 'No graded references recorded for this axis — the next rep comes from bidding (or grading) more of these.'
  const n = group.flagged.length
  return `No eligible references left — ${n} exist${n === 1 ? 's' : ''} but ${n === 1 ? 'it is' : 'all are'} flagged (${flagBreakdown(group.flagged)}). The next rep for this axis comes from repairing history, not from running it.`
}

/**
 * The copy-into-an-LLM backtest kickoff — buildRobotBidPrompt's sibling.
 * Logistics only: bid number + axis. The value/outcome the dev can see on
 * this row NEVER enters the prompt (open_backtest keeps the seal).
 */
export function buildBacktestPrompt(bid: BacktestCandidateBidFields, axis: string | null): string {
  const num = bid.bid_number ? `b${normalizeBidNumber(bid.bid_number)}` : 'this bid'
  const name = bid.project_name?.trim() || 'the project'
  const axisLine = axis ? ` on the ${axis} axis` : ' (axis unassigned — pick one with the operator before scoring)'
  return `You are the ClickTooling estimator twin. Run a BLIND BACKTEST for reference ${num} (${name})${axisLine}.

1. get_brief, then open_backtest for ${num} — it returns the blind-safe reference grade and stages the run.
2. Run the full pipeline per the harness guides on the plan set alone: substrate + census, CountTooling takeoff, counts + pricing on the robot price book, stage notes on the ledger.
3. BLIND RULE: never open the human bid's counts, pricing, value, or outcome — the scorecard unseals them only after you lock your total. If an input is missing, ask via add_bid_note instead of guessing.
4. Lock your total, then file the audit so a human can score the run.`
}
