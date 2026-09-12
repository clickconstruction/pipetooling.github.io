/**
 * Pursuit cost — what it costs us to bid (Bids → Bid Costs, the Pursuit
 * ledger, v2.3336). Pure: the tab hands in the bids, the clocked team labor
 * per bid (`loadTeamLaborDataForBids`) and the costs migrated onto bids
 * (`bidAssignedCostsByBidId`); this file turns them into rows, filters them,
 * and sums the summary the tab shows.
 *
 * Words the tab uses:
 *   outcome   unsent · open · won (won + started_or_complete) · lost — the
 *             same buckets the Bid Board draws, folded to four.
 *   window    90 d · year · all — on the bid's sent date, else its created
 *             date. The clocked time itself has no per-day shape here, so the
 *             window says which bids, not which days.
 *   robot     a bid named "ZZ Twin …" or "ZZ Shadow …" — the estimator twins'
 *             work. Folded by default; a checkbox shows them.
 */
import type { BidWithBuilder, EstimatorUser } from '../../types/bidWithBuilder'
import type { BidAssignedCosts } from './bidAssignedCosts'
import { decimalHoursToHhMm } from '../format'

/** Who opens the tab: the office roles. Dollars (wages) stay with dev, master and controller; the rest read hours. */
export const canSeeBidCosts = (role: string | null | undefined): boolean =>
  role === 'dev' || role === 'master_technician' || role === 'controller' || role === 'assistant' || role === 'estimator'
export const canSeeBidCostDollars = (role: string | null | undefined): boolean => role === 'dev' || role === 'master_technician' || role === 'controller'

export type PursuitOutcome = 'unsent' | 'open' | 'won' | 'lost'
export const PURSUIT_OUTCOMES: ReadonlyArray<PursuitOutcome> = ['open', 'won', 'lost', 'unsent']
export const PURSUIT_OUTCOME_LABELS: Record<PursuitOutcome, string> = { unsent: 'Unsent', open: 'Open', won: 'Won', lost: 'Lost' }

export type PursuitWindow = '90d' | 'year' | 'all'
export const PURSUIT_WINDOWS: ReadonlyArray<{ key: PursuitWindow; label: string; days: number | null }> = [
  { key: '90d', label: '90 d', days: 90 },
  { key: 'year', label: 'Year', days: 365 },
  { key: 'all', label: 'All', days: null },
]
/** The window as a phrase for headings — "Spent bidding by estimator · last 12 months" (v2.3352). */
export const PURSUIT_WINDOW_WORDS: Record<PursuitWindow, string> = { '90d': 'last 90 days', year: 'last 12 months', all: 'all time' }

/** The slice of a bid row the ledger reads — narrow so tests stay small. */
export type PursuitBidInput = Pick<BidWithBuilder, 'id' | 'bid_number' | 'project_name' | 'outcome' | 'bid_date_sent' | 'created_at' | 'bid_value' | 'agreed_value' | 'working_board_archived_at'> & {
  /** v2.3354 — the day the outcome was set; older rows may lack it. */
  outcome_at?: string | null
  estimator?: EstimatorUser | EstimatorUser[] | null
  customers?: { name: string | null } | null
  bids_gc_builders?: { name: string | null } | null
}

export type PursuitLabor = { manHours: number; bidCost: number; breakdown: ReadonlyArray<{ personName: string; hours: number }> }

export type PursuitRow = {
  bidId: string
  /** "B148 MPH STAGE" — bid number when it has one, then the project. */
  label: string
  projectName: string
  bidNumber: string | null
  estimatorName: string | null
  gcName: string | null
  outcome: PursuitOutcome
  /** The bid's sent date, else the day it was created (YYYY-MM-DD). */
  dateYmd: string | null
  /** The sent date alone (YYYY-MM-DD); null when never sent. */
  sentYmd: string | null
  /** The day the outcome was set (YYYY-MM-DD, v2.3354); null while pending or for older decisions. */
  outcomeAtYmd: string | null
  robot: boolean
  hours: number
  laborUsd: number
  /** Card charges + supply splits + tally parts moved onto the bid (v2.1165), as spend (positive). */
  cardUsd: number
  materialsUsd: number
  totalUsd: number
  /** Agreed value when set, else the bid value; null when neither. */
  bidValue: number | null
  /** Pursuit dollars per $1,000 of bid value; null without a value. */
  usdPerThousandBid: number | null
  people: Array<{ name: string; hours: number }>
}

