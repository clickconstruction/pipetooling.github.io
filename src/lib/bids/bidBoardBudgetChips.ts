/**
 * The Bid Board's two won-row chips (Burn against the bid, PR 4 — v2.3302).
 *
 *   job chip      linked (the J#### chip the board already shows) ·
 *                 "J1007 matches by value → Link" (an unlinked job whose price
 *                 equals this bid's value to the dollar) · none
 *   estimate chip costed · N h (hours and a rate on the Cost Estimate tab) ·
 *                 hours only · no cost estimate → Cost it
 *
 * Pure: the hook fetches, this decides the words.
 */
import { laborRowHours } from './laborRowHours'

export type BidBoardValueMatch = { jobId: string; hcpNumber: string | null; revenue: number }

export type BidEstimateStatusKind = 'costed' | 'hours_only' | 'none'
export type BidEstimateStatus = { kind: BidEstimateStatusKind; hours: number; rateSet: boolean }

export type BidBoardBudgetChip = {
  /** The unlinked job whose price equals the bid value (± $1); null when none or when a job is already linked. */
  valueMatch: BidBoardValueMatch | null
  estimate: BidEstimateStatus
}

type LaborRowLike = Parameters<typeof laborRowHours>[0]

/** Estimate status off the bid's cost_estimates row and its labor rows. */
export function bidEstimateStatus(est: { labor_rate: number | string | null; rows: ReadonlyArray<LaborRowLike> } | null | undefined): BidEstimateStatus {
  if (!est) return { kind: 'none', hours: 0, rateSet: false }
  const hours = est.rows.reduce((s, r) => s + laborRowHours(r), 0)
  const rateSet = est.labor_rate != null && Number(est.labor_rate) > 0
  if (hours > 0 && rateSet) return { kind: 'costed', hours, rateSet }
  if (hours > 0) return { kind: 'hours_only', hours, rateSet }
  return { kind: 'none', hours: 0, rateSet }
}

export const BID_ESTIMATE_STATUS_WORDS: Record<BidEstimateStatusKind, (hours: number) => string> = {
  costed: (h) => `costed · ${Math.round(h).toLocaleString('en-US')} h`,
  hours_only: (h) => `hours only · ${Math.round(h).toLocaleString('en-US')} h`,
  none: () => 'no cost estimate',
}

/** The value a job would have to carry to match this bid: the agreed value when set, else the bid value. */
export function bidMatchValue(bid: { bid_value: number | string | null; agreed_value: number | string | null }): number | null {
  const agreed = bid.agreed_value != null ? Number(bid.agreed_value) : null
  const value = bid.bid_value != null ? Number(bid.bid_value) : null
  const v = agreed != null && agreed > 0 ? agreed : value
  return v != null && v > 0 ? v : null
}

/** The first unlinked job whose price equals the bid's value (± $1). */
export function valueMatchForBid(bid: { bid_value: number | string | null; agreed_value: number | string | null }, unlinkedJobs: ReadonlyArray<BidBoardValueMatch>): BidBoardValueMatch | null {
  const v = bidMatchValue(bid)
  if (v == null) return null
  return unlinkedJobs.find((j) => Math.abs(j.revenue - v) <= 1) ?? null
}

export const isWonOutcome = (outcome: string | null | undefined): boolean => outcome === 'won' || outcome === 'started_or_complete'
