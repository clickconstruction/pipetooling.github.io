/**
 * Cost to win — the economics behind the pursuit ledger (Bids → Bid Costs,
 * the Cost to win lens). One row per estimator or per GC over the rows the
 * window admits: how many bids, how many carry clocked time, the hours and
 * dollars spent, what those bids won and lost, and pursuit dollars per $1,000
 * won. Pure; the ledger's rows (`bidPursuit.ts`) are the only input.
 *
 * Counts and values read EVERY bid in the group — a bid nobody clocked still
 * won or lost — while hours and spend read only the bids that carry time.
 * That keeps the hit rate honest when the clock is young (clocking against
 * bids began 2026-03-20; won work from before then has no pursuit time).
 */
import type { PursuitRow } from './bidPursuit'

export type CostToWinRow = {
  key: string
  label: string
  /** Every bid in the group (in the window). */
  bids: number
  bidsWithTime: number
  hours: number
  usd: number
  won: number
  lost: number
  open: number
  unsent: number
  wonValue: number
  lostValue: number
  /** won ÷ (won + lost) by value; null before anything decided. */
  hitRateByValue: number | null
  /** Pursuit dollars per $1,000 of value won; null until something is won. */
  usdPerThousandWon: number | null
}

export type CostToWinGroup = 'estimator' | 'gc'
export const COST_TO_WIN_GROUP_LABELS: Record<CostToWinGroup, string> = { estimator: 'By estimator', gc: 'By GC' }

const empty = (key: string, label: string): CostToWinRow => ({ key, label, bids: 0, bidsWithTime: 0, hours: 0, usd: 0, won: 0, lost: 0, open: 0, unsent: 0, wonValue: 0, lostValue: 0, hitRateByValue: null, usdPerThousandWon: null })

function finish(r: CostToWinRow): CostToWinRow {
  const decided = r.wonValue + r.lostValue
  r.hitRateByValue = decided > 0 ? r.wonValue / decided : null
  r.usdPerThousandWon = r.wonValue > 0 && r.usd > 0 ? r.usd / (r.wonValue / 1000) : null
  return r
}

function fold(into: CostToWinRow, r: PursuitRow): void {
  into.bids++
  if (r.totalUsd > 0 || r.hours > 0) {
    into.bidsWithTime++
    into.hours += r.hours
    into.usd += r.totalUsd
  }
  into[r.outcome]++
  if (r.outcome === 'won') into.wonValue += r.bidValue ?? 0
  else if (r.outcome === 'lost') into.lostValue += r.bidValue ?? 0
}

/** Groups by the key; rows sort by spend, then hours, then bids, then label. */
export function costToWinBy(rows: ReadonlyArray<PursuitRow>, keyOf: (r: PursuitRow) => string, labelOf: (key: string) => string): CostToWinRow[] {
  const m = new Map<string, CostToWinRow>()
  for (const r of rows) {
    const key = keyOf(r)
    let cur = m.get(key)
    if (!cur) {
      cur = empty(key, labelOf(key))
      m.set(key, cur)
    }
    fold(cur, r)
  }
  return [...m.values()].map(finish).sort((a, b) => b.usd - a.usd || b.hours - a.hours || b.bids - a.bids || a.label.localeCompare(b.label))
}

export const costToWinByEstimator = (rows: ReadonlyArray<PursuitRow>): CostToWinRow[] => costToWinBy(rows, (r) => r.estimatorName ?? '', (k) => k || 'No estimator')
export const costToWinByGc = (rows: ReadonlyArray<PursuitRow>): CostToWinRow[] => costToWinBy(rows, (r) => r.gcName ?? '', (k) => k || 'No GC')

/** The "Everyone" footer: the same fold over every row. */
export function costToWinTotal(rows: ReadonlyArray<PursuitRow>): CostToWinRow {
  const t = empty('', 'Everyone')
  for (const r of rows) fold(t, r)
  return finish(t)
}

export function costToWinRows(rows: ReadonlyArray<PursuitRow>, group: CostToWinGroup): CostToWinRow[] {
  return group === 'estimator' ? costToWinByEstimator(rows) : costToWinByGc(rows)
}

/** "$44.8 per $1k won" reads better as a bare ratio in the column; this words the tile. */
export function costToWinWords(t: CostToWinRow): string {
  if (t.wonValue <= 0) return t.usd > 0 ? 'nothing won yet in this window' : 'no pursuit time in this window'
  if (t.usdPerThousandWon == null) return 'won without clocked time'
  return `$${t.usdPerThousandWon.toFixed(2)} spent per $1k won`
}
