/**
 * Job accounts on the Bid Board, PR 1b (to-dos/bid-board-job-accounts): the
 * **Job accounts lens** — every won or started bid whose job still needs a
 * supply-house account, soonest first parts run first, grouped by house so
 * the estimator asks each rep once. The rows are the page-wide
 * `list_bid_job_account_strip` read (v2.3520) joined to the bids' start
 * dates. Pure; the hook, the sheet and the email stay outside.
 */
import type { BidJobAccountRow } from '../../hooks/useBidJobAccountStrip'
import { chipStateOf, housesOnJob, stripJob } from './bidBoardJobAccounts'

/** What the lens needs from a bid row — the page maps `BidWithBuilder` to this. */
export interface JobAccountsLensBid {
  id: string
  label: string
  projectName: string | null
  gcName: string | null
  address: string | null
  estimatorName: string | null
  estimatorUserId: string | null
  accountManagerUserId: string | null
  /** `bids.estimated_job_start_date` — the first parts run, roughly. */
  startDate: string | null
  /** `bids.bid_won_date` (or the outcome's date) — shown when there is no start date. */
  wonDate: string | null
}

export type JobAccountsLensState = 'none' | 'requested'

export interface JobAccountsLensRow {
  key: string
  bidId: string
  bidLabel: string
  projectName: string
  gcName: string | null
  estimatorName: string | null
  isMine: boolean
  /** null = the bid is won but nobody opened the job yet. */
  job: { id: string; hcpNumber: string | null; clickNumber: string | null; name: string | null } | null
  jobAddress: string | null
  houseId: string
  houseName: string
  state: JobAccountsLensState
  requestedAt: string | null
  quoted: boolean
  policy: string | null
  rep: { id: string; name: string; email: string | null; phone: string | null } | null
  startDate: string | null
  wonDate: string | null
  /** Days from today to the start date; null when the bid has none. */
  daysUntilStart: number | null
}

export interface JobAccountsLensGroup {
  houseId: string
  houseName: string
  /** The house's job-accounts rep from the strip (first row that names one). */
  rep: { id: string; name: string; email: string | null; phone: string | null } | null
  rows: JobAccountsLensRow[]
}

export interface JobAccountsLens {
  groups: JobAccountsLensGroup[]
  /** Distinct jobs with at least one house missing — the same count the board's header shows. */
  jobsMissing: number
  /** Won bids with no job yet (listed under the houses that quoted them). */
  bidsWithoutJob: number
  rows: number
}

const DAY_MS = 86_400_000

function noon(iso: string): Date | null {
  const v = iso.trim()
  if (!v) return null
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v)
  if (Number.isNaN(d.getTime())) return null
  d.setHours(12, 0, 0, 0)
  return d
}

export function daysUntil(startDate: string | null | undefined, today: Date): number | null {
  if (!startDate) return null
  const d = noon(startDate)
  if (!d) return null
  const t = new Date(today)
  t.setHours(12, 0, 0, 0)
  return Math.round((d.getTime() - t.getTime()) / DAY_MS)
}

/** `in 3 days` · `today` · `2 days ago` · `no date`. */
export function describeStart(days: number | null): string {
  if (days == null) return 'no date'
  if (days === 0) return 'today'
  if (days === 1) return 'in 1 day'
  if (days === -1) return '1 day ago'
  return days > 0 ? `in ${days} days` : `${-days} days ago`
}

/** The urgency colour the row wears: red inside three days (or past), amber inside ten. */
export function startTone(days: number | null): 'red' | 'amber' | null {
  if (days == null) return null
  if (days <= 3) return 'red'
  if (days <= 10) return 'amber'
  return null
}

function repOf(row: BidJobAccountRow): JobAccountsLensRow['rep'] {
  return row.rep_contact_id && row.rep_name ? { id: row.rep_contact_id, name: row.rep_name, email: row.rep_email, phone: row.rep_phone } : null
}

