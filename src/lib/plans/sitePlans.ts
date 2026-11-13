/**
 * Plan sets by part (punch list #239, PR 3): the Development page's Plans look by part. Each part of
 * the site with the set it builds from today, its older sets and our as-builts, and the jobs that name
 * it; then the jobs that build from plans and name no part, and the parts with no set, which are the
 * only two things left for a person to settle. A job can never be "on an older set" here, because a
 * job follows its part. A job that carries bills only, or a service call priced by the work, never
 * builds from plans (v2.6351: on the real site 24 billing holders and repairs read as 24 things to
 * fix), so it is left out of the count and named under the chip with its reason. Bids pin their own
 * sets (`bids.plans_link`, `bid_plan_sets`) and are listed as pinned. Pure.
 */
import { jobKindOfRow, type JobKindRowLike } from '../jobs/jobKind'
import { buildJobPlansView, compareSets, isDrawingSet, type PlanPartRow, type PlanSetRow } from './planSets'

/** A job or bid as the look names it; `name` is the job's name (its address when it has none), the words a person picks a part by. */
export type SiteCarrier = { kind: 'job' | 'bid'; id: string; label: string; name?: string | null }

/** A job as the look takes it: its part, and the facts the job-kind kernel reads (a fact not loaded is skipped, never guessed). */
export type SiteJobInput = { id: string; label: string; plan_part_id?: string | null; name?: string | null } & Pick<JobKindRowLike, 'kind' | 'hcp_number' | 'click_number' | 'bid_id' | 'project_id' | 'revenue' | 'status' | 'billing_only'>

export type NoPlansWhy = 'billing_only' | 'service'

/** A job on no part that the count leaves out, with why it needs no plans. */
export type SiteJobLeftOut = SiteCarrier & { why: NoPlansWhy }

/**
 * Why a job needs no plans: it carries a GC project's bills and nothing else (`billing_only`), or it is a
 * service call, priced by the work (`jobKind`, the office's explicit kind first). Null when it builds from
 * plans, or when nothing loaded says it does not: a job of no known kind still counts.
 */
export function jobNeedsNoPlans(job: Pick<SiteJobInput, 'kind' | 'hcp_number' | 'click_number' | 'bid_id' | 'project_id' | 'revenue' | 'status' | 'billing_only'>): NoPlansWhy | null {
  if (job.billing_only === true) return 'billing_only'
  if (jobKindOfRow(job).kind === 'service') return 'service'
  return null
}

export type SitePartRow = {
  part: PlanPartRow
  current: PlanSetRow | null
  replaced: PlanSetRow | null
  older: PlanSetRow[]
  asBuilts: PlanSetRow[]
  jobs: SiteCarrier[]
}

export type SitePlansView = {
  parts: SitePartRow[]
  /** The jobs on the site that build from plans and name no part. */
  jobsWithNoPart: SiteCarrier[]
  /** The jobs on no part the count leaves out, each with why it needs no plans. */
  jobsNeedingNoPlans: SiteJobLeftOut[]
  /** The parts with no set to build from. */
  partsWithNoSet: SitePartRow[]
  /** Every set on every part, as-builts included. */
  setCount: number
  /** The bids with a pinned set of their own (a plans link), as the look lists them. */
  bidsPinned: Array<SiteCarrier & { link: string }>
}

export function buildSitePlansView(args: {
  parts: ReadonlyArray<PlanPartRow>
  sets: ReadonlyArray<PlanSetRow>
  jobs: ReadonlyArray<SiteJobInput>
  bids: ReadonlyArray<{ id: string; label: string; plans_link?: string | null }>
}): SitePlansView {
  const ordered = [...args.parts].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
  const parts: SitePartRow[] = ordered.map((part) => {
    const v = buildJobPlansView(part, args.sets)
    return {
      part,
      current: v.current,
      replaced: v.replaced,
      older: v.older,
      asBuilts: v.asBuilts,
      jobs: args.jobs.filter((j) => j.plan_part_id === part.id).map((j) => ({ kind: 'job' as const, id: j.id, label: j.label, name: j.name ?? null })),
    }
  })
  const partIds = new Set(ordered.map((p) => p.id))
  const onNoPart = args.jobs.filter((j) => !j.plan_part_id || !partIds.has(j.plan_part_id))
  const jobsWithNoPart: SiteCarrier[] = []
  const jobsNeedingNoPlans: SiteJobLeftOut[] = []
  for (const j of onNoPart) {
    const why = jobNeedsNoPlans(j)
    if (why) jobsNeedingNoPlans.push({ kind: 'job', id: j.id, label: j.label, name: j.name ?? null, why })
    else jobsWithNoPart.push({ kind: 'job', id: j.id, label: j.label, name: j.name ?? null })
  }
  const partsWithNoSet = parts.filter((r) => !r.current)
  const setCount = args.sets.filter((s) => partIds.has(s.part_id) && isDrawingSet(s)).length
  const bidsPinned = args.bids
    .filter((b) => (b.plans_link ?? '').trim())
    .map((b) => ({ kind: 'bid' as const, id: b.id, label: b.label, link: (b.plans_link ?? '').trim() }))
  return { parts, jobsWithNoPart, jobsNeedingNoPlans, partsWithNoSet, setCount, bidsPinned }
}

