/**
 * The Development page's head (punch list #208 PR 2, design spike 2026-10-28): who is in the
 * development, who is at its address and not in it, the counts the head shows with the waiting
 * one first, the site's people, and the pulse the house lines carry. Pure: the page's fetch
 * hands it rows, it hands back words and numbers. The bid's status word is one place
 * (`bidStatusWord`) so the Pieces table, the counts and the feed never disagree about it.
 */
import { normalizeAddressKey } from './notInIt'

/** The bid columns the page reads. */
export type MemberBid = {
  id: string
  bid_number: string | null
  project_name: string | null
  address: string | null
  customer_id: string | null
  estimator_id: string | null
  account_manager_id: string | null
  development_id: string | null
  outcome: string | null
  outcome_at: string | null
  bid_value: number | null
  agreed_value: number | null
  priced_revenue_usd: number | null
  bid_date_sent: string | null
  bid_due_date: string | null
  estimated_job_start_date: string | null
  plans_link: string | null
  design_drawing_plan_date: string | null
  gc_contact_name: string | null
  gc_contact_phone: string | null
  gc_contact_email: string | null
  created_at: string | null
  updated_at: string | null
  working_board_archived_at: string | null
  working_board_archived_by?: string | null
  service_type_id: string | null
  last_contact: string | null
}

/** The job columns the page reads. */
export type MemberJob = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  customer_id: string | null
  customer_name: string | null
  gc_customer_id: string | null
  development_id: string | null
  bid_id: string | null
  status: string | null
  revenue: number | null
  payments_made: number | null
  /** jobs_ledger.pct_complete, 0–100, for the Money look's bars. */
  pct_complete?: number | null
  last_work_date: string | null
  last_bill_date: string | null
  job_plans_link: string | null
  created_at: string | null
  updated_at: string | null
  service_type_id: string | null
  account_manager_user_id?: string | null
}

/** An estimator or Dispatch request about a member, as the Questions card and the Waiting cell read it. */
export type MemberRequest = {
  id: string
  lane: 'estimators' | 'dispatch'
  title: string
  status: string
  priority: string | null
  created_at: string
  closed_at: string | null
  closed_note: string | null
  from_user_id: string
  bid_id: string | null
  job_ledger_id: string | null
  reference_summary: string | null
  notes: Array<{ id: string; author_user_id: string; body: string; created_at: string }>
}

export type Members = { bids: MemberBid[]; jobs: MemberJob[] }

/** A request is open while it has no closed stamp and its status is not a closed word. */
export function requestIsOpen(r: Pick<MemberRequest, 'status' | 'closed_at'>): boolean {
  if (r.closed_at) return false
  const s = (r.status ?? '').toLowerCase()
  return s !== 'closed' && s !== 'done' && s !== 'resolved'
}

/** The normalized addresses the development's members share: the page's idea of "the site". */
export function memberAddressKeys(members: Members): Set<string> {
  const keys = new Set<string>()
  for (const b of members.bids) {
    const k = normalizeAddressKey(b.address)
    if (k) keys.add(k)
  }
  for (const j of members.jobs) {
    const k = normalizeAddressKey(j.job_address)
    if (k) keys.add(k)
  }
  return keys
}

/**
 * The words the head prints for the shared address: the most common raw spelling among the
 * members of the most common key, so the head reads *Gun Dog Trail, Neeses, SC* and not a key.
 */
export function sharedAddressWords(members: Members): string | null {
  const tally = new Map<string, Map<string, number>>()
  const add = (raw: string | null | undefined) => {
    const key = normalizeAddressKey(raw)
    if (!key) return
    const spellings = tally.get(key) ?? new Map<string, number>()
    const spelled = (raw ?? '').trim()
    spellings.set(spelled, (spellings.get(spelled) ?? 0) + 1)
    tally.set(key, spellings)
  }
  for (const b of members.bids) add(b.address)
  for (const j of members.jobs) add(j.job_address)
  let bestKey: Map<string, number> | null = null
  let bestCount = 0
  for (const spellings of tally.values()) {
    let n = 0
    for (const c of spellings.values()) n += c
    if (n > bestCount) {
      bestCount = n
      bestKey = spellings
    }
  }
  if (!bestKey) return null
  let best = ''
  let c0 = 0
  for (const [spelled, c] of bestKey) {
    if (c > c0) {
      c0 = c
      best = spelled
    }
  }
  return best || null
}

