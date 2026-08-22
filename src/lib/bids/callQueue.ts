/**
 * The Call queue (v2.2105) — the Followup one-queue view. Groups a trade's
 * bids by builder and computes each builder's "collect list": what one call
 * can gather (chases, missing loss reasons, gettable bid tabs) beside what's
 * already collected. Builders with work first, oldest contact first inside
 * each band.
 *
 * Sibling of `builderCallSession.ts` / `callQueueOrdering.ts`. Pure module —
 * no React, no Supabase; callers pass `nowIso` so tests stay deterministic.
 */

import { bidNeedsChase } from '../bidPendingChase'
import { isBidLossCategoryKey } from '../bidLossCategories'

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
}

export type CallQueueBuilder = {
  builderKey: string
  builderName: string
  phone: string | null
  stats: { won: number; lost: number; pending: number; hitRatePct: number | null; pendingValue: number }
  chase: { todo: CallQueueBid[]; freshCount: number; oldestQuietDays: number | null }
  reasons: { todo: CallQueueBid[]; dollars: number; recordedCount: number }
  tabs: { todo: CallQueueBid[]; recordedCount: number }
  hasWork: boolean
  /** Oldest last-contact instant across open bids (ms); -Infinity when never contacted. */
  oldestContactMs: number
}

export type CallQueueTotals = {
  buildersWithWork: number
  chaseCount: number
  reasonsCount: number
  reasonsDollars: number
  tabsCount: number
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

export function buildCallQueue(bids: readonly CallQueueBid[], nowIso: string): { builders: CallQueueBuilder[]; totals: CallQueueTotals } {
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

    const chaseTodo = pendingBids.filter((b) => bidNeedsChase({ sentIso: b.sentIso ?? '', lastContactIso: b.lastContactIso }, nowIso))
    const reasonsTodo = lostBids.filter(bidNeedsReason)
    const tabsTodo = list.filter((b) => bidTabGettable(b, nowIso))
    const decided = won + lostBids.length

    let oldestQuietDays: number | null = null
    for (const b of chaseTodo) {
      const since = b.lastContactIso ?? b.sentIso
      const d = since ? daysBetween(since, nowIso) : null
      if (d != null && (oldestQuietDays == null || d > oldestQuietDays)) oldestQuietDays = d
    }

    let oldestContactMs = Infinity
    for (const b of [...pendingBids, ...lostBids]) {
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
      chase: { todo: chaseTodo, freshCount: pendingBids.length - chaseTodo.length, oldestQuietDays },
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

  builders.sort((a, b) => {
    if (a.hasWork !== b.hasWork) return a.hasWork ? -1 : 1
    if (a.oldestContactMs !== b.oldestContactMs) return a.oldestContactMs - b.oldestContactMs
    return a.builderName.localeCompare(b.builderName)
  })

  const withWork = builders.filter((b) => b.hasWork)
  return {
    builders,
    totals: {
      buildersWithWork: withWork.length,
      chaseCount: builders.reduce((s, b) => s + b.chase.todo.length, 0),
      reasonsCount: builders.reduce((s, b) => s + b.reasons.todo.length, 0),
      reasonsDollars: builders.reduce((s, b) => s + b.reasons.dollars, 0),
      tabsCount: builders.reduce((s, b) => s + b.tabs.todo.length, 0),
    },
  }
}
