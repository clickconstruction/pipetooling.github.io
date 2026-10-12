/**
 * The Messages prototype's demo people (v1.178, branch spike/gc-mode, `to-dos/gc-mode/messages/prototype.html`) as
 * `flows/state.ts` reads them, for the step card's and the nudges' tests: each reading built by hand on `SEED_FLOWS`
 * from what the prototype's own functions returned on its clock, Fri Oct 2 2026 at 11:45 AM Central (`stepState`,
 * `stepFacts`, `stepDay`, the rounds, the stamps' days). Demo people only, never a live row. Once `readFlow` lands
 * (helper 4's PR 2, with the demo people as stamps), these readings come from it instead.
 */
import { factById, type FactId, type FactMark, type FlowKind, type PaperId } from './facts'
import type { NudgeMark, PersonFlow, PortalRead, StepNote } from './nudges'
import { SEED_FLOWS } from './seed'
import {
  stepDay,
  type FactReading,
  type FlowLaneDef,
  type FlowReading,
  type LaneReading,
  type OffFlow,
  type RoundReading,
  type StepReading,
  type StepState,
} from './state'

const two = (n: number) => String(n).padStart(2, '0')
/** A day in 2026. */
export const day = (m: number, d: number): string => `2026-${two(m)}-${two(d)}`
/** A time in 2026, Central, as an ISO timestamp; every demo day falls in daylight time. */
export const at = (m: number, d: number, h = 9, mi = 0): string => new Date(`${day(m, d)}T${two(h)}:${two(mi)}:00-05:00`).toISOString()
/** The prototype's clock: Fri Oct 2 2026, 11:45 AM Central. */
export const NOW = new Date(at(10, 2, 11, 45))

/** The change orders' row ids (`gc_change_orders.id`, a uuid on prod), each round's key. */
export const CHANGE_ORDERS = {
  priya1: '6f0b2c1e-3d4a-4b5c-8d6e-7f8091a2b3c4',
  priya2: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d',
  elena1: '1b2c3d4e-5f60-4718-89a0-b1c2d3e4f506',
  elena2: '2c3d4e5f-6071-4829-90b1-c2d3e4f50617',
} as const

const fact = (id: FactId, mark: FactMark = 'no', stamp: { at?: string; by?: string; until?: string } = {}): FactReading => {
  const f = factById(id)
  if (!f) throw new Error(`no fact ${id}`)
  return { fact: f, mark, at: stamp.at ?? null, by: stamp.by ?? null, until: stamp.until ?? null }
}

const round = (
  key: string,
  state: RoundReading['state'],
  facts: FactReading[],
  stamp: { opened?: string; due?: string; name?: string } = {},
): RoundReading => ({
  key,
  name: stamp.name ?? key,
  state,
  opened: stamp.opened ?? null,
  facts,
  day: stamp.due ? stepDay(stamp.due, NOW) : null,
})

interface StepSeed {
  state: StepState
  facts?: FactReading[]
  since?: string
  due?: string
  rounds?: RoundReading[]
  waitingOn?: StepReading['waitingOn']
  skip?: string
  lapsedPaper?: PaperId
}

export interface Seed {
  id: string
  first: string
  kind: FlowKind
  /** The job their Per job lane reads. */
  job: string | null
  /** Their jobs' names, by id. */
  jobs?: Record<string, string>
  nowStepId: string | null
  quietDays: number | null
  lastOutAt: string | null
  off?: OffFlow
  /** The fact that ended the Per job lane at a fork. */
  ended?: FactId
  portal?: PortalRead
  notes?: StepNote[]
  marks?: NudgeMark[]
  sends?: PersonFlow['sends']
  steps: Record<string, StepSeed>
}