/**
 * A SQL `ilike` pattern that finds every spelling of one normalized address: the key's words
 * up to the first street suffix (the number and the street's name), joined by the wildcard, so
 * *Gun Dog Trl* and *gun dog trail* both come back and the key decides which ones match.
 */
const SUFFIX_WORDS = new Set(['road', 'street', 'drive', 'lane', 'trail', 'avenue', 'boulevard', 'highway', 'court', 'circle', 'parkway', 'place', 'terrace', 'way', 'loop'])
export function addressSearchPattern(key: string): string {
  const words = key.split(' ').filter(Boolean)
  const head: string[] = []
  for (const w of words) {
    if (SUFFIX_WORDS.has(w) && head.length > 0) break
    head.push(w)
    if (head.length >= 3) break
  }
  if (head.length === 0) return ''
  return `%${head.join('%')}%`
}

/**
 * The split the page draws: the members (by `development_id`) and the records at the same address
 * that are not in it (the *not in it yet* line, and the toggle that shows them on the page anyway).
 * `candidates` are whatever the address search brought back; only exact key matches count.
 */
export function splitMembers(args: {
  developmentId: string
  bids: readonly MemberBid[]
  jobs: readonly MemberJob[]
}): { inIt: Members; atAddress: Members } {
  const inIt: Members = {
    bids: args.bids.filter((b) => b.development_id === args.developmentId),
    jobs: args.jobs.filter((j) => j.development_id === args.developmentId),
  }
  const keys = memberAddressKeys(inIt)
  const atAddress: Members = {
    bids: args.bids.filter((b) => b.development_id !== args.developmentId && keys.has(normalizeAddressKey(b.address))),
    jobs: args.jobs.filter((j) => j.development_id !== args.developmentId && keys.has(normalizeAddressKey(j.job_address))),
  }
  return { inIt, atAddress }
}

export type BidStatus = 'won' | 'lost' | 'sent' | 'working' | 'archived'

/**
 * One word for where a bid stands, read the way the Bid Board reads it: an outcome first, then
 * sent and waiting on the answer, then still being worked, and *archived* (the Bid Board's own word) when it was
 * archived off the working board with no outcome and no send (the real site's thirteen).
 */
export function bidStatusWord(bid: Pick<MemberBid, 'outcome' | 'bid_date_sent' | 'working_board_archived_at'>): BidStatus {
  const o = (bid.outcome ?? '').toLowerCase()
  if (o === 'won' || o === 'started_or_complete') return 'won'
  if (o === 'lost') return 'lost'
  if (bid.bid_date_sent) return 'sent'
  if (bid.working_board_archived_at) return 'archived'
  return 'working'
}

/** The saturated status colors the boards use: won green, lost red, sent amber (their move), working blue, archived grey. */
export const BID_STATUS_COLOR: Record<BidStatus, string> = {
  won: '#059669',
  lost: '#dc2626',
  sent: '#d97706',
  working: '#3b82f6',
  archived: '#9ca3af',
}

/** A bid is undecided until it is won or lost. */
export function bidUndecided(bid: Pick<MemberBid, 'outcome'>): boolean {
  const s = bidStatusWord({ outcome: bid.outcome, bid_date_sent: null, working_board_archived_at: null })
  return s !== 'won' && s !== 'lost'
}

/** The dollar figure a bid row shows: the agreed value once won, else the bid value, else the priced revenue. */
export function bidMoney(bid: Pick<MemberBid, 'outcome' | 'agreed_value' | 'bid_value' | 'priced_revenue_usd'>): number | null {
  if (bidStatusWord({ outcome: bid.outcome, bid_date_sent: null, working_board_archived_at: null }) === 'won' && bid.agreed_value != null) return bid.agreed_value
  return bid.bid_value ?? bid.priced_revenue_usd ?? null
}

/** A job is open until it is paid. */
export function jobOpen(job: Pick<MemberJob, 'status'>): boolean {
  return (job.status ?? '').toLowerCase() !== 'paid'
}

/** What a billed job still has open: revenue less what was paid, never under zero. */
export function jobOpenOnBill(job: Pick<MemberJob, 'status' | 'revenue' | 'payments_made'>): number {
  if ((job.status ?? '').toLowerCase() !== 'billed') return 0
  return Math.max(0, (job.revenue ?? 0) - (job.payments_made ?? 0))
}

