/**
 * Messages, cut 8b: one person's flow, as `flows/state.ts` reads it (`readFlow`), turned into the steps their own page
 * draws (`portalPage.ts`'s `PortalStepIn`). The trade partner's and the architect's first page read every lane through
 * `portalLanes`; the customer's Home reads one job through `customerJobSteps` (Your move takes the Once lane and the
 * job's Per job lane, Where you are the job's Per job lane alone). Nothing is read twice: the state is the flow's, and
 * this only says it the way the page takes it.
 *
 * - A step's state: done, on now, lapsed and skipped as read; next and later are both not reached yet.
 * - A done step's day is the day its facts turned true (the latest of them).
 * - A paper's mark is its fact's mark; a paper with no fact on the step reads nothing yet.
 * - Who a step waits on is said by what that contact is (`kindOf`): an architect, with the certificate when the step
 *   waited on is the architect's certify; the owner for a customer; else someone else.
 * - A round open now makes an aside or Any time step show on their page.
 * - What we owe them on a step (cut 2's owed day) comes in through `owedBy` once that cut lands.
 * Pure.
 */

import type { FlowKind, PaperId } from './facts'
import { factForPaper } from './facts'
import type { PortalLaneIn, PortalPaperRead, PortalStepIn, PortalStepWhere, PortalWaitingOn } from './portalPage'
import type { FlowDef, FlowReading, FlowStep, LaneReading, StepReading, StepState } from './state'

export interface PortalStepsOptions {
  /** What a contact a step waits on is, for "Waiting on your architect". Null when it is not known. */
  kindOf?: (contactId: string) => FlowKind | null
  /** The day we said we would have our part to them on a step, from what we owe them. Null when we owe nothing. */
  owedBy?: (stepId: string, jobId: string | null) => string | null
}

const WHERE: Record<StepState, PortalStepWhere> = { done: 'done', now: 'now', lapsed: 'lapsed', skipped: 'skipped', next: 'notYet', later: 'notYet' }

/** The architect's step a customer's pay application waits on. */
const CERTIFY_STEP = 'certify'

function waitingRole(kind: FlowKind | null): PortalWaitingOn {
  if (kind === 'arch') return 'architect'
  if (kind === 'customer') return 'owner'
  return 'other'
}

/** The day a done step's facts turned true: the latest of the true ones, as YYYY-MM-DD. */
function doneDay(reading: StepReading): string | null {
  const days = reading.facts.filter((f) => f.mark === 'ok' && f.at).map((f) => (f.at as string).slice(0, 10))
  return days.length ? days.reduce((a, b) => (b > a ? b : a)) : null
}

function paperReads(step: FlowStep, reading: StepReading): PortalPaperRead[] {
  return step.papers.map((paper: PaperId) => {
    const fact = reading.facts.find((f) => f.fact.paper === paper)
    return { id: paper, ours: !!factForPaper(paper)?.ours, mark: fact?.mark ?? 'no' }
  })
}

/** One step for their page. */
export function portalStepIn(step: FlowStep, reading: StepReading, opts: PortalStepsOptions = {}): PortalStepIn {
  const where = WHERE[reading.state]
  const w = reading.waitingOn
  return {
    id: step.id,
    name: { en: step.name, es: step.nameEs },
    who: step.who,
    where,
    decision: step.fork,
    loop: step.loop !== null,
    aside: step.aside,
    roundNow: reading.rounds.some((r) => r.state === 'now'),
    later: step.later,
    doneOn: where === 'done' ? doneDay(reading) : null,
    waitingOn: w ? { who: waitingRole(opts.kindOf?.(w.contactId) ?? null), forCertificate: w.stepId === CERTIFY_STEP } : null,
    papers: paperReads(step, reading),
    day: reading.day ? { on: reading.day.due, late: reading.day.late } : null,
    owedBy: opts.owedBy?.(step.id, reading.jobId) ?? null,
    month: null,
  }
}

function laneSteps(flow: FlowDef, lane: LaneReading, opts: PortalStepsOptions): PortalStepIn[] {
  const def = flow.lanes.find((l) => l.lane === lane.lane)
  if (!def) return []
  return def.steps.flatMap((step) => {
    const reading = lane.steps.find((s) => s.stepId === step.id)
    return reading ? [portalStepIn(step, reading, opts)] : []
  })
}

/**
 * A job is on their page once they are asked on it: something on it is done or ran out, or one of its rounds opened
 * (an ask that went, a question sent). A round the app knows is coming and nobody sent (Pad B's ask before the
 * invitation) keeps the job off, as main's trade portal lists only the asks a company has.
 */
export function askedOn(lane: LaneReading): boolean {
  return lane.steps.some((s) => s.state === 'done' || s.state === 'lapsed' || s.rounds.some((r) => r.opened !== null))
}

/**
 * Every lane of a trade partner's or an architect's flow, for `portalPage`: Once, one Per job lane per job they are
 * asked on (`askedOn`), by its name in `jobNames` (a job with no name there stays off), then Any time.
 */
export function portalLanes(flow: FlowDef, reading: FlowReading, jobNames: Readonly<Record<string, string>>, opts: PortalStepsOptions = {}): PortalLaneIn[] {
  const out: PortalLaneIn[] = []
  const jobs: { name: string; steps: PortalStepIn[] }[] = []
  for (const lane of reading.lanes) {
    if (lane.lane !== 'per_job' || !lane.jobId || !askedOn(lane)) continue
    const name = jobNames[lane.jobId]
    if (name !== undefined) jobs.push({ name, steps: laneSteps(flow, lane, opts) })
  }
  for (const def of flow.lanes) {
    if (def.lane === 'once') {
      const lane = reading.lanes.find((l) => l.lane === 'once')
      out.push({ lane: 'once', steps: lane ? laneSteps(flow, lane, opts) : [] })
    } else if (def.lane === 'per_job') {
      out.push({ lane: 'perJob', jobs })
    } else {
      const lane = reading.lanes.find((l) => l.lane === 'any_time')
      out.push({ lane: 'anyTime', steps: lane ? laneSteps(flow, lane, opts) : [] })
    }
  }
  return out
}

/** A customer's steps for one job: the Once lane, then the job's Per job lane, in the flow's order. */
export function customerJobSteps(flow: FlowDef, reading: FlowReading, jobId: string, opts: PortalStepsOptions = {}): { once: PortalStepIn[]; perJob: PortalStepIn[] } {
  const once = reading.lanes.find((l) => l.lane === 'once')
  const job = reading.lanes.find((l) => l.lane === 'per_job' && l.jobId === jobId)
  return { once: once ? laneSteps(flow, once, opts) : [], perJob: job ? laneSteps(flow, job, opts) : [] }
}
