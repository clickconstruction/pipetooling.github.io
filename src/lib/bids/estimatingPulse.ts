/**
 * Estimating Pulse (the Bid Board Health section's "New" view, v2.1918):
 * pure aggregation for the stat strip, the stacked weekly outcome chart,
 * the shared won-% field band, and the per-person role cards.
 *
 * Outcome semantics match the Scoreboard / weekly pivot: Won includes
 * `started_or_complete`; "waiting" is sent and not won/lost/started.
 */

import type { BidWithBuilder } from '../../types/bidWithBuilder'
import {
  calendarYmdInAppTzFromIso,
  companyWeekStartSundayContaining,
  getScheduleDispatchWeekNavParts,
  ymdAddDays,
} from '../../utils/dateUtils'
import { formatBidStaffDisplayName } from './bidBoardStaffOutcomes'

export type PulseOutcome = 'won' | 'lost' | 'wait'

export function classifyPulseOutcome(outcome: string | null | undefined): PulseOutcome {
  if (outcome === 'won' || outcome === 'started_or_complete') return 'won'
  if (outcome === 'lost') return 'lost'
  return 'wait'
}

function bidDollars(bid: Pick<BidWithBuilder, 'bid_value'>): number {
  const v = bid.bid_value != null ? Number(bid.bid_value) : 0
  return Number.isFinite(v) ? v : 0
}

export type PulseStats = {
  sentCount: number
  sentDollars: number
  last4Count: number
  last4Dollars: number
  wonCount: number
  decidedCount: number
  wonDollars: number
  decidedDollars: number
  waitingCount: number
  waitingDollars: number
}

export type PulseWeek = {
  weekStart: string
  weekEnd: string
  /** e.g. `Week 34` (ISO week of the Thursday); null when not computable. */
  weekTitle: string | null
  /** e.g. `08/16–08/22` */
  dateRange: string
  /** `Aug` when this week starts a new month within the window (or is the first week). */
  monthLabel: string | null
  wonDollars: number
  waitDollars: number
  lostDollars: number
  count: number
  bidIds: string[]
}

export type PulseRoleStats = {
  sentCount: number
  sentDollars: number
  wonCount: number
  lostCount: number
  waitingCount: number
  wonDollars: number
  decidedDollars: number
  /** Bid ids per chip, for drill-downs. */
  wonBidIds: string[]
  lostBidIds: string[]
  waitingBidIds: string[]
}

export type PulsePersonRow = {
  userId: string
  displayName: string
  touchedCount: number
  touchedDollars: number
  /** Union $ per week (oldest → newest), aligned with the week list. */
  weeklyTouchedDollars: number[]
  estimator: PulseRoleStats | null
  accountManager: PulseRoleStats | null
  /** Combined decided record across both roles, each bid counted once. */
  combinedWon: number
  combinedDecided: number
}

