/**
 * The Messages prototype's demo people (v1.178) for the step card's, the nudges' and the morning run's tests, read by
 * cluster 4's `readFlow` from its stamps (`flowFixtures.ts`) on the prototype's clock, Fri Oct 2 2026 at 11:45 AM
 * Central. What a reading does not hold comes from the prototype too: each person's first name, their quiet days and
 * our last message (its thread), their portal's reads and the team's notes. Demo people only, never a live row.
 *
 * A test changes a person through their seed: `steps` starts as their readings by step id (the Once and Any time lanes
 * and their default job's Per job lane), and what a test sets on a step lays over the reading.
 */
import { factById, type FactId, type FactMark } from './facts'
import { FLOW_FIXTURE_JOBS, FLOW_FIXTURE_NOW, flowFixture } from './flowFixtures'
import type { NudgeMark, PersonFlow, PortalRead, StepNote } from './nudges'
import { SEED_FLOWS } from './seed'
import { readFlow, stepDay, type FactReading, type FlowReading, type RoundReading, type StepReading } from './state'

const two = (n: number) => String(n).padStart(2, '0')
/** A day in 2026. */
export const day = (m: number, d: number): string => `2026-${two(m)}-${two(d)}`
/** A time in 2026, Central, as an ISO timestamp; every demo day falls in daylight time. */
export const at = (m: number, d: number, h = 9, mi = 0): string => new Date(`${day(m, d)}T${two(h)}:${two(mi)}:00-05:00`).toISOString()
/** The prototype's clock: Fri Oct 2 2026, 11:45 AM Central. */
export const NOW = FLOW_FIXTURE_NOW

/** The change orders' round keys, as cluster 4's stamps key them (each stands for a `gc_change_orders` row id). */
export const CHANGE_ORDERS = { priya1: 'co-priya-1', priya2: 'co-priya-2', elena1: 'co-elena-1', elena2: 'co-elena-2' } as const

/** A fact as a reading holds it, for a test that sets one. */
export const fact = (id: FactId, mark: FactMark = 'no', stamp: { at?: string; by?: string; until?: string } = {}): FactReading => {
  const f = factById(id)
  if (!f) throw new Error(`no fact ${id}`)
  return { fact: f, mark, at: stamp.at ?? null, by: stamp.by ?? null, until: stamp.until ?? null }
}

/** A loop's round as a reading holds it, for a test that sets one. */
export const round = (
  key: string,
  state: RoundReading['state'],
  facts: FactReading[],
  stamp: { opened?: string; due?: string; name?: string } = {},
): RoundReading => ({ key, name: stamp.name ?? key, state, opened: stamp.opened ?? null, facts, day: stamp.due ? stepDay(stamp.due, NOW) : null })

/** What a test lays over a step's reading; `skip` is the reason alone. */
export type StepSeed = Partial<Omit<StepReading, 'skip' | 'waitingOn'>> & { skip?: string | null; waitingOn?: StepReading['waitingOn'] }

export interface Seed {
  id: string
  first: string
  nowStepId: string | null
  quietDays: number | null
  lastOutAt: string | null
  marks: NudgeMark[]
  sends: PersonFlow['sends']
  notes: StepNote[]
  portal: PortalRead | null
  /** Their readings by step id, as a test may change them. */
  steps: Record<string, StepSeed>
}

type Thread = Pick<Seed, 'first' | 'quietDays' | 'lastOutAt' | 'notes' | 'portal'>

/** What the prototype's thread and portal say of each person, beside their flow. */
const THREADS: Record<string, Thread> = {
  greg: { first: 'Greg', quietDays: 0, lastOutAt: at(9, 30, 9, 40), notes: [], portal: null },
  elena: {
    first: 'Elena',
    quietDays: 0,
    lastOutAt: at(10, 1, 16),
    notes: [],
    portal: { views: { contract: at(9, 2, 11), payapp: at(9, 29, 8, 5) }, openChange: null },
  },
  priya: {
    first: 'Priya',
    quietDays: 6,
    lastOutAt: at(9, 19, 16, 5),
    notes: [],
    portal: { views: { contract: at(9, 19, 8, 2) }, openChange: { name: 'Change order 2 · a sink in exam 3' } },
  },
  bill: { first: 'Bill', quietDays: 0, lastOutAt: at(10, 2, 8, 2), notes: [], portal: null },
  tom: {
    first: 'Tom',
    quietDays: null,
    lastOutAt: at(9, 30, 11),
    notes: [{ stepId: 'papers', jobId: null, by: 'Rosa', text: 'Their broker renews the policy Nov 1; the certificate comes after.', at: day(10, 1) }],
    portal: null,
  },
  jonah: { first: 'Jonah', quietDays: 0, lastOutAt: null, notes: [], portal: null },
  marcus: { first: 'Marcus', quietDays: 3, lastOutAt: at(9, 21, 10, 15), notes: [], portal: null },
  unk1: { first: '(830)', quietDays: 0, lastOutAt: null, notes: [], portal: null },
}

