/**
 * Pairing bids with the jobs they became (punch list #208, design spike, the owner's ask of
 * 2026-10-28): the suggestions the pair mode draws first. A suggestion is a sort, not a verdict —
 * the bid's `project_name` and the job's `job_name` are tokenized, the words that say nothing on
 * this site are dropped (the development's name, the shared address's street words, the customer's
 * name, stop words), and a pair scores by the words they share, then by the same value when both
 * carry one, then by the bid's date falling before the job's. The person decides. Pure.
 */
import { normalizeAddressKey } from './notInIt'
import type { MemberBid, MemberJob } from './overview'

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with', 'from', 'into', 'new', 'job', 'jobs', 'bid', 'bids', 'project', 'work', 'install', 'installation', 'repair', 'service', 'building', 'bldg', 'room', 'house', 'trail', 'road', 'street', 'drive', 'lane', 'rd', 'st', 'dr', 'ln', 'trl', 'inc', 'llc', 'co', 'change', 'order', 'final', 'initial', 'phase',
])

/** A name as its telling words: lowercase, letters and digits, three letters or more (or a number), minus the site's words. */
export function nameTokens(name: string | null | undefined, drop: ReadonlySet<string>): string[] {
  const out = new Set<string>()
  for (const raw of (name ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
    const w = raw.trim()
    if (!w) continue
    if (STOP.has(w) || drop.has(w)) continue
    if (w.length < 3 && !/^\d+$/.test(w)) continue
    out.add(w.endsWith('s') && w.length > 4 ? w.slice(0, -1) : w)
  }
  return [...out]
}

/** The words that say nothing on this site: the development's name, the street words, the customer's name. */
export function siteDropWords(args: { developmentName: string | null; address: string | null; customerName: string | null }): Set<string> {
  const drop = new Set<string>()
  const add = (s: string | null | undefined) => {
    for (const w of (s ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
      if (w) {
        drop.add(w)
        if (w.endsWith('s') && w.length > 4) drop.add(w.slice(0, -1))
      }
    }
  }
  add(args.developmentName)
  add(normalizeAddressKey(args.address))
  add(args.customerName)
  return drop
}

export type PairSuggestion = {
  bidId: string
  jobId: string
  /** The words the two names share, for the row to show why. */
  shared: string[]
  /** Both carry a value and it is the same, to the dollar. */
  sameValue: boolean
  /** The bid's date falls before the job's. */
  bidFirst: boolean
  score: number
}

/**
 * Every unpaired bid against every unpaired job, scored, the best kept: at most one suggestion per
 * job (a job came from one bid) and at most one per bid in the first pass (a bid may take several jobs,
 * but a suggestion list that names the same bid thrice reads as a guess). Only pairs that share at
 * least one word, or the same value, are suggested.
 */
export function suggestPairs(args: {
  bids: readonly MemberBid[]
  jobs: readonly MemberJob[]
  drop: ReadonlySet<string>
}): PairSuggestion[] {
  const bidTokens = new Map(args.bids.map((b) => [b.id, nameTokens(b.project_name, args.drop)]))
  const jobTokens = new Map(args.jobs.map((j) => [j.id, nameTokens(j.job_name, args.drop)]))
  const candidates: PairSuggestion[] = []
  for (const b of args.bids) {
    const bt = bidTokens.get(b.id) ?? []
    const bidValue = b.agreed_value ?? b.bid_value ?? null
    const bidDay = b.bid_date_sent ?? b.created_at ?? null
    for (const j of args.jobs) {
      const jt = jobTokens.get(j.id) ?? []
      const shared = bt.filter((w) => jt.includes(w))
      const sameValue = bidValue != null && j.revenue != null && j.revenue > 0 && Math.round(bidValue) === Math.round(j.revenue)
      if (shared.length === 0 && !sameValue) continue
      const bidFirst = !!bidDay && !!j.created_at && bidDay.slice(0, 10) <= j.created_at.slice(0, 10)
      const score = shared.length * 10 + (sameValue ? 25 : 0) + (bidFirst ? 1 : 0)
      candidates.push({ bidId: b.id, jobId: j.id, shared, sameValue, bidFirst, score })
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.bidId.localeCompare(b.bidId) || a.jobId.localeCompare(b.jobId))
  const usedJobs = new Set<string>()
  const usedBids = new Set<string>()
  const out: PairSuggestion[] = []
  for (const c of candidates) {
    if (usedJobs.has(c.jobId) || usedBids.has(c.bidId)) continue
    usedJobs.add(c.jobId)
    usedBids.add(c.bidId)
    out.push(c)
  }
  return out
}

/** How sure a suggestion reads, for the row's chip: *likely* with two shared words or the same value, else *maybe*. */
export function suggestionConfidence(s: PairSuggestion): 'likely' | 'maybe' {
  return s.sameValue || s.shared.length >= 2 ? 'likely' : 'maybe'
}

/** The words a suggestion row shows for why: *shares exhaust, fan* · *same value* · *bid first*. */
export function suggestionWhy(s: PairSuggestion): string {
  const parts: string[] = []
  if (s.shared.length) parts.push(`shares ${s.shared.join(', ')}`)
  if (s.sameValue) parts.push('same value')
  if (s.bidFirst) parts.push('bid first')
  return parts.join(' · ')
}
