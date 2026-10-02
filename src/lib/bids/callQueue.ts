/**
 * The Call queue (v2.2105) — the Followup one-queue view. Groups a trade's
 * bids by builder and computes each builder's "collect list": what one call
 * can gather (chases, missing loss reasons, gettable bid tabs) beside what's
 * already collected. A promised call comes first: builders with an overdue
 * day, then a day that is today (v2.4420, `bidNextFollowup.ts`); then builders
 * with other work, oldest contact first inside each band. A bid parked on a
 * day still ahead is out of the way until that day.
 *
 * Sibling of `builderCallSession.ts` / `callQueueOrdering.ts`. Pure module —
 * no React, no Supabase; callers pass `nowIso` so tests stay deterministic.
 */

import { isBidLossCategoryKey } from '../bidLossCategories'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { followupNeedsCall, resolveBidFollowup, type BidFollowup } from './bidNextFollowup'

/** A pending bid becomes "tab gettable" this many days after sending (tabs take a while to exist). */
export const TAB_GETTABLE_AFTER_DAYS = 21

export type CallQueueOutcome = 'pending' | 'won' | 'lost' | 'unsent'

/** One bid as the queue sees it; the tab maps BidWithBuilder rows into this. */
export type CallQueueBid = {
  id: string
  builderKey: string
  builderName: string
  phone: string | null
  value: number
  outcome: CallQueueOutcome
  /** `bids.bid_date_sent` (YYYY-MM-DD); null = unsent. */
  sentIso: string | null
  /** Effective last contact (bid stamp / latest entry), null = never. */
  lastContactIso: string | null
  /** `bids.loss_category` — a recorded reason clears the reasons row. */
  lossCategory: string | null
  hasTab: boolean
  /** `bids.next_followup_on`: the bid's own call-again day (v2.4420); absent/null = none. */
  nextFollowupYmd?: string | null
}

/** The most pressing thing a builder's open bids ask for today. */
export type CallQueueDueState = 'overdue' | 'due' | 'none'

export type CallQueueBuilder = {
  builderKey: string
  builderName: string
  phone: string | null
  stats: { won: number; lost: number; pending: number; hitRatePct: number | null; pendingValue: number }
  /**
   * `todo`: bids to call today (an overdue day, a day that is today, or no day and gone quiet), most
   * pressing first. `later`: bids parked on a day still ahead, soonest first.
   */
  chase: { todo: CallQueueBid[]; later: CallQueueBid[]; freshCount: number; oldestQuietDays: number | null }
  /** The most pressing state in `chase.todo`, and its earliest promised day; null when nothing is to chase. */
  due: { state: CallQueueDueState; earliestYmd: string | null } | null
  reasons: { todo: CallQueueBid[]; dollars: number; recordedCount: number }
  tabs: { todo: CallQueueBid[]; recordedCount: number }
  hasWork: boolean
  /** Oldest last-contact instant across open bids (ms); -Infinity when never contacted. */
  oldestContactMs: number
}

export type CallQueueTotals = {
  buildersWithWork: number
  /** Distinct BIDS needing a chase (Tier-2 #20: the unit is the bid — a bid quiet under two GCs is one bid to chase). */
  chaseCount: number
  /** Per-GC chase rows behind `chaseCount` (the sub-count the header prints as "· N GC packets"). */
  chasePacketRows: number
  /** Distinct BIDS lost with no reason recorded. */
  reasonsCount: number
  /** Per-GC loss rows behind `reasonsCount`. */
  reasonsPacketRows: number
  reasonsDollars: number
  tabsCount: number
  /** Distinct BIDS by where they stand (v2.4420). `dueCount` + `overdueCount` + `noDateCount` = `chaseCount`. */
  dueCount: number
  overdueCount: number
  noDateCount: number
  laterCount: number
  /** Dollars pending on the parked bids, each bid once. */
  laterValue: number
}

export type CallQueueOptions = {
  /** Today's civil day in the app's time zone; derived from `nowIso` when absent. */
  todayYmd?: string
  /** The builder's own call-again day by `builderKey` (`builderFollowupYmd`). */
  builderNextYmdByKey?: Readonly<Record<string, string | null | undefined>>
}

export function classifyCallQueueOutcome(bid: { outcome: string | null; bid_date_sent: string | null }): CallQueueOutcome {
  if (bid.outcome === 'won' || bid.outcome === 'started_or_complete') return 'won'
  if (bid.outcome === 'lost') return 'lost'
  return bid.bid_date_sent ? 'pending' : 'unsent'
}

function daysBetween(fromIso: string, toIso: string): number | null {
  const from = Date.parse(fromIso)
  const to = Date.parse(toIso)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  return Math.floor((to - from) / 86_400_000)
}