const num = (v: number | string | null | undefined): number => {
  if (v == null) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

export const ROBOT_BID_RE = /^ZZ\s+(Twin|Shadow)\b/i
export const isRobotBidName = (projectName: string | null | undefined): boolean => ROBOT_BID_RE.test((projectName ?? '').trim())

/** The Bid Board's five sections folded to four; archived unsent bids are none of them. */
export function pursuitOutcomeOf(bid: Pick<PursuitBidInput, 'outcome' | 'bid_date_sent' | 'working_board_archived_at'>): PursuitOutcome | null {
  if (bid.outcome === 'won' || bid.outcome === 'started_or_complete') return 'won'
  if (bid.outcome === 'lost') return 'lost'
  if (bid.bid_date_sent) return 'open'
  return bid.working_board_archived_at ? null : 'unsent'
}

const normalizeUser = (u: EstimatorUser | EstimatorUser[] | null | undefined): EstimatorUser | null => (u == null ? null : Array.isArray(u) ? (u[0] ?? null) : u)
const ymd = (iso: string | null | undefined): string | null => (iso ? iso.slice(0, 10) : null)

export function buildPursuitRows(args: {
  bids: ReadonlyArray<PursuitBidInput>
  laborByBid: ReadonlyMap<string, PursuitLabor>
  assignedByBid: ReadonlyMap<string, BidAssignedCosts>
}): PursuitRow[] {
  const rows: PursuitRow[] = []
  for (const b of args.bids) {
    const outcome = pursuitOutcomeOf(b)
    if (!outcome) continue
    const labor = args.laborByBid.get(b.id)
    const assigned = args.assignedByBid.get(b.id)
    const est = normalizeUser(b.estimator)
    const agreed = num(b.agreed_value)
    const value = num(b.bid_value)
    const bidValue = agreed > 0 ? agreed : value > 0 ? value : null
    const laborUsd = labor ? num(labor.bidCost) : 0
    const cardUsd = assigned?.partsStyle ?? 0
    const materialsUsd = assigned?.materials ?? 0
    const totalUsd = laborUsd + cardUsd + materialsUsd
    const numStr = (b.bid_number ?? '').trim()
    const projectName = (b.project_name ?? '').trim()
    rows.push({
      bidId: b.id,
      label: `${numStr ? `B${numStr} ` : ''}${projectName}`.trim() || 'Bid',
      projectName,
      bidNumber: numStr || null,
      estimatorName: est ? (est.name?.trim() || est.email || null) : null,
      gcName: b.customers?.name?.trim() || b.bids_gc_builders?.name?.trim() || null,
      outcome,
      dateYmd: ymd(b.bid_date_sent) ?? ymd(b.created_at),
      sentYmd: ymd(b.bid_date_sent),
      outcomeAtYmd: ymd(b.outcome_at),
      robot: isRobotBidName(projectName),
      hours: labor ? num(labor.manHours) : 0,
      laborUsd,
      cardUsd,
      materialsUsd,
      totalUsd,
      bidValue,
      usdPerThousandBid: bidValue && totalUsd > 0 ? totalUsd / (bidValue / 1000) : null,
      people: [...(labor?.breakdown ?? [])].map((p) => ({ name: p.personName, hours: p.hours })).sort((a, c) => c.hours - a.hours),
    })
  }
  return rows.sort((a, c) => c.totalUsd - a.totalUsd || c.hours - a.hours || a.label.localeCompare(c.label))
}

export type PursuitFilter = {
  window: PursuitWindow
  outcomes: ReadonlySet<PursuitOutcome>
  /** Show bids with no clocked time and nothing moved onto them. */
  showEmpty: boolean
  showRobots: boolean
  estimator: string | null
  gc: string | null
  query: string
}

export const DEFAULT_PURSUIT_FILTER: PursuitFilter = { window: 'year', outcomes: new Set(PURSUIT_OUTCOMES), showEmpty: false, showRobots: false, estimator: null, gc: null, query: '' }

const shiftYmd = (todayYmd: string, days: number): string => {
  const [y, m, d] = todayYmd.split('-').map((s) => Number(s))
  const t = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1))
  t.setUTCDate(t.getUTCDate() - days)
  return t.toISOString().slice(0, 10)
}

/** The window alone — the summary reads these before the outcome chips narrow them. */
export function pursuitRowsInWindow(rows: ReadonlyArray<PursuitRow>, window: PursuitWindow, todayYmd: string, showRobots: boolean): PursuitRow[] {
  const days = PURSUIT_WINDOWS.find((w) => w.key === window)?.days ?? null
  const since = days == null ? null : shiftYmd(todayYmd, days)
  return rows.filter((r) => (showRobots || !r.robot) && (since == null || (r.dateYmd != null && r.dateYmd >= since)))
}

export function filterPursuitRows(rows: ReadonlyArray<PursuitRow>, f: PursuitFilter, todayYmd: string): PursuitRow[] {
  const q = f.query.trim().toLowerCase()
  return pursuitRowsInWindow(rows, f.window, todayYmd, f.showRobots).filter((r) => {
    if (!f.outcomes.has(r.outcome)) return false
    if (!f.showEmpty && r.totalUsd <= 0 && r.hours <= 0) return false
    if (f.estimator != null && (r.estimatorName ?? '') !== f.estimator) return false
    if (f.gc != null && (r.gcName ?? '') !== f.gc) return false
    if (q && !`${r.label} ${r.gcName ?? ''} ${r.estimatorName ?? ''}`.toLowerCase().includes(q)) return false
    return true
  })
}

