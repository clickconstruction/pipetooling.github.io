/**
 * Pure bid-board staff-outcome analytics (per estimator / account manager) for the Bids page,
 * extracted from `src/pages/Bids.tsx`. No DOM, React, or Supabase access.
 */

import type { BidWithBuilder, EstimatorUser } from '../../types/bidWithBuilder'

export type BidBoardStaffOutcomeRow = {
  userId: string
  displayName: string
  notYetWonOrLost: number
  won: number
  lost: number
}

/** Minimum bids in role (on filtered list) to appear in staff outcome tables. */
export const BID_BOARD_STAFF_MIN_BIDS = 3

export type BidBoardStaffOutcomesByRole = {
  estimators: BidBoardStaffOutcomeRow[]
  accountManagers: BidBoardStaffOutcomeRow[]
  estimatorsHadAnyAssignment: boolean
  accountManagersHadAnyAssignment: boolean
}

export type StaffOutcomeDrilldownMetric = 'sent' | 'notYetWonOrLost' | 'won' | 'lost'
export type StaffOutcomeDrilldownRole = 'estimator' | 'account_manager'

export type StaffOutcomeDrilldownState = {
  userId: string
  staffDisplayName: string
  role: StaffOutcomeDrilldownRole
  metric: StaffOutcomeDrilldownMetric
}

export function formatBidStaffDisplayName(u: EstimatorUser | EstimatorUser[] | null | undefined): string {
  if (u == null) return '—'
  const one = Array.isArray(u) ? u[0] ?? null : u
  if (!one) return '—'
  return (one.name?.trim() || one.email || '—').slice(0, 200)
}

export function sortBidBoardStaffOutcomeRows(rows: BidBoardStaffOutcomeRow[]): BidBoardStaffOutcomeRow[] {
  return [...rows].sort((a, b) => {
    const sentA = a.notYetWonOrLost + a.won + a.lost
    const sentB = b.notYetWonOrLost + b.won + b.lost
    if (sentB !== sentA) return sentB - sentA
    const cmp = a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
    if (cmp !== 0) return cmp
    return a.userId.localeCompare(b.userId)
  })
}

/** Won % for Scoreboard / Estimating Health: decided = won + lost; null when no decided bids. */
export function staffOutcomeWonPctDisplay(row: BidBoardStaffOutcomeRow): { decided: number; pct: number | null } {
  const decided = row.won + row.lost
  if (decided === 0) return { decided: 0, pct: null }
  return { decided, pct: (100 * row.won) / decided }
}

/** Sent bid, outcome not won / lost / started_or_complete — same as Bid Board "Not yet won or lost" (excludes unsent). */
export function isBidBoardPendingNotYetWonOrLost(bid: BidWithBuilder): boolean {
  if (!bid.bid_date_sent) return false
  const o = bid.outcome
  if (o === 'won' || o === 'lost' || o === 'started_or_complete') return false
  return true
}