export type HeadCounts = {
  waiting: { count: number; oldestAgeDays: number | null }
  bids: { total: number; undecided: number; sent: number; archived: number }
  jobs: { total: number; open: number; working: number }
  bidUndecidedUsd: number
  openOnBillsUsd: number
}

/** The head's counts, from the rows the page shows (members, or members plus the address matches when the toggle is on). */
export function headCounts(members: Members, requests: readonly MemberRequest[], nowMs: number): HeadCounts {
  const open = requests.filter(requestIsOpen)
  let oldest: number | null = null
  for (const r of open) {
    const age = Math.max(0, Math.floor((nowMs - Date.parse(r.created_at)) / 86_400_000))
    if (oldest === null || age > oldest) oldest = age
  }
  const undecided = members.bids.filter(bidUndecided)
  const sent = members.bids.filter((b) => bidStatusWord(b) === 'sent')
  const archived = members.bids.filter((b) => bidStatusWord(b) === 'archived')
  const openJobs = members.jobs.filter(jobOpen)
  return {
    waiting: { count: open.length, oldestAgeDays: oldest },
    bids: { total: members.bids.length, undecided: undecided.length, sent: sent.length, archived: archived.length },
    jobs: { total: members.jobs.length, open: openJobs.length, working: members.jobs.filter((j) => (j.status ?? '').toLowerCase() === 'working').length },
    bidUndecidedUsd: undecided.reduce((s, b) => s + (bidMoney(b) ?? 0), 0),
    openOnBillsUsd: members.jobs.reduce((s, j) => s + jobOpenOnBill(j), 0),
  }
}

export type SitePeople = {
  gcContact: { name: string; phone: string | null; email: string | null } | null
  estimating: string[]
  onSite: { names: string[]; jobLabel: string | null; since: string | null } | null
}

/**
 * The three names a leader wants before any table: the GC contact from the bids (the newest bid
 * that names one, a name of two letters or more), estimating from the bids' estimators (newest
 * first), on site from the crew of the job that is working (its team members), with the job's
 * last work date as *since*.
 */
export function sitePeople(args: {
  members: Members
  names: ReadonlyMap<string, string>
  teamMembers: ReadonlyArray<{ job_id: string; user_id: string }>
  jobLabel: (job: MemberJob) => string
}): SitePeople {
  const bidsNewestFirst = [...args.members.bids].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  let gcContact: SitePeople['gcContact'] = null
  for (const b of bidsNewestFirst) {
    const name = (b.gc_contact_name ?? '').trim()
    if (name.length >= 2) {
      gcContact = { name, phone: b.gc_contact_phone?.trim() || null, email: b.gc_contact_email?.trim() || null }
      break
    }
  }
  const estimating: string[] = []
  for (const b of bidsNewestFirst) {
    const n = b.estimator_id ? args.names.get(b.estimator_id) : null
    if (n && !estimating.includes(n)) estimating.push(n)
  }
  const working = args.members.jobs
    .filter((j) => (j.status ?? '').toLowerCase() === 'working')
    .sort((a, b) => (b.last_work_date ?? '').localeCompare(a.last_work_date ?? ''))
  let onSite: SitePeople['onSite'] = null
  const first = working[0]
  if (first) {
    const names: string[] = []
    for (const j of working) {
      for (const tm of args.teamMembers) {
        if (tm.job_id !== j.id) continue
        const n = args.names.get(tm.user_id)
        if (n && !names.includes(n)) names.push(n)
      }
    }
    onSite = { names, jobLabel: args.jobLabel(first), since: first.last_work_date }
  }
  return { gcContact, estimating, onSite }
}

/**
 * The house line's words on a Bid window or a Job window: the name, then the two reasons to
 * open the page (a question waiting, plans that changed), then *Open ›*. With nothing waiting and
 * no plans it is the name and *Open ›*.
 */
export function pulseWords(args: { name: string; openQuestions: number; oldestAgeDays: number | null; newestPlansShort: string | null }): string[] {
  const parts: string[] = [args.name]
  if (args.openQuestions > 0) {
    const q = args.openQuestions === 1 ? '1 question waiting' : `${args.openQuestions} questions waiting`
    parts.push(args.oldestAgeDays != null && args.oldestAgeDays > 0 ? `${q} · ${args.oldestAgeDays} ${args.oldestAgeDays === 1 ? 'day' : 'days'}` : q)
  }
  if (args.newestPlansShort) parts.push(`new plans ${args.newestPlansShort}`)
  return parts
}
