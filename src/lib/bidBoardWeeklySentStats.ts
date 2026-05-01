import type { BidWithBuilder } from '../types/bidWithBuilder'
import {
  calendarYmdInAppTzFromIso,
  companyWeekStartSundayContaining,
  ymdAddDays,
} from '../utils/dateUtils'

export type BidBoardWeekEstimatorRow = {
  /** `estimator_id` or `__unassigned__` */
  estimatorKey: string
  displayName: string
  sentCount: number
  sentDollars: number
  /** Bids in this estimator-week cell, in first-seen order from `buildBidBoardWeeklySentSummaries` input. */
  bidIds: string[]
}

export type BidBoardWeekSentSummary = {
  weekStart: string
  weekEnd: string
  won: number
  lost: number
  haventHeardBack: number
  estimatorRows: BidBoardWeekEstimatorRow[]
}

export const BID_BOARD_WEEKLY_SENT_DEFAULT_MAX_WEEKS = 26

const UNASSIGNED_KEY = '__unassigned__'

export type BidBoardWeeklySentPivotCell = {
  sentCount: number
  sentDollars: number
  bidIds: string[]
}

export type BidBoardWeeklySentPivotRow = {
  estimatorKey: string
  displayName: string
  /** Keyed by `weekStart` (YYYY-MM-DD); every column week has an entry. */
  byWeek: Record<string, BidBoardWeeklySentPivotCell>
}

export type BidBoardWeeklySentPivot = {
  weeks: BidBoardWeekSentSummary[]
  rows: BidBoardWeeklySentPivotRow[]
}

function mergePivotDisplayName(prev: string, next: string): string {
  if (next !== '—' && next.trim() !== '') return next
  return prev
}

type WeeklySentInputBid = Pick<
  BidWithBuilder,
  'id' | 'bid_date_sent' | 'bid_value' | 'outcome' | 'estimator_id' | 'estimator'
>

function classifySentBidOutcome(outcome: string | null): 'won' | 'lost' | 'haventHeardBack' {
  const o = outcome
  if (o === 'won' || o === 'started_or_complete') return 'won'
  if (o === 'lost') return 'lost'
  return 'haventHeardBack'
}

function estimatorRowKeyAndName(bid: WeeklySentInputBid): { key: string; displayName: string } {
  if (!bid.estimator_id) {
    return { key: UNASSIGNED_KEY, displayName: 'Unassigned' }
  }
  const u = bid.estimator
  if (u == null) {
    return { key: bid.estimator_id, displayName: '—' }
  }
  const one = Array.isArray(u) ? u[0] ?? null : u
  if (!one) {
    return { key: bid.estimator_id, displayName: '—' }
  }
  const name = (one.name?.trim() || one.email || '—').slice(0, 200)
  return { key: bid.estimator_id, displayName: name }
}

type WeekBucket = {
  won: number
  lost: number
  haventHeardBack: number
  byEstimator: Map<
    string,
    { displayName: string; sentCount: number; sentDollars: number; bidIds: string[] }
  >
}

function sortEstimatorRows(rows: BidBoardWeekEstimatorRow[]): BidBoardWeekEstimatorRow[] {
  return [...rows].sort((a, b) => {
    const aUn = a.estimatorKey === UNASSIGNED_KEY ? 1 : 0
    const bUn = b.estimatorKey === UNASSIGNED_KEY ? 1 : 0
    if (aUn !== bUn) return aUn - bUn
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
  })
}

/**
 * Buckets sent bids (`bid_date_sent` set) by Chicago Sunday-start week and estimator.
 * Outcomes match Bid Board / Scoreboard: Won includes `started_or_complete`; "haven't heard back" is sent and not won/lost/started_or_complete.
 */