/** Won = won + started_or_complete; decided bids only. Separate tallies per role; rows only if bidCount >= BID_BOARD_STAFF_MIN_BIDS. */
export function computeBidBoardStaffOutcomeStatsByRole(bids: BidWithBuilder[]): BidBoardStaffOutcomesByRole {
  const estTally = new Map<string, { won: number; lost: number; bidCount: number; notYetWonOrLost: number }>()
  const amTally = new Map<string, { won: number; lost: number; bidCount: number; notYetWonOrLost: number }>()
  const estNames = new Map<string, string>()
  const amNames = new Map<string, string>()

  for (const bid of bids) {
    const o = bid.outcome
    const isWonLike = o === 'won' || o === 'started_or_complete'
    const isLost = o === 'lost'
    const isPendingNywol = isBidBoardPendingNotYetWonOrLost(bid)

    const eid = bid.estimator_id
    if (eid) {
      if (!estTally.has(eid)) estTally.set(eid, { won: 0, lost: 0, bidCount: 0, notYetWonOrLost: 0 })
      const t = estTally.get(eid)!
      t.bidCount += 1
      const n = formatBidStaffDisplayName(bid.estimator)
      if (n !== '—') estNames.set(eid, n)
      if (isWonLike) t.won += 1
      else if (isLost) t.lost += 1
      else if (isPendingNywol) t.notYetWonOrLost += 1
    }

    const amid = bid.account_manager_id
    if (amid) {
      if (!amTally.has(amid)) amTally.set(amid, { won: 0, lost: 0, bidCount: 0, notYetWonOrLost: 0 })
      const t = amTally.get(amid)!
      t.bidCount += 1
      const n = formatBidStaffDisplayName(bid.account_manager)
      if (n !== '—') amNames.set(amid, n)
      if (isWonLike) t.won += 1
      else if (isLost) t.lost += 1
      else if (isPendingNywol) t.notYetWonOrLost += 1
    }
  }

  for (const uid of estTally.keys()) {
    if (!estNames.has(uid)) estNames.set(uid, '—')
  }
  for (const uid of amTally.keys()) {
    if (!amNames.has(uid)) amNames.set(uid, '—')
  }

  const toRows = (
    tally: Map<string, { won: number; lost: number; bidCount: number; notYetWonOrLost: number }>,
    names: Map<string, string>
  ): BidBoardStaffOutcomeRow[] =>
    sortBidBoardStaffOutcomeRows(
      [...tally.entries()]
        .filter(([, v]) => v.bidCount >= BID_BOARD_STAFF_MIN_BIDS)
        .map(([userId, { won, lost, notYetWonOrLost }]) => ({
          userId,
          displayName: names.get(userId) ?? '—',
          notYetWonOrLost,
          won,
          lost,
        }))
    )

  return {
    estimators: toRows(estTally, estNames),
    accountManagers: toRows(amTally, amNames),
    estimatorsHadAnyAssignment: estTally.size > 0,
    accountManagersHadAnyAssignment: amTally.size > 0,
  }
}

export function staffOutcomeDrilldownMetricLabel(metric: StaffOutcomeDrilldownMetric): string {
  switch (metric) {
    case 'sent':
      return 'Sent'
    case 'notYetWonOrLost':
      return 'Not yet won or lost'
    case 'won':
      return 'Won'
    case 'lost':
      return 'Lost'
  }
}

export function staffOutcomeDrilldownRolePhrase(role: StaffOutcomeDrilldownRole): string {
  return role === 'estimator' ? 'estimator' : 'account manager'
}

export function filterBidsForStaffOutcomeDrilldown(
  bids: BidWithBuilder[],
  args: { userId: string; role: StaffOutcomeDrilldownRole; metric: StaffOutcomeDrilldownMetric }
): BidWithBuilder[] {
  const { userId, role, metric } = args
  return bids.filter((bid) => {
    if (role === 'estimator') {
      if (bid.estimator_id !== userId) return false
    } else if (bid.account_manager_id !== userId) {
      return false
    }
    if (metric === 'sent') return Boolean(bid.bid_date_sent)
    const o = bid.outcome
    const isWonLike = o === 'won' || o === 'started_or_complete'
    const isLost = o === 'lost'
    const isPendingNywol = isBidBoardPendingNotYetWonOrLost(bid)
    if (metric === 'won') return isWonLike
    if (metric === 'lost') return isLost
    return isPendingNywol
  })
}

export function sortStaffOutcomeDrilldownBids(bids: BidWithBuilder[]): BidWithBuilder[] {
  return [...bids].sort((a, b) => {
    const pa = (a.project_name ?? '').toLowerCase()
    const pb = (b.project_name ?? '').toLowerCase()
    const c = pa.localeCompare(pb, undefined, { sensitivity: 'base' })
    if (c !== 0) return c
    return a.id.localeCompare(b.id)
  })
}