/** The demo people with a thread, in the prototype's order. */
export const DEMO_IDS = ['greg', 'elena', 'priya', 'bill', 'tom', 'jonah', 'marcus', 'unk1'] as const

const readOf = (id: string): { flow: PersonFlow['flow']; reading: FlowReading } => {
  const p = flowFixture(id)
  const flow = SEED_FLOWS[p.stamps.kind]
  return { flow, reading: readFlow(flow, p.stamps, NOW) }
}

/** The lanes a seed reads: the Once and Any time lanes and the default job's Per job lane. */
const seededLane = (reading: FlowReading, lane: FlowReading['lanes'][number]) => lane.lane !== 'per_job' || lane.jobId === reading.defaultJobId

function seedOf(id: string): Seed {
  const { reading } = readOf(id)
  const thread = THREADS[id]
  if (!thread) throw new Error(`no demo thread for ${id}`)
  const steps: Record<string, StepSeed> = {}
  for (const lane of reading.lanes.filter((l) => seededLane(reading, l))) for (const s of lane.steps) steps[s.stepId] = { ...s, skip: s.skip?.why ?? null }
  return { id, ...thread, nowStepId: reading.nowStepId, marks: [], sends: {}, steps }
}

function personOf(seed: Seed): PersonFlow {
  const { flow, reading } = readOf(seed.id)
  const lanes = reading.lanes.map((lane) =>
    !seededLane(reading, lane)
      ? lane
      : {
          ...lane,
          steps: lane.steps.map((s): StepReading => {
            const over = seed.steps[s.stepId]
            if (!over) return s
            const { skip, waitingOn, ...rest } = over
            return {
              ...s,
              ...rest,
              stepId: s.stepId,
              jobId: s.jobId,
              lane: s.lane,
              waitingOn: waitingOn ?? null,
              skip: skip ? { stepId: s.stepId, jobId: s.jobId, why: skip, by: s.skip?.by ?? null, at: s.skip?.at ?? null } : null,
            }
          }),
        },
  )
  const moved = seed.nowStepId !== reading.nowStepId
  const nowLane = lanes.find((l) => seededLane(reading, l) && l.steps.some((x) => x.stepId === seed.nowStepId))
  return {
    id: seed.id,
    first: seed.first,
    flow,
    reading: { ...reading, lanes, nowStepId: seed.nowStepId, nowJobId: moved ? (nowLane?.jobId ?? null) : reading.nowJobId },
    quietDays: seed.quietDays,
    lastOutAt: seed.lastOutAt,
    court: null,
    owe: false,
    jobs: { ...FLOW_FIXTURE_JOBS },
    marks: seed.marks,
    notes: seed.notes,
    sends: seed.sends,
    portal: seed.portal,
  }
}

/** Every demo person with a thread, read; `change` edits a person's seed first. */
export function demoPeople(change: Record<string, (seed: Seed) => Seed> = {}): PersonFlow[] {
  return DEMO_IDS.map((id) => {
    const seed = seedOf(id)
    return personOf(change[id]?.(seed) ?? seed)
  })
}

/** One demo person, read. */
export function demoPerson(id: string, change?: (seed: Seed) => Seed): PersonFlow {
  const seed = seedOf(id)
  return personOf(change ? change(seed) : seed)
}

/** The person with one step changed on one job's lane (null: the Once or Any time lane), the rest as read. */
export function withStep(person: PersonFlow, stepId: string, jobId: string | null, change: (step: StepReading) => StepReading): PersonFlow {
  const lanes = person.reading.lanes.map((l) => ({
    ...l,
    steps: l.steps.map((s) => (s.stepId === stepId && s.jobId === jobId ? change(s) : s)),
  }))
  return { ...person, reading: { ...person.reading, lanes } }
}
