/**
 * The Pieces table (punch list #208, design spike): the site read piece by piece. Each bid sits on
 * the row with the job it became (`jobs_ledger.bid_id`, one direction); a job with no bid and a bid
 * with no job each take a row of their own; the done ones (paid jobs, lost bids) fold. The Waiting
 * cell reads an open request first, then a billed job's payment, then a sent bid's answer. Pure.
 */
import { bidStatusWord, bidUndecided, jobOpen, requestIsOpen, type MemberBid, type MemberJob, type MemberRequest, type Members } from './overview'
import { planCellFor, type PlansView, type PlanSet } from './plans'

export type PieceWaiting = {
  kind: 'question' | 'payment' | 'answer'
  /** Who the piece waits on: *Dispatch*, *the estimators*, the customer. */
  who: string
  /** What for, in a few words. */
  what: string
  ageDays: number
}

export type PieceRow = {
  key: string
  name: string
  bid: MemberBid | null
  job: MemberJob | null
  plans: { set: PlanSet | null; older: boolean }
  waiting: PieceWaiting | null
  done: boolean
  /** The newest stamp on the row, for the sort. */
  activityAt: string
}

function daysSince(iso: string | null | undefined, nowMs: number): number {
  if (!iso) return 0
  const t = Date.parse(iso.length === 10 ? `${iso}T12:00:00Z` : iso)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((nowMs - t) / 86_400_000))
}

function newest(...stamps: Array<string | null | undefined>): string {
  let best = ''
  for (const s of stamps) if (s && s > best) best = s
  return best
}

export function buildPieceRows(args: {
  members: Members
  requests: readonly MemberRequest[]
  plans: PlansView
  customerName: string | null
  nowMs: number
}): PieceRow[] {
  const jobsByBid = new Map<string, MemberJob[]>()
  const pairedJobIds = new Set<string>()
  for (const j of args.members.jobs) {
    if (!j.bid_id) continue
    const list = jobsByBid.get(j.bid_id) ?? []
    list.push(j)
    jobsByBid.set(j.bid_id, list)
  }
  const openRequestsFor = (bidId: string | null, jobId: string | null): MemberRequest | null => {
    let oldest: MemberRequest | null = null
    for (const r of args.requests) {
      if (!requestIsOpen(r)) continue
      if (!((bidId && r.bid_id === bidId) || (jobId && r.job_ledger_id === jobId))) continue
      if (!oldest || r.created_at < oldest.created_at) oldest = r
    }
    return oldest
  }
  const customer = args.customerName?.trim() || 'the customer'
  const waitingFor = (bid: MemberBid | null, job: MemberJob | null): PieceWaiting | null => {
    const q = openRequestsFor(bid?.id ?? null, job?.id ?? null)
    if (q) return { kind: 'question', who: q.lane === 'dispatch' ? 'Dispatch' : 'the estimators', what: q.title, ageDays: daysSince(q.created_at, args.nowMs) }
    if (job && (job.status ?? '').toLowerCase() === 'billed') return { kind: 'payment', who: customer, what: 'payment', ageDays: daysSince(job.last_bill_date, args.nowMs) }
    if (bid && bidStatusWord(bid) === 'sent' && bidUndecided(bid)) return { kind: 'answer', who: customer, what: 'answer', ageDays: daysSince(bid.bid_date_sent, args.nowMs) }
    return null
  }
  const rows: PieceRow[] = []
  for (const b of args.members.bids) {
    const jobs = jobsByBid.get(b.id) ?? []
    const status = bidStatusWord(b)
    if (jobs.length === 0) {
      rows.push({
        key: `bid:${b.id}`,
        name: (b.project_name ?? '').trim() || '—',
        bid: b,
        job: null,
        plans: planCellFor(args.plans, 'bid', b.id),
        waiting: waitingFor(b, null),
        done: status === 'lost',
        activityAt: newest(b.updated_at, b.outcome_at, b.bid_date_sent, b.created_at),
      })
      continue
    }
    for (const j of jobs) {
      pairedJobIds.add(j.id)
      const jobPlans = planCellFor(args.plans, 'job', j.id)
      rows.push({
        key: `bid:${b.id}:job:${j.id}`,
        name: (j.job_name ?? '').trim() || (b.project_name ?? '').trim() || '—',
        bid: b,
        job: j,
        plans: jobPlans.set ? jobPlans : planCellFor(args.plans, 'bid', b.id),
        waiting: waitingFor(b, j),
        done: !jobOpen(j),
        activityAt: newest(j.updated_at, j.last_work_date, j.created_at, b.updated_at),
      })
    }
  }
  for (const j of args.members.jobs) {
    if (pairedJobIds.has(j.id)) continue
    rows.push({
      key: `job:${j.id}`,
      name: (j.job_name ?? '').trim() || '—',
      bid: null,
      job: j,
      plans: planCellFor(args.plans, 'job', j.id),
      waiting: waitingFor(null, j),
      done: !jobOpen(j),
      activityAt: newest(j.updated_at, j.last_work_date, j.created_at),
    })
  }
  // Waiting rows first (the oldest wait on top), then the rest by what moved last.
  rows.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (!!a.waiting !== !!b.waiting) return a.waiting ? -1 : 1
    if (a.waiting && b.waiting && a.waiting.ageDays !== b.waiting.ageDays) return b.waiting.ageDays - a.waiting.ageDays
    return b.activityAt.localeCompare(a.activityAt)
  })
  return rows
}

/** The done fold's words: *2 paid jobs and 1 lost bid*. */
export function doneFoldWords(rows: readonly PieceRow[], money?: (n: number) => string): string {
  const done = rows.filter((r) => r.done)
  const paidRows = done.filter((r) => r.job && !jobOpen(r.job))
  const paid = paidRows.length
  const lost = done.length - paid
  const parts: string[] = []
  // The paid sum rides the fold as it rides the Money look's Paid head (the owner, 2026-10-28: *do all 8*, item 8).
  const paidUsd = paidRows.reduce((s, r) => s + (r.job?.revenue ?? 0), 0)
  if (paid > 0) parts.push(`${paid} paid ${paid === 1 ? 'job' : 'jobs'}${money && paidUsd > 0 ? ` · ${money(paidUsd)} all in` : ''}`)
  if (lost > 0) parts.push(`${lost} lost ${lost === 1 ? 'bid' : 'bids'}`)
  return parts.join(' and ')
}
