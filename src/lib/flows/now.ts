/**
 * Where one person is on their flow, in a line (Messages cut 4, for cut 3's quick replies and Find a reply): the step on
 * now and its job, its name, whose move it is as the flow panel says it, since when, and what finishes it. Pure.
 */
import { whoseMove } from './card'
import { doneWords, type PersonFlow } from './nudges'
import type { PaperId } from './facts'
import { laneReadingOf, moverOf, stepById, stepReading } from './state'

export type FlowNow = {
  stepId: string
  /** The job of a Per job step; null on the Once and Any time lanes. */
  jobId: string | null
  stepName: string
  /** Whose move it is, as the panel says it: 'wait' while the step waits on someone else. */
  who: 'us' | 'them' | 'both' | 'wait'
  /** The day it went on now, YYYY-MM-DD. */
  sinceYmd: string | null
  /** What finishes it, as the card's Done when says it: "their quote is in the portal or they declined to quote". */
  finishes: string
  /** The papers it turns on (the step's `papers`), for Attach's starred rows (cut 7f). */
  papers: readonly PaperId[]
}

/** The step on now for them; null when nothing is on now, or they are off the flow. */
export function flowNowOf(person: PersonFlow): FlowNow | null {
  const r = person.reading
  if (r.off || !r.nowStepId) return null
  const def = stepById(person.flow, r.nowStepId)
  const step = stepReading(r, r.nowStepId, r.nowJobId)
  if (!def || !step) return null
  const perJob = laneReadingOf(r, r.nowStepId, r.nowJobId)?.lane === 'per_job'
  const who = whoseMove({ who: moverOf(def, step) }, { onNow: true, waiting: Boolean(step.waitingOn), perJob, owe: person.owe, court: person.court })
  return { stepId: def.id, jobId: r.nowJobId, stepName: def.name, who, sinceYmd: step.since, finishes: doneWords(def), papers: def.papers }
}