/** *2 jobs follow no plans yet*, *1 job follows no plans yet*. */
function followNoPlansWords(n: number): string {
  return `${n} ${n === 1 ? 'job follows' : 'jobs follow'} no plans yet`
}

/** The strip's plain count: *5 sets on 4 parts*, *no part yet*. */
export function sitePlansCountWords(view: SitePlansView): string {
  if (view.parts.length === 0) return 'no part yet'
  const sets = `${view.setCount} ${view.setCount === 1 ? 'set' : 'sets'}`
  return `${sets} on ${view.parts.length} ${view.parts.length === 1 ? 'part' : 'parts'}`
}

/** The strip's amber words: what still needs a person. Null when every job names a part that has a set. */
export function sitePlansNeedWords(view: SitePlansView): string | null {
  const bits: string[] = []
  if (view.partsWithNoSet.length) bits.push(`${view.partsWithNoSet.length} ${view.partsWithNoSet.length === 1 ? 'part' : 'parts'} with no set`)
  if (view.jobsWithNoPart.length) bits.push(followNoPlansWords(view.jobsWithNoPart.length))
  return bits.length ? bits.join(' · ') : null
}

/** The chip under the table for the parts with no set, and the one for the jobs that build from plans and name no part. */
export function sitePlansChipWords(view: SitePlansView): { noSet: string | null; noPart: string | null; allGood: string | null } {
  const noSet = view.partsWithNoSet.length ? `${view.partsWithNoSet.length} ${view.partsWithNoSet.length === 1 ? 'part' : 'parts'} with no set` : null
  const noPart = view.jobsWithNoPart.length ? followNoPlansWords(view.jobsWithNoPart.length) : null
  const allGood = !noSet && !noPart && view.parts.length > 0 ? 'every job that builds from plans names a part with a set' : null
  return { noSet, noPart, allGood }
}

/**
 * The quiet line for the jobs the count leaves out: *22 jobs need no plans: 20 bill only, 2 are service calls*.
 * Null when every job on no part builds from plans.
 */
export function sitePlansLeftOutWords(view: SitePlansView): string | null {
  const n = view.jobsNeedingNoPlans.length
  if (!n) return null
  const bills = view.jobsNeedingNoPlans.filter((j) => j.why === 'billing_only').length
  const calls = n - bills
  const bits: string[] = []
  if (bills) bits.push(`${bills} ${bills === 1 ? 'bills' : 'bill'} only`)
  if (calls) bits.push(`${calls} ${calls === 1 ? 'is a service call' : 'are service calls'}`)
  return `${n} ${n === 1 ? 'job needs' : 'jobs need'} no plans: ${bits.join(', ')}`
}

/** How many pieces the ask is about: the jobs that follow no plans yet and the parts with no set. */
export function sitePlansAskCount(view: SitePlansView): number {
  return view.jobsWithNoPart.length + view.partsWithNoSet.length
}

/** The older sets of a part, newest first, for the fold under its row. */
export function olderSetsFor(row: SitePartRow): PlanSetRow[] {
  return [...row.older].sort(compareSets)
}

/**
 * The jobs on no part in the order a person picks parts for them (the Gray Fox spike, 2026-11-02: the
 * owner on a grid of bare numbers, *I need a good way to see the job names so a human can quickly make
 * decisions*): by name, so the *ATV building* jobs sit together and the *Bunker* ones after them, the
 * nameless last, ties by number.
 */
export function orderForPicking<T extends SiteCarrier>(rows: ReadonlyArray<T>): T[] {
  const key = (c: T) => (c.name ?? '').trim().toLocaleLowerCase()
  return [...rows].sort((a, b) => {
    const an = key(a)
    const bn = key(b)
    if (!an !== !bn) return an ? -1 : 1
    return an.localeCompare(bn, undefined, { numeric: true }) || a.label.localeCompare(b.label, undefined, { numeric: true })
  })
}
