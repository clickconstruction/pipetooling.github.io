/**
 * The bid pins what it was priced on (punch list #239, PR 4; the column is migration `20261102060000`). A bid
 * carries set rows (`bid_plan_sets`) and the link the robot reads; `bids.priced_on_set_id` names the row the
 * price stands on. Null means the set the robot reads, so an old bid needs no backfill. A job opened from the
 * bid starts its part building from that set (the migration's trigger), and when that part later moves on to a
 * newer set, the bid form says so in amber. Pure.
 */
import { planSetDateWords, samePlanLink, type PlanSetItem } from './bidPlanSets'
import { jobShortLabel } from '../plans/planSets'

/** One row of `list_bid_jobs_plan_state`: a job opened from the bid, the part it names and the set the part builds from. */
export type BidJobPlanState = {
  bid_id: string
  job_id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  part_id: string | null
  part_name: string | null
  set_id: string | null
  set_name: string | null
  set_kind: string | null
  set_dated: string | null
  set_link: string | null
  set_came_at: string | null
}

export const PRICED_ON_WORDS = {
  chip: 'Priced on',
  press: 'Priced on this set',
  pressTitle: 'Pin this set as the one the price stands on. A job opened from the bid starts building from it.',
  openJob: (label: string) => `Open ${label} ›`,
} as const

/** The set the bid was priced on: the pinned row, else the set the robot reads. Null when the bid has no plans. */
export function pricedOnItem(items: ReadonlyArray<PlanSetItem>, pricedOnSetId: string | null | undefined): PlanSetItem | null {
  if (pricedOnSetId) {
    const pinned = items.find((i) => i.id === pricedOnSetId && !i.onBid)
    if (pinned) return pinned
  }
  return items.find((i) => i.robotReads) ?? items[0] ?? null
}

/** Whether the priced-on set is a pin (a row the office chose) or the fallback to the robot's set. */
export function pricedOnIsPinned(items: ReadonlyArray<PlanSetItem>, pricedOnSetId: string | null | undefined): boolean {
  return !!pricedOnSetId && items.some((i) => i.id === pricedOnSetId && !i.onBid)
}

/**
 * The line under the sets: *Priced on Issued set · Sep 14, 2026.* when pinned; with no pin, *Priced on Issued set,
 * the set the robot reads, since none is pinned.* Null when the bid has no plans or only its own link.
 */
export function pricedOnLine(items: ReadonlyArray<PlanSetItem>, pricedOnSetId: string | null | undefined): string | null {
  const priced = pricedOnItem(items, pricedOnSetId)
  if (!priced || priced.onBid) return null
  const date = planSetDateWords(priced.planDate)
  if (pricedOnIsPinned(items, pricedOnSetId)) return `Priced on ${priced.name}${date ? ` · ${date}` : ''}.`
  return `Priced on ${priced.name}, the set the robot reads, since none is pinned.`
}

export type PartMovedOnNote = {
  partId: string
  partName: string
  /** The jobs on the part, by their short labels, as the words name them. */
  jobs: Array<{ id: string; label: string }>
  setName: string
  setDated: string | null
  setLink: string
  words: string
}

function joinLabels(labels: ReadonlyArray<string>): string {
  if (labels.length <= 1) return labels[0] ?? ''
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

/**
 * The amber notes: one per part whose current set is not the set the bid was priced on (by link, as
 * `samePlanLink` reads two spellings of one Drive link). A job with no part, or on a part with no set, says
 * nothing; the hand-off made the part from the bid's set, so a difference means the part moved on.
 */
export function partMovedOnNotes(priced: PlanSetItem | null, states: ReadonlyArray<BidJobPlanState>): PartMovedOnNote[] {
  if (!priced) return []
  const byPart = new Map<string, PartMovedOnNote>()
  for (const s of states) {
    if (!s.part_id || !s.set_id || !s.set_link || !s.set_name) continue
    if (samePlanLink(s.set_link, priced.link)) continue
    const job = { id: s.job_id, label: jobShortLabel({ click_number: s.click_number, hcp_number: s.hcp_number, job_name: s.job_name }) }
    const have = byPart.get(s.part_id)
    if (have) {
      if (!have.jobs.some((j) => j.id === job.id)) have.jobs.push(job)
      continue
    }
    byPart.set(s.part_id, { partId: s.part_id, partName: s.part_name ?? 'its part', jobs: [job], setName: s.set_name, setDated: s.set_dated, setLink: s.set_link, words: '' })
  }
  return [...byPart.values()].map((n) => {
    const date = n.setDated ? planSetDateWords(n.setDated) : null
    const verb = n.jobs.length === 1 ? 'builds' : 'build'
    return { ...n, words: `On ${n.partName}, ${joinLabels(n.jobs.map((j) => j.label))} now ${verb} from ${n.setName}${date ? `, dated ${date}` : ''}. This bid was priced on ${priced.name}.` }
  })
}