export type PursuitSummary = {
  spendUsd: number
  hours: number
  bidsWithTime: number
  perBidUsd: number | null
  perBidHours: number | null
  wonValue: number
  lostValue: number
  openValue: number
  /** won ÷ (won + lost) by value; null before anything decided. */
  hitRateByValue: number | null
  lostSpendUsd: number
  lostHours: number
  lostBids: number
  /** lost spend ÷ all spend; null without spend. */
  lostSpendShare: number | null
}

/** Over the rows in the window (robots folded, empties included — value counts every bid). */
export function pursuitSummary(rows: ReadonlyArray<PursuitRow>): PursuitSummary {
  let spendUsd = 0, hours = 0, bidsWithTime = 0, wonValue = 0, lostValue = 0, openValue = 0, lostSpendUsd = 0, lostHours = 0, lostBids = 0
  for (const r of rows) {
    const has = r.totalUsd > 0 || r.hours > 0
    if (has) {
      bidsWithTime++
      spendUsd += r.totalUsd
      hours += r.hours
    }
    if (r.outcome === 'won') wonValue += r.bidValue ?? 0
    else if (r.outcome === 'lost') {
      lostValue += r.bidValue ?? 0
      if (has) {
        lostSpendUsd += r.totalUsd
        lostHours += r.hours
        lostBids++
      }
    } else if (r.outcome === 'open') openValue += r.bidValue ?? 0
  }
  const decided = wonValue + lostValue
  return {
    spendUsd, hours, bidsWithTime,
    perBidUsd: bidsWithTime > 0 ? spendUsd / bidsWithTime : null,
    perBidHours: bidsWithTime > 0 ? hours / bidsWithTime : null,
    wonValue, lostValue, openValue,
    hitRateByValue: decided > 0 ? wonValue / decided : null,
    lostSpendUsd, lostHours, lostBids,
    lostSpendShare: spendUsd > 0 ? lostSpendUsd / spendUsd : null,
  }
}

export type PursuitRollup = { key: string; label: string; bids: number; hours: number; usd: number }

/** Spend by estimator over rows with time, largest first; bids with no estimator read "No estimator". */
export function pursuitByEstimator(rows: ReadonlyArray<PursuitRow>): PursuitRollup[] {
  return rollup(rows, (r) => r.estimatorName ?? '', (k) => k || 'No estimator')
}

/** Spend by GC over rows with time, largest first. */
export function pursuitByGc(rows: ReadonlyArray<PursuitRow>): PursuitRollup[] {
  return rollup(rows, (r) => r.gcName ?? '', (k) => k || 'No GC')
}

export function pursuitByOutcome(rows: ReadonlyArray<PursuitRow>): Record<PursuitOutcome, { bids: number; hours: number; usd: number }> {
  const out: Record<PursuitOutcome, { bids: number; hours: number; usd: number }> = { unsent: { bids: 0, hours: 0, usd: 0 }, open: { bids: 0, hours: 0, usd: 0 }, won: { bids: 0, hours: 0, usd: 0 }, lost: { bids: 0, hours: 0, usd: 0 } }
  for (const r of rows) {
    if (!(r.totalUsd > 0 || r.hours > 0)) continue
    const o = out[r.outcome]
    o.bids++
    o.hours += r.hours
    o.usd += r.totalUsd
  }
  return out
}

function rollup(rows: ReadonlyArray<PursuitRow>, keyOf: (r: PursuitRow) => string, labelOf: (k: string) => string): PursuitRollup[] {
  const m = new Map<string, PursuitRollup>()
  for (const r of rows) {
    if (!(r.totalUsd > 0 || r.hours > 0)) continue
    const key = keyOf(r)
    const cur = m.get(key) ?? { key, label: labelOf(key), bids: 0, hours: 0, usd: 0 }
    cur.bids++
    cur.hours += r.hours
    cur.usd += r.totalUsd
    m.set(key, cur)
  }
  return [...m.values()].sort((a, b) => b.usd - a.usd || b.hours - a.hours || a.label.localeCompare(b.label))
}

/** "$1.71M" / "$564k" / "$7,003" — the tile scale. */
export function formatUsdShort(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 100_000) return `$${Math.round(n / 1000)}k`
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/** "19:48" from decimal hours; the formatter carries a rounded 60 into the hour. */
export const formatPursuitHours = (h: number): string => decimalHoursToHhMm(h)

/** "William 11:03 · Joseph 0:07" */
export function formatPursuitPeople(people: ReadonlyArray<{ name: string; hours: number }>): string {
  return people.map((p) => `${p.name} ${formatPursuitHours(p.hours)}`).join(' · ')
}
