/**
 * What How it is going reads (`going.ts`), from where each person stands on their flow. `going.ts` takes the times a
 * company went through a step (`StepSpan`) and its runs through the per-job lane (`FunnelRun`); nothing kept them.
 * Here they are read from the same stamps the boards read (`readFlow` over `flow_rows_kind`), so How it is going and
 * the boards agree, and no table is added.
 *
 * A step's time runs from the day it came on to the day it was done. It came on the day the step before it in its
 * lane's chain finished: `readFlow`'s rule for a step on now (`since`), kept here for a done one. A lane's first step,
 * with no step before it, came on with its own first fact. A step on now runs from its `since`, a lapsed one from the
 * day it lapsed, and neither has an end yet. A loop's rounds are each a time through the step, from the day the round
 * opened, else the day the round before it finished. Pure.
 */
import type { FactId } from './facts'
import type { FunnelRun, StepSpan } from './going'
import type { FactReading, FlowDef, FlowReading, LaneReading, StepReading } from './state'

/** A person on a flow, as How it is going reads them. */
export interface GoingPerson {
  contactId: string
  reading: FlowReading
}

/** The latest day among facts that read true: the day a step finished (`state.ts`'s rule). */
function finishedOn(facts: readonly FactReading[]): string | null {
  let best: string | null = null
  for (const f of facts) if (f.mark === 'ok' && f.at && (best == null || f.at > best)) best = f.at
  return best
}

/** The earliest day any fact was stamped: the day a lane's first step came on. */
function firstStamp(facts: readonly FactReading[]): string | null {
  let first: string | null = null
  for (const f of facts) if (f.at && (first == null || f.at < first)) first = f.at
  return first
}

/** The fact last to turn true on a step every fact finishes; a fork ends on either, so it has none. */
function lastFactOf(facts: readonly FactReading[], fork: boolean): FactId | null {
  if (fork) return null
  let last: FactReading | null = null
  for (const f of facts) if (f.mark === 'ok' && f.at && (last == null || (last.at != null && f.at > last.at))) last = f
  return last?.fact.id ?? null
}

/** What the walk needs of a step's definition. */
interface StepShape {
  fork: boolean
  aside: boolean
  facts: number
  loop: boolean
}

/** Whether a step is in its lane's chain: what `readFlow` passes over when it looks for the step before. */
const inChain = (s: StepReading, facts: number, aside: boolean): boolean => s.state !== 'skipped' && !aside && facts > 0

/** A loop's rounds as times through the step. */
function roundSpans(contactId: string, s: StepReading, fork: boolean): StepSpan[] {
  const out: StepSpan[] = []
  let before: string | null = null
  for (const r of s.rounds) {
    const from = r.opened ?? before ?? firstStamp(r.facts)
    const to = r.state === 'done' ? finishedOn(r.facts) : null
    if (from && (r.state === 'done' || r.state === 'now')) {
      out.push({ stepId: s.stepId, contactId, jobId: s.jobId, from, to, lastFact: to ? lastFactOf(r.facts, fork) : null })
    }
    if (to) before = to
  }
  return out
}

/** The steps' spans on one lane, walking its chain in order. */
function laneSpans(contactId: string, lane: LaneReading, steps: Readonly<Record<string, StepShape>>): StepSpan[] {
  const out: StepSpan[] = []
  // The day the nearest step before in the chain finished, whatever its state: `readFlow`'s rule for `since`.
  let before: string | null = null
  for (const s of lane.steps) {
    const def = steps[s.stepId]
    if (!def) continue
    if (def.loop) {
      out.push(...roundSpans(contactId, s, def.fork))
      if (inChain(s, def.facts, def.aside)) before = finishedOn(s.rounds.filter((r) => r.state === 'done').flatMap((r) => r.facts))
      continue
    }
    if (!inChain(s, def.facts, def.aside)) {
      // An aside step runs off the chain: from its first stamp.
      if (def.aside && (s.state === 'done' || s.state === 'now')) {
        const to = s.state === 'done' ? finishedOn(s.facts) : null
        const from = firstStamp(s.facts) ?? to
        if (from) out.push({ stepId: s.stepId, contactId, jobId: s.jobId, from, to, lastFact: to ? lastFactOf(s.facts, def.fork) : null })
      }
      continue
    }
    if (s.state === 'done') {
      const to = finishedOn(s.facts)
      const from = before ?? firstStamp(s.facts) ?? to
      if (from && to) out.push({ stepId: s.stepId, contactId, jobId: s.jobId, from: from > to ? to : from, to, lastFact: lastFactOf(s.facts, def.fork) })
    } else if (s.state === 'now' || s.state === 'lapsed') {
      const from = s.since ?? before ?? firstStamp(s.facts)
      if (from) out.push({ stepId: s.stepId, contactId, jobId: s.jobId, from, to: null, lastFact: null })
    }
    before = finishedOn(s.facts)
  }
  return out
}

/** One person's run through a per-job lane: from the ask, every fact that turned true, and whether it ended. */
function laneRun(contactId: string, lane: LaneReading, off: boolean): FunnelRun | null {
  if (lane.lane !== 'per_job' || !lane.jobId) return null
  // The day it began: the first stamp on the lane, or the first round opened (an ask opens a round before any fact).
  const days = [
    firstStamp(lane.steps.flatMap((s) => [...s.facts, ...s.rounds.flatMap((r) => r.facts)])),
    ...lane.steps.flatMap((s) => s.rounds.map((r) => r.opened)),
  ].filter((d): d is string => !!d)
  const from = days.length ? days.reduce((a, b) => (b < a ? b : a)) : null
  if (!from) return null
  // A loop's facts count once per round; a step that runs once counts its own.
  const facts = lane.steps.flatMap((s) => (s.rounds.length ? s.rounds.flatMap((r) => r.facts) : s.facts)).filter((f) => f.mark === 'ok').map((f) => f.fact.id)
  return { contactId, jobId: lane.jobId, from, facts, ended: lane.ended != null || off }
}

/** How it is going's inputs for everyone on a flow: each time through each step, and each run through the per-job lane. */
export function goingInputs(flow: FlowDef, people: readonly GoingPerson[]): { spans: StepSpan[]; runs: FunnelRun[] } {
  const steps: Record<string, StepShape> = {}
  for (const l of flow.lanes) for (const s of l.steps) steps[s.id] = { fork: s.fork, aside: s.aside, facts: s.facts.length, loop: !!s.loop }
  const spans: StepSpan[] = []
  const runs: FunnelRun[] = []
  for (const p of people) {
    for (const lane of p.reading.lanes) {
      spans.push(...laneSpans(p.contactId, lane, steps))
      const run = laneRun(p.contactId, lane, p.reading.off != null)
      if (run) runs.push(run)
    }
  }
  return { spans, runs }
}
