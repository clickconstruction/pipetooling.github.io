/**
 * The Plans card (punch list #208, design spike): every plan set on the site, newest first,
 * with the records that carry it, and the records on an older set or none. A set is a plans
 * link (`bids.plans_link`, `jobs_ledger.job_plans_link`); its date is the bid's
 * `design_drawing_plan_date` when one is filed, else the day the link was filed (the bid
 * history ledger `bid_changes`, or the job's update). Pure.
 */
import type { MemberBid, MemberJob, Members } from './overview'

export type PlanCarrier = { kind: 'bid' | 'job'; id: string; label: string }

export type PlanSet = {
  /** The link itself, which is what makes two records "the same set". */
  key: string
  link: string
  /** The set's own date (a bid's design drawing plan date), as a YYYY-MM-DD, or null when none was filed. */
  dated: string | null
  /** When the link was filed, an ISO stamp, or null when nothing recorded it. */
  filedAt: string | null
  filedBy: string | null
  carriers: PlanCarrier[]
}

export type PlansView = {
  /** Newest first: dated sets by date, then undated by the day filed. */
  sets: PlanSet[]
  /** The set the page calls newest, or null with no set on the site. */
  newest: PlanSet | null
  /** Members with no set at all. */
  none: PlanCarrier[]
  /** Members on a set that is not the newest, plus those with none: the line's count. */
  olderOrNone: PlanCarrier[]
}

export type PlansLinkChange = { bid_id: string; changed_at: string; changed_by: string | null; changed: string[] }

export function buildPlansView(args: {
  members: Members
  bidChanges: readonly PlansLinkChange[]
  names: ReadonlyMap<string, string>
  bidLabel: (bid: MemberBid) => string
  jobLabel: (job: MemberJob) => string
}): PlansView {
  const sets = new Map<string, PlanSet>()
  const none: PlanCarrier[] = []
  const filedFor = (bidId: string): { at: string; by: string | null } | null => {
    let best: { at: string; by: string | null } | null = null
    for (const c of args.bidChanges) {
      if (c.bid_id !== bidId || !c.changed.includes('plans_link')) continue
      if (!best || c.changed_at > best.at) best = { at: c.changed_at, by: c.changed_by }
    }
    return best
  }
  for (const b of args.members.bids) {
    const link = (b.plans_link ?? '').trim()
    const carrier: PlanCarrier = { kind: 'bid', id: b.id, label: args.bidLabel(b) }
    if (!link) {
      none.push(carrier)
      continue
    }
    const set = sets.get(link) ?? { key: link, link, dated: null, filedAt: null, filedBy: null, carriers: [] }
    if (b.design_drawing_plan_date && (!set.dated || b.design_drawing_plan_date > set.dated)) set.dated = b.design_drawing_plan_date
    const filed = filedFor(b.id)
    if (filed && (!set.filedAt || filed.at > set.filedAt)) {
      set.filedAt = filed.at
      set.filedBy = filed.by ? (args.names.get(filed.by) ?? null) : null
    }
    set.carriers.push(carrier)
    sets.set(link, set)
  }
  for (const j of args.members.jobs) {
    const link = (j.job_plans_link ?? '').trim()
    const carrier: PlanCarrier = { kind: 'job', id: j.id, label: args.jobLabel(j) }
    if (!link) {
      none.push(carrier)
      continue
    }
    const set = sets.get(link) ?? { key: link, link, dated: null, filedAt: null, filedBy: null, carriers: [] }
    // A job records no plans-link change; the row's update is the nearest thing to the day it was filed.
    if (!set.filedAt && j.updated_at) set.filedAt = j.updated_at
    set.carriers.push(carrier)
    sets.set(link, set)
  }
  const ordered = [...sets.values()].sort((a, b) => {
    if (a.dated && b.dated) return b.dated.localeCompare(a.dated)
    if (a.dated) return -1
    if (b.dated) return 1
    return (b.filedAt ?? '').localeCompare(a.filedAt ?? '')
  })
  const newest = ordered[0] ?? null
  const olderOrNone: PlanCarrier[] = [...none]
  for (const s of ordered) if (s !== newest) olderOrNone.push(...s.carriers)
  return { sets: ordered, newest, none, olderOrNone }
}

/** The Pieces cell: the set a record carries and whether it is older than the newest, or none. */
export function planCellFor(view: PlansView, kind: 'bid' | 'job', id: string): { set: PlanSet | null; older: boolean } {
  for (const s of view.sets) {
    if (s.carriers.some((c) => c.kind === kind && c.id === id)) return { set: s, older: view.newest !== null && s !== view.newest }
  }
  return { set: null, older: false }
}

/**
 * The strip's amber words for the Plans look: the pieces with no plans at all, or the pieces not on
 * the newest set (an older one, or none); null when every piece is on the newest.
 */
export function plansNeedWords(view: PlansView): string | null {
  const n = view.olderOrNone.length
  if (n === 0) return null
  return view.none.length === n ? `${n} without plans` : `${n} not on the newest`
}

/**
 * The line under the Plans table, with its subject on it (the owner, 2026-10-28: *I don't understand
 * the subject of "set filed Oct 28 is the newest · 42 on an older one or none"*). `newestDay` is the
 * newest set's day as the card prints it (*Oct 20*, or *the one filed Oct 28*). The lead is the
 * short amber words; the sentence says which pieces, and what they lack.
 */
export function olderOrNoneLine(view: PlansView, newestDay: string | null): { lead: string; sentence: string } | null {
  const n = view.olderOrNone.length
  if (n === 0) return null
  const none = view.none.length
  const older = n - none
  const pieces = (k: number) => (k === 1 ? 'One piece' : `${k} pieces`)
  const have = (k: number) => (k === 1 ? 'has' : 'have')
  const are = (k: number) => (k === 1 ? 'is' : 'are')
  if (!view.newest || !newestDay) return { lead: `${n} without plans`, sentence: `${pieces(n)} ${have(n)} no plans filed. No set is filed on this site.` }
  if (older === 0) return { lead: `${n} without plans`, sentence: `${pieces(n)} ${have(n)} no plans filed. The newest set is ${newestDay}.` }
  if (none === 0) return { lead: `${n} on an older set`, sentence: `${pieces(n)} ${are(n)} on an older set than ${newestDay}.` }
  return { lead: `${n} not on the newest`, sentence: `${pieces(older)} ${are(older)} on an older set than ${newestDay}, and ${none === 1 ? 'one' : none} ${have(none)} no plans filed.` }
}