export function buildBidBoardWeeklySentSummaries(
  bids: WeeklySentInputBid[],
  options?: { maxWeeks?: number }
): BidBoardWeekSentSummary[] {
  const maxWeeks = options?.maxWeeks ?? BID_BOARD_WEEKLY_SENT_DEFAULT_MAX_WEEKS
  const byWeek = new Map<string, WeekBucket>()

  for (const bid of bids) {
    if (!bid.bid_date_sent) continue
    const sentYmd = calendarYmdInAppTzFromIso(bid.bid_date_sent)
    if (!sentYmd) continue
    const weekStart = companyWeekStartSundayContaining(sentYmd)
    if (!weekStart) continue

    let bucket = byWeek.get(weekStart)
    if (!bucket) {
      bucket = {
        won: 0,
        lost: 0,
        haventHeardBack: 0,
        byEstimator: new Map(),
      }
      byWeek.set(weekStart, bucket)
    }

    const outcome = classifySentBidOutcome(bid.outcome)
    if (outcome === 'won') bucket.won += 1
    else if (outcome === 'lost') bucket.lost += 1
    else bucket.haventHeardBack += 1

    const { key, displayName } = estimatorRowKeyAndName(bid)
    const dollars = bid.bid_value ?? 0
    let est = bucket.byEstimator.get(key)
    if (!est) {
      est = { displayName, sentCount: 0, sentDollars: 0, bidIds: [] }
      bucket.byEstimator.set(key, est)
    }
    est.sentCount += 1
    est.sentDollars += dollars
    est.bidIds.push(bid.id)
    if (displayName !== '—') est.displayName = displayName
  }

  const weekStarts = [...byWeek.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
  const capped = maxWeeks > 0 ? weekStarts.slice(0, maxWeeks) : weekStarts

  return capped.map((weekStart) => {
    const b = byWeek.get(weekStart)!
    const weekEnd = ymdAddDays(weekStart, 6)
    const estimatorRows: BidBoardWeekEstimatorRow[] = sortEstimatorRows(
      [...b.byEstimator.entries()].map(([estimatorKey, v]) => ({
        estimatorKey,
        displayName: v.displayName,
        sentCount: v.sentCount,
        sentDollars: v.sentDollars,
        bidIds: v.bidIds,
      }))
    )
    return {
      weekStart,
      weekEnd,
      won: b.won,
      lost: b.lost,
      haventHeardBack: b.haventHeardBack,
      estimatorRows,
    }
  })
}

/**
 * One row per estimator (union across weeks), one column per week; cells default to 0 sent / $0 when absent.
 * Week column order matches `weeks` (newest first from {@link buildBidBoardWeeklySentSummaries}).
 */
export function buildBidBoardWeeklySentPivot(weeks: BidBoardWeekSentSummary[]): BidBoardWeeklySentPivot {
  if (weeks.length === 0) {
    return { weeks: [], rows: [] }
  }

  const weekStarts = weeks.map((w) => w.weekStart)
  const nameByKey = new Map<string, string>()
  for (const w of weeks) {
    for (const r of w.estimatorRows) {
      const prev = nameByKey.get(r.estimatorKey) ?? '—'
      nameByKey.set(r.estimatorKey, mergePivotDisplayName(prev, r.displayName))
    }
  }

  const placeholderRows: BidBoardWeekEstimatorRow[] = sortEstimatorRows(
    [...nameByKey.keys()].map((estimatorKey) => ({
      estimatorKey,
      displayName: nameByKey.get(estimatorKey) ?? '—',
      sentCount: 0,
      sentDollars: 0,
      bidIds: [],
    }))
  )

  const byWeekLookup = new Map<string, Map<string, BidBoardWeeklySentPivotCell>>()
  for (const ws of weekStarts) {
    byWeekLookup.set(ws, new Map())
  }
  for (const w of weeks) {
    const m = byWeekLookup.get(w.weekStart)!
    for (const r of w.estimatorRows) {
      m.set(r.estimatorKey, {
        sentCount: r.sentCount,
        sentDollars: r.sentDollars,
        bidIds: r.bidIds,
      })
    }
  }

  const rows: BidBoardWeeklySentPivotRow[] = placeholderRows.map((p) => {
    const byWeek: Record<string, BidBoardWeeklySentPivotCell> = {}
    for (const ws of weekStarts) {
      const cell = byWeekLookup.get(ws)?.get(p.estimatorKey)
      byWeek[ws] = cell ?? { sentCount: 0, sentDollars: 0, bidIds: [] }
    }
    return {
      estimatorKey: p.estimatorKey,
      displayName: nameByKey.get(p.estimatorKey) ?? p.displayName,
      byWeek,
    }
  })

  return { weeks, rows }
}