export type PulseBandItem = {
  label: string
  pct: number
  record: string
  smallSample: boolean
  company: boolean
  /** 0 = short stem, 1 = long stem (staggered to dodge a close neighbor). */
  row: 0 | 1
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function monthShortOfYmd(ymd: string): string | null {
  const m = /^\d{4}-(\d{2})-\d{2}$/.exec(ymd)
  if (!m) return null
  return MONTH_SHORT[Number(m[1]) - 1] ?? null
}

/** Sent bids only, with their app-timezone company week start. */
function sentBidsWithWeek(bids: BidWithBuilder[]): Array<{ bid: BidWithBuilder; weekStart: string }> {
  const out: Array<{ bid: BidWithBuilder; weekStart: string }> = []
  for (const bid of bids) {
    if (!bid.bid_date_sent) continue
    const ymd = calendarYmdInAppTzFromIso(bid.bid_date_sent)
    if (!ymd) continue
    const weekStart = companyWeekStartSundayContaining(ymd)
    if (!weekStart) continue
    out.push({ bid, weekStart })
  }
  return out
}

/** Consecutive week starts (oldest → newest) ending at the week containing `currentWeekStart`. */
export function pulseWeekStarts(currentWeekStart: string, windowWeeks: number): string[] {
  const out: string[] = []
  for (let i = windowWeeks - 1; i >= 0; i--) out.push(ymdAddDays(currentWeekStart, -7 * i))
  return out
}

/**
 * Stacked chart weeks (oldest → newest), including empty weeks so the axis
 * shows real gaps. `monthLabel` marks the first week and month changes.
 */
export function buildPulseWeeks(
  bids: BidWithBuilder[],
  currentWeekStart: string,
  windowWeeks: number,
): PulseWeek[] {
  const starts = pulseWeekStarts(currentWeekStart, windowWeeks)
  const inWindow = new Set(starts)
  const byWeek = new Map<string, { won: number; wait: number; lost: number; count: number; bidIds: string[] }>()
  for (const s of starts) byWeek.set(s, { won: 0, wait: 0, lost: 0, count: 0, bidIds: [] })
  for (const { bid, weekStart } of sentBidsWithWeek(bids)) {
    if (!inWindow.has(weekStart)) continue
    const cell = byWeek.get(weekStart)!
    const d = bidDollars(bid)
    const o = classifyPulseOutcome(bid.outcome)
    if (o === 'won') cell.won += d
    else if (o === 'lost') cell.lost += d
    else cell.wait += d
    cell.count += 1
    cell.bidIds.push(bid.id)
  }
  let prevMonth: string | null = null
  return starts.map((weekStart) => {
    const weekEnd = ymdAddDays(weekStart, 6)
    const { weekTitle, dateRange } = getScheduleDispatchWeekNavParts(weekStart, weekEnd)
    const month = monthShortOfYmd(weekStart)
    const monthLabel = month !== null && month !== prevMonth ? month : null
    prevMonth = month ?? prevMonth
    const cell = byWeek.get(weekStart)!
    return {
      weekStart,
      weekEnd,
      weekTitle,
      dateRange,
      monthLabel,
      wonDollars: cell.won,
      waitDollars: cell.wait,
      lostDollars: cell.lost,
      count: cell.count,
      bidIds: cell.bidIds,
    }
  })
}

/** Stat strip over every sent bid in the (already filtered) list. */
export function buildPulseStats(bids: BidWithBuilder[], currentWeekStart: string): PulseStats {
  const last4Cutoff = ymdAddDays(currentWeekStart, -7 * 3)
  const stats: PulseStats = {
    sentCount: 0,
    sentDollars: 0,
    last4Count: 0,
    last4Dollars: 0,
    wonCount: 0,
    decidedCount: 0,
    wonDollars: 0,
    decidedDollars: 0,
    waitingCount: 0,
    waitingDollars: 0,
  }
  for (const { bid, weekStart } of sentBidsWithWeek(bids)) {
    const d = bidDollars(bid)
    stats.sentCount += 1
    stats.sentDollars += d
    if (weekStart >= last4Cutoff) {
      stats.last4Count += 1
      stats.last4Dollars += d
    }
    const o = classifyPulseOutcome(bid.outcome)
    if (o === 'won') {
      stats.wonCount += 1
      stats.wonDollars += d
      stats.decidedCount += 1
      stats.decidedDollars += d
    } else if (o === 'lost') {
      stats.decidedCount += 1
      stats.decidedDollars += d
    } else {
      stats.waitingCount += 1
      stats.waitingDollars += d
    }
  }
  return stats
}

type RoleTally = {
  sentCount: number
  sentDollars: number
  wonCount: number
  lostCount: number
  waitingCount: number
  wonDollars: number
  decidedDollars: number
  wonBidIds: string[]
  lostBidIds: string[]
  waitingBidIds: string[]
}

function emptyRoleTally(): RoleTally {
  return {
    sentCount: 0,
    sentDollars: 0,
    wonCount: 0,
    lostCount: 0,
    waitingCount: 0,
    wonDollars: 0,
    decidedDollars: 0,
    wonBidIds: [],
    lostBidIds: [],
    waitingBidIds: [],
  }
}

function addToRoleTally(t: RoleTally, bid: BidWithBuilder): void {
  const d = bidDollars(bid)
  t.sentCount += 1
  t.sentDollars += d
  const o = classifyPulseOutcome(bid.outcome)
  if (o === 'won') {
    t.wonCount += 1
    t.wonDollars += d
    t.decidedDollars += d
    t.wonBidIds.push(bid.id)
  } else if (o === 'lost') {
    t.lostCount += 1
    t.decidedDollars += d
    t.lostBidIds.push(bid.id)
  } else {
    t.waitingCount += 1
    t.waitingBidIds.push(bid.id)
  }
}

/**
 * One row per person across both roles. The header (`touched*`) and the
 * sparkline count each bid once even when the person is estimator AND
 * account manager on it; the per-role stats stay separate.
 */
export function buildPulsePersonRows(
  bids: BidWithBuilder[],
  currentWeekStart: string,
  windowWeeks: number,
): PulsePersonRow[] {
  const starts = pulseWeekStarts(currentWeekStart, windowWeeks)
  const weekIndex = new Map(starts.map((s, i) => [s, i]))
  type Acc = {
    displayName: string
    est: RoleTally | null
    am: RoleTally | null
    touchedIds: Set<string>
    touchedDollars: number
    weekly: number[]
    combinedWon: number
    combinedDecided: number
  }
  const byUser = new Map<string, Acc>()
  const acc = (userId: string): Acc => {
    let a = byUser.get(userId)
    if (!a) {
      a = {
        displayName: '—',
        est: null,
        am: null,
        touchedIds: new Set(),
        touchedDollars: 0,
        weekly: starts.map(() => 0),
        combinedWon: 0,
        combinedDecided: 0,
      }
      byUser.set(userId, a)
    }
    return a
  }
  const touch = (a: Acc, bid: BidWithBuilder, weekStart: string | null) => {
    if (a.touchedIds.has(bid.id)) return
    a.touchedIds.add(bid.id)
    const d = bidDollars(bid)
    a.touchedDollars += d
    if (weekStart !== null) {
      const idx = weekIndex.get(weekStart)
      if (idx !== undefined) a.weekly[idx] = (a.weekly[idx] ?? 0) + d
    }
    const o = classifyPulseOutcome(bid.outcome)
    if (o === 'won') {
      a.combinedWon += 1
      a.combinedDecided += 1
    } else if (o === 'lost') {
      a.combinedDecided += 1
    }
  }
  for (const { bid, weekStart } of sentBidsWithWeek(bids)) {
    const eid = bid.estimator_id
    if (eid) {
      const a = acc(eid)
      const n = formatBidStaffDisplayName(bid.estimator)
      if (n !== '—') a.displayName = n
      if (!a.est) a.est = emptyRoleTally()
      addToRoleTally(a.est, bid)
      touch(a, bid, weekStart)
    }
    const amid = bid.account_manager_id
    if (amid) {
      const a = acc(amid)
      const n = formatBidStaffDisplayName(bid.account_manager)
      if (n !== '—') a.displayName = n
      if (!a.am) a.am = emptyRoleTally()
      addToRoleTally(a.am, bid)
      touch(a, bid, weekStart)
    }
  }
  return [...byUser.entries()]
    .map(([userId, a]) => ({
      userId,
      displayName: a.displayName,
      touchedCount: a.touchedIds.size,
      touchedDollars: a.touchedDollars,
      weeklyTouchedDollars: a.weekly,
      estimator: a.est,
      accountManager: a.am,
      combinedWon: a.combinedWon,
      combinedDecided: a.combinedDecided,
    }))
    .sort((a, b) => {
      if (b.touchedCount !== a.touchedCount) return b.touchedCount - a.touchedCount
      const cmp = a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
      if (cmp !== 0) return cmp
      return a.userId.localeCompare(b.userId)
    })
}

/** Decided bids needed before a band dot / card % reads as signal, not noise. */
export const PULSE_SMALL_SAMPLE_DECIDED = 5

/**
 * Field-band markers (people with a decided record + the company), sorted by
 * won %, with close neighbors staggered onto the long-stem row so full-name
 * pills don't overlap. `staggerGapPct` is the closeness threshold.
 */
export function buildPulseBandItems(
  people: PulsePersonRow[],
  stats: Pick<PulseStats, 'wonCount' | 'decidedCount'>,
  staggerGapPct = 12,
): PulseBandItem[] {
  const items: Array<Omit<PulseBandItem, 'row'>> = []
  for (const p of people) {
    if (p.combinedDecided === 0) continue
    items.push({
      label: p.displayName,
      pct: (100 * p.combinedWon) / p.combinedDecided,
      record: `${p.combinedWon} of ${p.combinedDecided} decided`,
      smallSample: p.combinedDecided < PULSE_SMALL_SAMPLE_DECIDED,
      company: false,
    })
  }
  if (stats.decidedCount > 0) {
    items.push({
      label: 'ALL',
      pct: (100 * stats.wonCount) / stats.decidedCount,
      record: `Company: ${stats.wonCount} of ${stats.decidedCount} decided`,
      smallSample: false,
      company: true,
    })
  }
  items.sort((a, b) => a.pct - b.pct)
  let prevPct = -Infinity
  let prevRow: 0 | 1 = 1
  return items.map((it) => {
    const row: 0 | 1 = it.pct - prevPct < staggerGapPct && prevRow === 0 ? 1 : 0
    prevPct = it.pct
    prevRow = row
    return { ...it, row }
  })
}

/** users lookup entry (RPC list_user_display_names) for a pulse person id. */
export type PulsePersonDirectoryEntry = { name: string | null; archived: boolean }

/**
 * Per-viewer hide preferences (localStorage). `hidden` are explicit hides of
 * active people; `shownArchived` are explicit un-hides of archived people,
 * who are hidden by default.
 */
export type PulseHiddenPeopleState = { hidden: string[]; shownArchived: string[] }

export type PulseHiddenChip = { userId: string; label: string; archived: boolean }

export function emptyPulseHiddenPeopleState(): PulseHiddenPeopleState {
  return { hidden: [], shownArchived: [] }
}

/** Safe parse of the persisted state; anything malformed → empty state. */
export function parsePulseHiddenPeopleState(raw: string | null): PulseHiddenPeopleState {
  if (!raw) return emptyPulseHiddenPeopleState()
  try {
    const o = JSON.parse(raw) as { hidden?: unknown; shownArchived?: unknown }
    const strings = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
    return { hidden: strings(o?.hidden), shownArchived: strings(o?.shownArchived) }
  } catch {
    return emptyPulseHiddenPeopleState()
  }
}

/**
 * Split people into shown rows and hidden chips. Resolves "—" display names
 * through the directory (the users RLS policy hides archived accounts from
 * non-dev roles, so the bids join can't name them); archived people are
 * hidden by default until explicitly shown.
 */
export function buildPulsePeopleView(
  people: PulsePersonRow[],
  directory: ReadonlyMap<string, PulsePersonDirectoryEntry>,
  state: PulseHiddenPeopleState,
): { visible: PulsePersonRow[]; hiddenChips: PulseHiddenChip[] } {
  const hidden = new Set(state.hidden)
  const shownArchived = new Set(state.shownArchived)
  const visible: PulsePersonRow[] = []
  const hiddenChips: PulseHiddenChip[] = []
  for (const p of people) {
    const entry = directory.get(p.userId)
    const name = p.displayName !== '—' ? p.displayName : entry?.name?.trim() || '—'
    const archived = entry?.archived ?? false
    const isShown = archived ? shownArchived.has(p.userId) : !hidden.has(p.userId)
    if (isShown) visible.push(name === p.displayName ? p : { ...p, displayName: name })
    else hiddenChips.push({ userId: p.userId, label: name, archived })
  }
  return { visible, hiddenChips }
}

/** New state with one person hidden or shown (deduped, order preserved). */
export function withPulsePersonHidden(
  state: PulseHiddenPeopleState,
  userId: string,
  archived: boolean,
  hide: boolean,
): PulseHiddenPeopleState {
  const without = (list: string[]) => list.filter((id) => id !== userId)
  if (archived) {
    return {
      hidden: without(state.hidden),
      shownArchived: hide ? without(state.shownArchived) : [...without(state.shownArchived), userId],
    }
  }
  return {
    hidden: hide ? [...without(state.hidden), userId] : without(state.hidden),
    shownArchived: state.shownArchived,
  }
}

/** New state showing every currently hidden chip (archived ones included). */
export function withAllPulsePeopleShown(
  state: PulseHiddenPeopleState,
  hiddenChips: PulseHiddenChip[],
): PulseHiddenPeopleState {
  const newlyShown = hiddenChips.filter((c) => c.archived).map((c) => c.userId)
  const already = new Set(state.shownArchived)
  return {
    hidden: [],
    shownArchived: [...state.shownArchived, ...newlyShown.filter((id) => !already.has(id))],
  }
}

/** `$4.2M` / `$287K` / `$950` — chart + card money labels. */
export function formatPulseMoney(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${Math.round(v / 1_000)}K`
  return `$${Math.round(v)}`
}