const SEEDS: Seed[] = [
  {
    id: 'greg',
    first: 'Greg',
    kind: 'trade',
    job: 'boerne',
    jobs: { boerne: 'Boerne Retail Shell', padb: 'Boerne Retail Pad B', stoneoak: 'Stone Oak Pharmacy' },
    nowStepId: 'ask',
    quietDays: 0,
    lastOutAt: at(9, 30, 9, 40),
    steps: {
      invited: { state: 'done', facts: [fact('invite_sent', 'ok', { at: day(9, 8) })] },
      portal: { state: 'done', facts: [fact('portal_opened', 'ok', { at: day(9, 9) })] },
      papers: {
        state: 'lapsed',
        facts: [fact('w9_signed', 'ok', { at: day(9, 12) }), fact('coi_current', 'bad', { until: day(9, 30) })],
        lapsedPaper: 'coi',
      },
      msa: { state: 'done', facts: [fact('msa_signed', 'ok', { at: day(9, 14) })] },
      ask: {
        state: 'now',
        since: day(9, 22),
        facts: [fact('quote_in', 'wait', { at: day(9, 22) })],
        rounds: [
          round('Stone Oak', 'done', [fact('quote_in', 'ok', { at: day(9, 11) })]),
          round('Boerne Shell', 'now', [fact('quote_in', 'wait', { at: day(9, 22) })], { opened: day(9, 22), due: day(9, 30) }),
          round('Pad B', 'next', [fact('quote_in')], { due: day(10, 22) }),
        ],
      },
      compare: { state: 'next' },
    },
  },
  {
    id: 'elena',
    first: 'Elena',
    kind: 'customer',
    job: 'boerne',
    nowStepId: 'payapp',
    quietDays: 0,
    lastOutAt: at(10, 1, 16),
    portal: { views: { contract: at(9, 2, 11), payapp: at(9, 29, 8, 5) }, openChange: null },
    steps: {
      agreement: { state: 'done', facts: [fact('msa_signed', 'ok', { at: day(8, 4) })] },
      asked: { state: 'done', facts: [fact('asked_us', 'ok', { at: day(8, 11) })] },
      bid: { state: 'done', facts: [fact('bid_sent', 'ok', { at: day(8, 20) })] },
      yes: { state: 'done', facts: [fact('said_yes', 'ok', { at: day(8, 28) }), fact('declined')] },
      contract: { state: 'done', facts: [fact('contract_signed', 'ok', { at: day(9, 2) })] },
      start: { state: 'done', facts: [fact('start_sent', 'ok', { at: day(9, 8) })] },
      onsite: { state: 'done', facts: [fact('started', 'ok', { at: day(9, 14) })] },
      payapp: {
        state: 'now',
        since: day(9, 28),
        facts: [fact('payapp_paid', 'wait', { at: day(9, 28) })],
        rounds: [
          round('Pay app 3', 'done', [fact('payapp_paid', 'ok', { at: day(9, 25) })]),
          round('Pay app 4', 'now', [fact('payapp_paid', 'wait', { at: day(9, 28) })], { opened: day(9, 28), due: day(10, 30) }),
        ],
        waitingOn: { contactId: 'jonah', stepId: 'certify', since: day(9, 28) },
      },
      close: { state: 'next' },
      co: {
        state: 'later',
        rounds: [
          round(CHANGE_ORDERS.elena1, 'done', [fact('co_answered', 'ok')], { name: 'CO 1' }),
          round(CHANGE_ORDERS.elena2, 'done', [fact('co_answered', 'ok')], { name: 'CO 2' }),
        ],
      },
    },
  },
  {
    id: 'priya',
    first: 'Priya',
    kind: 'customer',
    job: 'helotes',
    nowStepId: 'start',
    quietDays: 6,
    lastOutAt: at(9, 19, 16, 5),
    portal: { views: { contract: at(9, 19, 8, 2) }, openChange: { name: 'Change order 2 · a sink in exam 3' } },
    steps: {
      agreement: { state: 'skipped', skip: 'One job. No master agreement.' },
      asked: { state: 'done', facts: [fact('asked_us', 'ok', { at: day(9, 1) })] },
      bid: { state: 'done', facts: [fact('bid_sent', 'ok', { at: day(9, 10) })] },
      yes: { state: 'done', facts: [fact('said_yes', 'ok', { at: day(9, 18) }), fact('declined')] },
      contract: { state: 'done', facts: [fact('contract_signed', 'ok', { at: day(9, 19) })] },
      start: { state: 'now', since: day(9, 19) },
      onsite: { state: 'next' },
      co: {
        state: 'now',
        facts: [fact('co_answered', 'wait', { at: day(9, 30) })],
        rounds: [
          round(CHANGE_ORDERS.priya1, 'done', [fact('co_answered', 'ok', { at: day(9, 28) })], { name: 'CO 1 · exam 2 cabinets' }),
          round(CHANGE_ORDERS.priya2, 'now', [fact('co_answered', 'wait', { at: day(9, 30) })], {
            opened: day(9, 30),
            name: 'CO 2 · a sink in exam 3',
          }),
        ],
      },
    },
  },
  {
    id: 'bill',
    first: 'Bill',
    kind: 'trade',
    job: 'boerne',
    nowStepId: 'compare',
    quietDays: 0,
    lastOutAt: at(10, 2, 8, 2),
    steps: {
      invited: { state: 'done', facts: [fact('invite_sent', 'ok', { at: day(9, 8) })] },
      portal: { state: 'done', facts: [fact('portal_opened', 'ok', { at: day(9, 8) })] },
      papers: { state: 'done', facts: [fact('w9_signed', 'ok', { at: day(9, 9) }), fact('coi_current', 'ok', { at: day(9, 9), until: day(3, 1) })] },
      msa: { state: 'done', facts: [fact('msa_signed', 'ok', { at: day(9, 10) })] },
      ask: {
        state: 'done',
        facts: [fact('quote_in', 'ok', { at: day(9, 29) })],
        rounds: [round('Boerne Shell', 'done', [fact('quote_in', 'ok', { at: day(9, 29) })])],
      },
      compare: { state: 'now', since: day(9, 29) },
      sow: { state: 'next' },
    },
  },
  {
    id: 'tom',
    first: 'Tom',
    kind: 'trade',
    job: 'boerne',
    nowStepId: 'papers',
    quietDays: null,
    lastOutAt: at(9, 30, 11),
    notes: [{ stepId: 'papers', jobId: null, by: 'Rosa', text: 'Their broker renews the policy Nov 1; the certificate comes after.', at: day(10, 1) }],
    steps: {
      invited: { state: 'done', facts: [fact('invite_sent', 'ok', { at: day(9, 25) })] },
      portal: { state: 'done', facts: [fact('portal_opened', 'ok', { at: day(9, 28) })] },
      papers: { state: 'now', since: day(9, 28), facts: [fact('w9_signed', 'ok', { at: day(9, 29) }), fact('coi_current')] },
      msa: { state: 'next' },
      ask: { state: 'later', rounds: [round('Boerne Shell', 'next', [fact('quote_in')], { due: day(10, 8) })] },
    },
  },
  {
    id: 'jonah',
    first: 'Jonah',
    kind: 'arch',
    job: 'boerne',
    nowStepId: 'addenda',
    quietDays: 0,
    lastOutAt: null,
    steps: {
      plans: { state: 'done', facts: [fact('plans_in', 'ok', { at: day(9, 15) })] },
      questions: {
        state: 'later',
        rounds: [
          round('Panel size', 'done', [fact('question_answered', 'ok')]),
          round('Roof curbs', 'done', [fact('question_answered', 'ok')]),
          round('Pond', 'now', [fact('question_answered', 'wait')], { opened: day(10, 2), due: day(10, 5) }),
        ],
      },
      addenda: {
        state: 'now',
        since: day(10, 2),
        rounds: [round('Addendum 1', 'done', [fact('addendum_filed', 'ok')]), round('Addendum 2', 'now', [fact('addendum_filed', 'wait')], { opened: day(10, 2) })],
      },
      submittals: { state: 'next' },
      certify: { state: 'later', rounds: [round('Pay app 4 · Cibolo Creek', 'now', [fact('certified', 'wait')], { opened: day(9, 28) })] },
    },
  },
  {
    id: 'marcus',
    first: 'Marcus',
    kind: 'customer',
    job: 'bell',
    nowStepId: null,
    quietDays: 3,
    lastOutAt: at(9, 21, 10, 15),
    off: { since: day(9, 29), why: 'Declined our bid, went with another plumber.', by: 'Rosa' },
    ended: 'declined',
    steps: {
      agreement: { state: 'skipped', skip: 'One job. No master agreement.' },
      asked: { state: 'done', facts: [fact('asked_us', 'ok', { at: day(9, 14) })] },
      bid: { state: 'done', facts: [fact('bid_sent', 'ok', { at: day(9, 21) })] },
      yes: { state: 'done', facts: [fact('said_yes'), fact('declined', 'ok', { at: day(9, 29) })] },
    },
  },
  {
    id: 'unk1',
    first: '(830)',
    kind: 'unknown',
    job: null,
    nowStepId: 'who',
    quietDays: 0,
    lastOutAt: null,
    steps: { who: { state: 'now' } },
  },
]