function rowOf(bid: JobAccountsLensBid, r: BidJobAccountRow, job: JobAccountsLensRow['job'], authUserId: string | null, today: Date): JobAccountsLensRow {
  const state = chipStateOf(r)
  return {
    key: `${bid.id}:${r.supply_house_id}`,
    bidId: bid.id,
    bidLabel: bid.label,
    projectName: (bid.projectName ?? '').trim() || (job?.name ?? '').trim() || bid.label,
    gcName: bid.gcName,
    estimatorName: bid.estimatorName,
    isMine: !!authUserId && (bid.estimatorUserId === authUserId || bid.accountManagerUserId === authUserId),
    job,
    jobAddress: r.job_address ?? bid.address,
    houseId: r.supply_house_id,
    houseName: r.house_name,
    state: state === 'requested' ? 'requested' : 'none',
    requestedAt: r.requested_at,
    quoted: r.quoted,
    policy: r.policy,
    rep: repOf(r),
    startDate: bid.startDate,
    wonDate: bid.wonDate,
    daysUntilStart: daysUntil(bid.startDate, today),
  }
}

function byStart(a: JobAccountsLensRow, b: JobAccountsLensRow): number {
  const da = a.daysUntilStart
  const db = b.daysUntilStart
  if (da != null && db != null && da !== db) return da - db
  if (da != null && db == null) return -1
  if (da == null && db != null) return 1
  // No start date on either: the older win first (it has waited longer).
  const wa = a.wonDate ?? ''
  const wb = b.wonDate ?? ''
  if (wa !== wb) return wa < wb ? -1 : 1
  return a.bidLabel.localeCompare(b.bidLabel, undefined, { numeric: true })
}

/**
 * The lens: one row per (bid, house still missing). A bid with a job lists
 * its missing houses (none · requested); a won bid with no job lists every
 * house the strip names for it (the houses that quoted it, and those that
 * expect an account) with `job: null`. Groups are by house, biggest first,
 * rows soonest first parts run first.
 */
export function buildJobAccountsLens(
  bids: readonly JobAccountsLensBid[],
  byBid: ReadonlyMap<string, BidJobAccountRow[]>,
  opts: { authUserId: string | null; today: Date; onlyMine?: boolean },
): JobAccountsLens {
  const groups = new Map<string, JobAccountsLensGroup>()
  const jobs = new Set<string>()
  let bidsWithoutJob = 0
  let rows = 0
  for (const bid of bids) {
    const strip = byBid.get(bid.id)
    if (!strip || strip.length === 0) continue
    const job = stripJob(strip)
    const candidates = job ? housesOnJob(strip).filter((r) => chipStateOf(r) === 'none' || chipStateOf(r) === 'requested') : strip
    const lensRows = candidates.map((r) => rowOf(bid, r, job, opts.authUserId, opts.today)).filter((r) => !opts.onlyMine || r.isMine)
    if (lensRows.length === 0) continue
    if (job) jobs.add(job.id)
    else bidsWithoutJob++
    for (const r of lensRows) {
      rows++
      const g = groups.get(r.houseId)
      if (g) {
        g.rows.push(r)
        if (!g.rep && r.rep) g.rep = r.rep
      } else groups.set(r.houseId, { houseId: r.houseId, houseName: r.houseName, rep: r.rep, rows: [r] })
    }
  }
  const list = [...groups.values()]
  for (const g of list) g.rows.sort(byStart)
  list.sort((a, b) => b.rows.length - a.rows.length || a.houseName.localeCompare(b.houseName))
  return { groups: list, jobsMissing: jobs.size, bidsWithoutJob, rows }
}

/** The rows one email to this house's rep can cover: a job exists and nobody has asked yet. */
export function emailableRows(group: JobAccountsLensGroup): JobAccountsLensRow[] {
  return group.rows.filter((r) => r.job != null && r.state === 'none')
}

/** `Ask Curly for both` · `Ask Curly for all three` · `Ask Curly`. */
export function askRepLabel(repName: string | null, count: number): string {
  const first = (repName ?? '').trim().split(/\s+/)[0] || 'the rep'
  if (count <= 1) return `Ask ${first}`
  if (count === 2) return `Ask ${first} for both`
  const words: Record<number, string> = { 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine' }
  return `Ask ${first} for all ${words[count] ?? count}`
}

/** The lens's rollup: `3 jobs · 2 houses` (+ ` · 1 bid with no job yet`). */
export function lensRollup(lens: JobAccountsLens): string {
  const parts = [`${lens.jobsMissing} job${lens.jobsMissing === 1 ? '' : 's'}`, `${lens.groups.length} house${lens.groups.length === 1 ? '' : 's'}`]
  if (lens.bidsWithoutJob > 0) parts.push(`${lens.bidsWithoutJob} won bid${lens.bidsWithoutJob === 1 ? '' : 's'} with no job yet`)
  return parts.join(' · ')
}