/** Lost without a structured reason. */
export function bidNeedsReason(b: Pick<CallQueueBid, 'outcome' | 'lossCategory'>): boolean {
  return b.outcome === 'lost' && !isBidLossCategoryKey(b.lossCategory)
}

/** Tab worth asking for: any lost bid without one, or a pending bid sent long enough ago. */
export function bidTabGettable(b: Pick<CallQueueBid, 'outcome' | 'hasTab' | 'sentIso'>, nowIso: string): boolean {
  if (b.hasTab) return false
  if (b.outcome === 'lost') return true
  if (b.outcome !== 'pending' || !b.sentIso) return false
  const age = daysBetween(b.sentIso, nowIso)
  return age != null && age >= TAB_GETTABLE_AFTER_DAYS
}

/**
 * Queue order: a promise first (an overdue day, earliest first; then a day that
 * is today); then builders with work; oldest contact first; and among the
 * never-contacted (all `-Infinity`, which with the chase barely used was 91 of
 * 101 builders) the one who has been quiet longest — `chase.oldestQuietDays`,
 * days since the oldest chase-worthy send — comes first (J14-F4). The copy
 * promises "whoever has waited longest on top"; before this the visible order
 * inside that band was the alphabet. Name is the last resort only.
 */
type ComparableBuilder = Pick<CallQueueBuilder, 'hasWork' | 'oldestContactMs' | 'builderName'> & {
  chase: Pick<CallQueueBuilder['chase'], 'oldestQuietDays'>
  due?: CallQueueBuilder['due']
}

function promiseBand(b: ComparableBuilder): number {
  return b.due?.state === 'overdue' ? 0 : b.due?.state === 'due' ? 1 : 2
}

export function compareCallQueueBuilders(a: ComparableBuilder, b: ComparableBuilder): number {
  const bandA = promiseBand(a)
  const bandB = promiseBand(b)
  if (bandA !== bandB) return bandA - bandB
  if (bandA === 0) {
    const ay = a.due?.earliestYmd ?? ''
    const by = b.due?.earliestYmd ?? ''
    if (ay !== by) return ay < by ? -1 : 1
  }
  if (a.hasWork !== b.hasWork) return a.hasWork ? -1 : 1
  if (a.oldestContactMs !== b.oldestContactMs) return a.oldestContactMs - b.oldestContactMs
  const aq = a.chase.oldestQuietDays ?? -1
  const bq = b.chase.oldestQuietDays ?? -1
  if (aq !== bq) return bq - aq
  return a.builderName.localeCompare(b.builderName)
}

const STATE_RANK: Record<BidFollowup['state'], number> = { overdue: 0, due: 1, none: 2, later: 3, fresh: 4 }