/** One lane read from its steps' seeds; a step with no seed is later, its facts not yet. */
function laneRead(def: FlowLaneDef, jobId: string | null, seeds: Record<string, StepSeed>, ended: FactId | null): LaneReading {
  const steps = def.steps.map((step): StepReading => {
    const s = seeds[step.id] ?? { state: 'later' }
    const due = s.due ? stepDay(s.due, NOW) : null
    return {
      stepId: step.id,
      jobId,
      lane: def.lane,
      state: s.state,
      isTrue: s.state === 'done',
      facts: s.facts ?? step.facts.map((id) => fact(id)),
      rounds: s.rounds ?? [],
      since: s.since ?? null,
      day: due,
      due: due?.due ?? null,
      lateDays: due?.lateDays ?? null,
      waitingOn: s.waitingOn ?? null,
      lapsedPaper: s.lapsedPaper ?? null,
      skip: s.skip ? { stepId: step.id, jobId, why: s.skip, by: null, at: null } : null,
    }
  })
  return { lane: def.lane, jobId, steps, headStepId: steps.find((x) => x.state === 'now')?.stepId ?? null, ended }
}

function read(seed: Seed): PersonFlow {
  const flow = SEED_FLOWS[seed.kind]
  const lanes = flow.lanes.map((l) =>
    laneRead(l, l.lane === 'per_job' ? seed.job : null, seed.steps, (l.lane === 'per_job' && seed.ended) || null),
  )
  const nowLane = lanes.find((l) => l.steps.some((x) => x.stepId === seed.nowStepId))
  const reading: FlowReading = {
    kind: seed.kind,
    off: seed.off ?? null,
    defaultJobId: seed.job,
    lanes,
    nowStepId: seed.nowStepId,
    nowJobId: nowLane?.jobId ?? null,
  }
  return {
    id: seed.id,
    first: seed.first,
    flow,
    reading,
    quietDays: seed.quietDays,
    lastOutAt: seed.lastOutAt,
    court: null,
    owe: false,
    jobs: seed.jobs ?? {},
    marks: seed.marks ?? [],
    notes: seed.notes ?? [],
    sends: seed.sends ?? {},
    portal: seed.portal ?? null,
  }
}

/** Every demo person, read; `change` edits a person's seed first (quiet days, our last message, a step, a mark). */
export function demoPeople(change: Record<string, (seed: Seed) => Seed> = {}): PersonFlow[] {
  return SEEDS.map((seed) => read(change[seed.id]?.(structuredClone(seed)) ?? seed))
}

/** The person on one more job: its Per job lane read from its own seeds, after their other jobs. */
export function withJob(person: PersonFlow, jobId: string, seeds: Record<string, StepSeed>): PersonFlow {
  const def = person.flow.lanes.find((l) => l.lane === 'per_job')
  if (!def) throw new Error(`${person.id} has no Per job lane`)
  const lanes = [...person.reading.lanes]
  const after = lanes.map((l) => l.lane).lastIndexOf('per_job')
  lanes.splice(after + 1, 0, laneRead(def, jobId, seeds, null))
  return { ...person, reading: { ...person.reading, lanes } }
}

/** One demo person, read. */
export function demoPerson(id: string, change?: (seed: Seed) => Seed): PersonFlow {
  const seed = SEEDS.find((s) => s.id === id)
  if (!seed) throw new Error(`no demo person ${id}`)
  return read(change ? change(structuredClone(seed)) : seed)
}

export { fact, round }
