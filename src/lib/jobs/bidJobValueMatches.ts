/**
 * The one-time backfill list (Burn against the bid, PR 5 — v2.3306): every
 * unlinked job whose price equals a won bid's value to the dollar, paired with
 * that bid. A job that matches two bids, or a bid that matches two jobs, is
 * ambiguous — it stays on the list for a person to pick, and "Link all" skips
 * it. Nothing here links; the block calls `snapshot_job_budget_from_bid` per
 * pair the person confirms. Pure.
 */
/** won and started_or_complete are the won outcomes (the same rule the Bid Board's chips use). */
const isWonOutcome = (outcome: string | null | undefined): boolean => outcome === 'won' || outcome === 'started_or_complete'

/** The value a job would have to carry to match a bid: the agreed value when set, else the bid value. */
const bidMatchValue = (bid: { bid_value: number | string | null; agreed_value: number | string | null }): number | null => {
  const agreed = bid.agreed_value != null ? Number(bid.agreed_value) : null
  const value = bid.bid_value != null ? Number(bid.bid_value) : null
  const v = agreed != null && agreed > 0 ? agreed : value
  return v != null && v > 0 ? v : null
}

export type BackfillBid = { id: string; bid_number: string | null; project_name: string | null; outcome: string | null; bid_value: number | string | null; agreed_value: number | string | null }
export type BackfillJob = { id: string; hcp_number: string | null; job_name: string | null; revenue: number | string | null; status: string | null; bid_id: string | null }

export type BidJobValueMatch = {
  jobId: string
  jobLabel: string
  jobStatus: string | null
  jobRevenue: number
  bidId: string
  bidLabel: string
  bidValue: number
  /** The job matches more than one bid, or the bid more than one job — a person decides. */
  ambiguous: boolean
}

const jobLabel = (j: BackfillJob): string => {
  const num = (j.hcp_number ?? '').trim().replace(/^[jJ]\s*/, '')
  return `${num ? `J${num} ` : ''}${(j.job_name ?? '').trim()}`.trim() || 'Job'
}
const bidLabel = (b: BackfillBid): string => `${b.bid_number ? `B${b.bid_number} ` : ''}${(b.project_name ?? '').trim()}`.trim() || 'Bid'

/** Every (unlinked job, won bid) pair whose values agree within a dollar, ambiguity flagged. Sorted by job value, largest first. */
export function pairExactValueMatches(args: { bids: ReadonlyArray<BackfillBid>; jobs: ReadonlyArray<BackfillJob> }): BidJobValueMatch[] {
  const won = args.bids.map((b) => ({ b, v: isWonOutcome(b.outcome) ? bidMatchValue(b) : null })).filter((x): x is { b: BackfillBid; v: number } => x.v != null)
  const pairs: BidJobValueMatch[] = []
  for (const j of args.jobs) {
    if (j.bid_id) continue
    const rev = Number(j.revenue) || 0
    if (!(rev > 0)) continue
    for (const { b, v } of won) {
      if (Math.abs(v - rev) <= 1) pairs.push({ jobId: j.id, jobLabel: jobLabel(j), jobStatus: j.status, jobRevenue: rev, bidId: b.id, bidLabel: bidLabel(b), bidValue: v, ambiguous: false })
    }
  }
  const perJob = new Map<string, number>()
  const perBid = new Map<string, number>()
  for (const p of pairs) {
    perJob.set(p.jobId, (perJob.get(p.jobId) ?? 0) + 1)
    perBid.set(p.bidId, (perBid.get(p.bidId) ?? 0) + 1)
  }
  for (const p of pairs) p.ambiguous = (perJob.get(p.jobId) ?? 0) > 1 || (perBid.get(p.bidId) ?? 0) > 1
  return pairs.sort((a, b) => b.jobRevenue - a.jobRevenue || a.jobLabel.localeCompare(b.jobLabel))
}

/** The pairs "Link all" may take without a person choosing: the unambiguous ones. */
export function unambiguousMatches(pairs: ReadonlyArray<BidJobValueMatch>): BidJobValueMatch[] {
  return pairs.filter((p) => !p.ambiguous)
}