export function buildCallQueue(
  bids: readonly CallQueueBid[],
  nowIso: string,
  options: CallQueueOptions = {},
): { builders: CallQueueBuilder[]; totals: CallQueueTotals; followupByBid: Map<CallQueueBid, BidFollowup> } {
  const todayYmd = options.todayYmd ?? calendarYmdInAppTzFromIso(nowIso)
  const followupByBid = new Map<CallQueueBid, BidFollowup>()
  const byKey = new Map<string, CallQueueBid[]>()
  for (const b of bids) {
    const list = byKey.get(b.builderKey)
    if (list) list.push(b)
    else byKey.set(b.builderKey, [b])
  }

  const builders: CallQueueBuilder[] = []
  for (const [builderKey, list] of byKey) {
    const won = list.filter((b) => b.outcome === 'won').length
    const lostBids = list.filter((b) => b.outcome === 'lost')
    const pendingBids = list.filter((b) => b.outcome === 'pending')
    if (won === 0 && lostBids.length === 0 && pendingBids.length === 0) continue // nothing decided or in flight — quiet builders stay off the queue

    const builderNextYmd = options.builderNextYmdByKey?.[builderKey] ?? null
    for (const b of pendingBids) {
      followupByBid.set(b, resolveBidFollowup({ sentIso: b.sentIso, lastContactIso: b.lastContactIso, bidNextYmd: b.nextFollowupYmd ?? null, builderNextYmd }, todayYmd, nowIso))
    }
    const stateOf = (b: CallQueueBid) => followupByBid.get(b)!
    // Most pressing first: an overdue day (earliest first), a day that is today, then the quiet ones as they came.
    const chaseTodo = pendingBids
      .filter((b) => followupNeedsCall(stateOf(b)))
      .map((b, i) => ({ b, i }))
      .sort((x, y) => {
        const fx = stateOf(x.b)
        const fy = stateOf(y.b)
        if (fx.state !== fy.state) return STATE_RANK[fx.state] - STATE_RANK[fy.state]
        if (fx.state === 'overdue' && fx.dueYmd !== fy.dueYmd) return (fx.dueYmd ?? '') < (fy.dueYmd ?? '') ? -1 : 1
        return x.i - y.i
      })
      .map((x) => x.b)
    const chaseLater = pendingBids
      .filter((b) => stateOf(b).state === 'later')
      .sort((x, y) => ((stateOf(x).dueYmd ?? '') < (stateOf(y).dueYmd ?? '') ? -1 : (stateOf(x).dueYmd ?? '') > (stateOf(y).dueYmd ?? '') ? 1 : 0))
    const parked = new Set(chaseLater)
    const reasonsTodo = lostBids.filter(bidNeedsReason)
    // A parked bid is out of the way until its day: its tab is not asked for either.
    const tabsTodo = list.filter((b) => !parked.has(b) && bidTabGettable(b, nowIso))
    const decided = won + lostBids.length

    let oldestQuietDays: number | null = null
    for (const b of chaseTodo) {
      // "Quiet" is for bids nobody promised a day: a promise reads by its day, not by the silence.
      if (stateOf(b).state !== 'none') continue
      const since = b.lastContactIso ?? b.sentIso
      const d = since ? daysBetween(since, nowIso) : null
      if (d != null && (oldestQuietDays == null || d > oldestQuietDays)) oldestQuietDays = d
    }

    // Only OPEN bids' contacts rank a builder (J14-F4): a lost bid's ancient
    // note used to pull its builder ahead of one never called at all.
    let oldestContactMs = Infinity
    for (const b of pendingBids) {
      if (parked.has(b)) continue
      const ms = b.lastContactIso ? Date.parse(b.lastContactIso) : -Infinity
      if (ms < oldestContactMs) oldestContactMs = ms
    }

    builders.push({
      builderKey,
      builderName: list[0]!.builderName,
      phone: list.find((b) => b.phone)?.phone ?? null,
      stats: {
        won,
        lost: lostBids.length,
        pending: pendingBids.length,
        hitRatePct: decided > 0 ? Math.round((won / decided) * 100) : null,
        pendingValue: pendingBids.reduce((s, b) => s + (Number.isFinite(b.value) ? b.value : 0), 0),
      },
      chase: { todo: chaseTodo, later: chaseLater, freshCount: pendingBids.length - chaseTodo.length - chaseLater.length, oldestQuietDays },
      due: chaseTodo.length === 0
        ? null
        : {
            state: stateOf(chaseTodo[0]!).state as CallQueueDueState,
            earliestYmd: stateOf(chaseTodo[0]!).state === 'none' ? null : stateOf(chaseTodo[0]!).dueYmd,
          },
      reasons: {
        todo: reasonsTodo,
        dollars: reasonsTodo.reduce((s, b) => s + (Number.isFinite(b.value) ? b.value : 0), 0),
        recordedCount: lostBids.length - reasonsTodo.length,
      },
      tabs: { todo: tabsTodo, recordedCount: list.filter((b) => b.hasTab).length },
      hasWork: chaseTodo.length + reasonsTodo.length + tabsTodo.length > 0,
      oldestContactMs: oldestContactMs === Infinity ? -Infinity : oldestContactMs,
    })
  }

  builders.sort(compareCallQueueBuilders)

  const withWork = builders.filter((b) => b.hasWork)
  // Headline totals count BIDS (one per `id`); the per-GC rows stay as the secondary figure.
  const chaseRows = builders.flatMap((b) => b.chase.todo)
  const reasonRows = builders.flatMap((b) => b.reasons.todo)
  const laterRows = builders.flatMap((b) => b.chase.later)
  const idsIn = (state: BidFollowup['state']) => new Set(chaseRows.filter((b) => followupByBid.get(b)?.state === state).map((b) => b.id)).size
  const laterById = new Map<string, number>()
  for (const b of laterRows) laterById.set(b.id, Math.max(laterById.get(b.id) ?? 0, Number.isFinite(b.value) ? b.value : 0))
  return {
    builders,
    followupByBid,
    totals: {
      buildersWithWork: withWork.length,
      chaseCount: new Set(chaseRows.map((b) => b.id)).size,
      chasePacketRows: chaseRows.length,
      reasonsCount: new Set(reasonRows.map((b) => b.id)).size,
      reasonsPacketRows: reasonRows.length,
      reasonsDollars: builders.reduce((s, b) => s + b.reasons.dollars, 0),
      tabsCount: builders.reduce((s, b) => s + b.tabs.todo.length, 0),
      dueCount: idsIn('due'),
      overdueCount: idsIn('overdue'),
      noDateCount: idsIn('none'),
      laterCount: laterById.size,
      laterValue: Array.from(laterById.values()).reduce((s, v) => s + v, 0),
    },
  }
}
