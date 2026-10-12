/**
 * The flow's state: where a person stands on their flow, as a read over the stamps the app keeps
 * (Messages cut 4, `BUILD_PLAN.md` §4). State is never stored. The office edits the flow (the steps,
 * their facts, the nudge); the facts move people along it.
 *
 * In: a flow (`FlowDef`, the shape Settings → Flows edits and `flow_steps` will hold) and one
 * person's stamps (`FlowStamps`, what the loader reads from the columns `facts.ts` names). Out: a
 * `FlowReading` with one lane per Once and Any time lane and one per job for the Per job lane. Every
 * job's lane reads the same way, and every read that is about one job takes the job's id.
 *
 * Lifted from the Messages prototype v1.178: `FLOWS` (the shape), `flat`, `laneOf`, `factRead`,
 * `stepTrue`, `subState` and `stepState` (now `stepReading`, with the job as a parameter), `stepDay`,
 * `quietDays`, `lapsedWhy`, `recheck` (now `flowMoves` and `moveWords`), `wouldBeNow` and the per-job
 * lane's picker (`perJobJobs`). Days are YYYY-MM-DD in America/Chicago, and `now` is a parameter.
 */
import { calendarYmdInAppTzFromIso, formatWorkDateYmdMonthDayShort, todayYmdInAppTz, ymdDaysBetween } from '../../utils/dateUtils'
import type { FactId, FactMark, FlowFact, FlowKind, PaperId } from './facts'
import { factById } from './facts'

// ---------- the shape: a flow as the office edits it ----------

/** A lane runs once per person, once per job, or any time. */
export type Lane = 'once' | 'per_job' | 'any_time'

export const LANE_WORDS: Readonly<Record<Lane, string>> = { once: 'Once', per_job: 'Per job', any_time: 'Any time' }

/** Whose move a step is: ours, theirs, or both (a draw: they bill, we pay). */
export type Who = 'us' | 'them' | 'both'

/** The board's tiles group the steps by phase. */
export type FlowPhase = 'setup' | 'pricing' | 'building'

export type NudgeHow = 'text' | 'call' | 'email'

export const NUDGE_HOW_WORDS: Readonly<Record<NudgeHow, string>> = { text: 'a text', call: 'a call', email: 'an email' }

/** A day that beats the nudge's count of quiet days, when the app has one. */
export type NudgeDayFact = 'promised' | 'pay_by' | 'questions_close'

export const NUDGE_DAY_WORDS: Readonly<Record<NudgeDayFact, string>> = {
  promised: 'their promised day',
  pay_by: 'pay by',
  questions_close: 'questions close',
}

export type FlowNudge = {
  /** After how many quiet days. */
  days: number
  how: NudgeHow
  /** A person sends it after the app asks (`ask`), or the app sends it (`app`, off until the owner turns it on). */
  send: 'ask' | 'app'
  dayFact: NudgeDayFact | null
}

/**
 * When a loop lets the chain move on. `rounds`: once every round is done (an ask is done when the
 * quote is in). `next`: not until a later step in its lane reads true (draws run until the final
 * waiver), so a person between two rounds stays on the loop.
 */
export type LoopEnds = 'rounds' | 'next'

export type FlowStep = {
  /** Stable across edits; a quick reply or a note ties to it. */
  id: string
  name: string
  nameEs: string
  phase: FlowPhase
  who: Who
  /** Whose seat an our-move step sits with. The seed holds a first name; `flow_steps.seat_user_id` holds a user. */
  seat: string | null
  /** What finishes it, picked from `facts.ts`. A step with none is never true. */
  facts: FactId[]
  /** `and`: every fact. `or`: either way out, on a fork. */
  join: 'and' | 'or'
  /** The papers it turns on, for its paper mark, Send it and Ask for it. */
  papers: PaperId[]
  /** It repeats, per what ("each ask", "each draw"); its rounds come from the stamps. Null when it runs once. */
  loop: string | null
  /** Null when `loop` is null. */
  loopEnds: LoopEnds | null
  /** A decision with two ways out (the prototype's `dec`). */
  fork: boolean
  /** Not a stop on the chain: any time in the job, drawn apart, never next (change orders). */
  aside: boolean
  /** Skipped for a person on one job, unless already done (the customer's master agreement). */
  skipOneJob: boolean
  /** When it comes, in their words, for their page's Later list. */
  later: { en: string; es: string } | null
  nudge: FlowNudge | null
  /** The middle of the done ones over a year, in days; the boards' "over usual" reads it. */
  usual: number
  /** On an our-move step, what we owe them in Follow up's We owe them list ("our bid"); null elsewhere. */
  owedWords: string | null
}

export type FlowLaneDef = { lane: Lane; steps: FlowStep[] }

export type FlowDef = { kind: FlowKind; lanes: FlowLaneDef[] }

// ---------- in: one person's stamps ----------

/** One fact as the loader read it from its column. A fact with no stamp reads `no`. */
export type FactStamp = {
  fact: FactId
  mark: FactMark
  /** When it turned true, went, or ran out: an ISO timestamp or a YYYY-MM-DD. */
  at: string | null
  /** Who did it, as the card says it: a first name, "the app", or null. */
  by: string | null
  /** The day a paper runs out (insurance), YYYY-MM-DD. */
  until: string | null
}

/** One round of a loop: one ask, one draw, one pay application, one change order, one question. */
export type RoundStamp = {
  /** The row the round is (the invite, the draw, the pay application). */
  key: string
  /** "Draw 2", "Pay app 4", "CO 2 · a sink in exam 3". */
  name: string
  /** When the round opened (asked, sent, filed); null for one we know is coming (not asked yet). */
  opened: string | null
  /** Its due day (a promised day, pay by, questions close), YYYY-MM-DD. */
  due: string | null
  stamps: FactStamp[]
}

/** The stamps of one lane: the facts, a loop's rounds by step id, a step's due day by step id. */
export type LaneStamps = {
  stamps: FactStamp[]
  rounds: Partial<Record<string, RoundStamp[]>>
  dues: Partial<Record<string, string>>
}

export type JobStamps = LaneStamps & { jobId: string }

/** A step skipped for one person, with the reason (`contact_step_skips`). */
export type StepSkip = { stepId: string; jobId: string | null; why: string; by: string | null; at: string | null }

/** Who a step waits on when it is someone else's move (Elena's pay app waits on Jonah's certificate). */
export type WaitingOn = { contactId: string; stepId: string; since: string }

export type StepWait = { stepId: string; jobId: string | null; waitingOn: WaitingOn }

/** Off the flow: the office's word on the person (`contacts.off_*`), not a step's state. */
export type OffFlow = { since: string; why: string; by: string | null }

export type FlowStamps = {
  kind: FlowKind
  /** The jobs they are on (`contact_jobs`), in the order the caption lists them. */
  jobIds: string[]
  defaultJobId: string | null
  /** The Once and Any time lanes' stamps. */
  person: LaneStamps
  /** The Per job lane's stamps, by job id. */
  jobs: Partial<Record<string, JobStamps>>
  skips: StepSkip[]
  waits: StepWait[]
  off: OffFlow | null
}

// ---------- out: the reading ----------

/**
 * A step's state for one person on one lane. `next` is the one step after the step on now; `later`
 * is every other step not reached. Late and waiting are read beside the state, not as states.
 */
export type StepState = 'done' | 'now' | 'next' | 'later' | 'lapsed' | 'skipped'

export type FactReading = {
  fact: FlowFact
  mark: FactMark
  /** YYYY-MM-DD in Chicago. */
  at: string | null
  by: string | null
  until: string | null
}

/** A step's or a round's day. `lateDays` is above 0 when late, 0 on the day, below 0 before it. */
export type StepDay = { due: string; lateDays: number; late: boolean; words: string }

export type RoundState = 'done' | 'now' | 'next'

export type RoundReading = {
  key: string
  name: string
  state: RoundState
  /** YYYY-MM-DD. */
  opened: string | null
  facts: FactReading[]
  day: StepDay | null
}

/** What the boards read for one person on one step on one job. */
export type StepPlace = {
  stepId: string
  /** Null on the Once and Any time lanes. */
  jobId: string | null
  state: 'now' | 'lapsed'
  /** The day it went on now, YYYY-MM-DD; on a lapsed step, the day it lapsed (the paper ran out). */
  since: string | null
  due: string | null
  lateDays: number | null
  waitingOn: WaitingOn | null
  lapsedPaper: PaperId | null
}

/** One step for one person on one lane. A now or lapsed one is a `StepPlace`, so the boards read one shape. */
export type StepReading = Omit<StepPlace, 'state'> & {
  state: StepState
  lane: Lane
  /** Its facts read true now (for a loop, its open round's facts, else its last round's). */
  isTrue: boolean
  facts: FactReading[]
  /** A loop's rounds in order; empty when it runs once. */
  rounds: RoundReading[]
  day: StepDay | null
  skip: StepSkip | null
}

export type StepPlaceReading = StepReading & StepPlace

export type LaneReading = {
  lane: Lane
  /** The job this Per job lane is for; null on the Once and Any time lanes. */
  jobId: string | null
  steps: StepReading[]
  /** The step on now in the chain; null when the lane is finished or ended. */
  headStepId: string | null
  /** The fact that ended the lane at a fork (they declined, we did not carry it). */
  ended: FactId | null
}

export type FlowReading = {
  kind: FlowKind
  off: OffFlow | null
  defaultJobId: string | null
  /** The Once lane, then one Per job lane per job in `jobIds` order, then Any time. */
  lanes: LaneReading[]
  /** The person's step on now: the Once lane's while it has one, else the default job's. */
  nowStepId: string | null
  /** The job of `nowStepId` when it is a Per job step. */
  nowJobId: string | null
}

/** One row of the per-job lane's picker: a job with the step it is on. */
export type PerJobRow = {
  jobId: string
  headStepId: string | null
  /** Anything done or on now on this job. */
  started: boolean
  isDefault: boolean
  ended: FactId | null
}

/** A paper's place on a person's flow, for the job's papers grid. */
export type PaperReading = {
  paper: PaperId
  stepId: string
  stepState: StepState
  mark: FactMark
  /** The day it went, came, or was signed, YYYY-MM-DD. */
  on: string | null
  /** The day it runs out, YYYY-MM-DD. */
  expires: string | null
}

/** A step that changed state between two readings; the thread's event line says so. */
export type FlowMove = { stepId: string; jobId: string | null; from: StepState; to: StepState }

/** The editor's "Before you save · who moves" row: a person whose step on now changes with an edit. */
export type WhoMoves = {
  contactId: string
  name: string
  from: string | null
  to: string | null
  fromJobId: string | null
  toJobId: string | null
}

/** The least of a message `quietDays` needs. A team note and an app event are `team`. */
export type QuietMessage = { direction: 'in' | 'out' | 'team'; at: string }

// ---------- the reads ----------

/** Every step in the flow's order, lane by lane. */
export function flat(flow: FlowDef): FlowStep[] {
  return flow.lanes.flatMap((l) => l.steps)
}

export function stepById(flow: FlowDef, id: string): FlowStep | null {
  return flat(flow).find((s) => s.id === id) ?? null
}

export function laneOf(flow: FlowDef, id: string): Lane | null {
  return flow.lanes.find((l) => l.steps.some((s) => s.id === id))?.lane ?? null
}

/** A day from a stamp: a YYYY-MM-DD stays as it is; a timestamp becomes its Chicago day. */
export function stampDay(at: string | null | undefined): string | null {
  if (!at) return null
  const t = at.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  return calendarYmdInAppTzFromIso(t) || null
}

/** One fact for one person, from the stamps of the lane or round it sits on. No stamp reads `no`. */
export function factRead(stamps: readonly FactStamp[], fact: FactId): FactReading {
  const f = factById(fact)
  if (!f) throw new Error(`flows: unknown fact ${fact}`)
  const s = stamps.find((x) => x.fact === fact)
  if (!s) return { fact: f, mark: 'no', at: null, by: null, until: null }
  return { fact: f, mark: s.mark, at: stampDay(s.at), by: s.by, until: stampDay(s.until) }
}

/** True when its facts finish it: every fact, or either on a fork (`or`). A step with no facts is never true. */
export function stepTrue(step: Pick<FlowStep, 'join'>, facts: readonly Pick<FactReading, 'mark'>[]): boolean {
  if (!facts.length) return false
  return step.join === 'or' ? facts.some((x) => x.mark === 'ok') : facts.every((x) => x.mark === 'ok')
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** "Fri" for a YYYY-MM-DD, by the civil date. */
function weekdayShort(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number]
  return WEEKDAY_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? ''
}

/**
 * A due day against today: "late 2 days", "due today", "due Fri" within the week, "due Oct 22"
 * past it. Null with no due day.
 */
export function stepDay(due: string | null | undefined, now: Date): StepDay | null {
  const d = stampDay(due)
  if (!d) return null
  const lateDays = ymdDaysBetween(d, todayYmdInAppTz(now))
  if (lateDays == null) return null
  if (lateDays > 0) return { due: d, lateDays, late: true, words: `late ${lateDays} day${lateDays === 1 ? '' : 's'}` }
  const words = lateDays === 0 ? 'due today' : lateDays < -6 ? `due ${formatWorkDateYmdMonthDayShort(d)}` : `due ${weekdayShort(d)}`
  return { due: d, lateDays, late: false, words }
}

/**
 * Days since their last word, by the calendar: only what they sent counts, never ours, a team note
 * or an event. Null when they have not said anything yet.
 */
export function quietDays(messages: readonly QuietMessage[], now: Date): number | null {
  let last: string | null = null
  for (const m of messages) {
    if (m.direction !== 'in') continue
    if (last == null || new Date(m.at).getTime() > new Date(last).getTime()) last = m.at
  }
  const day = stampDay(last)
  if (!day) return null
  return ymdDaysBetween(day, todayYmdInAppTz(now))
}

/** The rail's words for a lapsed step: "lapsed · insurance expired". Null when it is not lapsed. */
export function lapsedWhy(step: Pick<StepReading, 'state' | 'lapsedPaper'>, paperShort?: (p: PaperId) => string): string | null {
  if (step.state !== 'lapsed') return null
  if (!step.lapsedPaper) return 'lapsed'
  return `lapsed · ${paperShort ? paperShort(step.lapsedPaper) : step.lapsedPaper} expired`
}

const EMPTY_LANE: LaneStamps = { stamps: [], rounds: {}, dues: {} }

/** The latest day among readings that read true, as the day a step finished. */
function finishedOn(facts: readonly FactReading[]): string | null {
  let best: string | null = null
  for (const f of facts) if (f.mark === 'ok' && f.at && (best == null || f.at > best)) best = f.at
  return best
}

/** A step's own reading before the chain is walked: its facts, its rounds, whether it reads true. */
type StepPre = {
  step: FlowStep
  facts: FactReading[]
  rounds: RoundReading[]
  open: RoundReading | null
  isTrue: boolean
  /** Every fact was true once (ok or bad), so a bad one makes the step lapsed rather than not reached. */
  lapsed: boolean
  skip: StepSkip | null
  due: string | null
}

function preRead(step: FlowStep, lane: LaneStamps, person: LaneStamps, jobId: string | null, stamps: FlowStamps, now: Date): StepPre {
  // A Per job lane reads its job's stamps, and a person's own facts (their papers) from the person.
  const factsFrom = (own: readonly FactStamp[]) => (fid: FactId) =>
    factById(fid)?.scope === 'person' && lane !== person ? factRead(person.stamps, fid) : factRead(own, fid)
  const rounds: RoundReading[] = (step.loop ? lane.rounds[step.id] ?? [] : []).map((r) => {
    const facts = step.facts.map(factsFrom(r.stamps))
    const state: RoundState = stepTrue(step, facts) ? 'done' : r.opened ? 'now' : 'next'
    return { key: r.key, name: r.name, state, opened: stampDay(r.opened), facts, day: state === 'done' ? null : stepDay(r.due, now) }
  })
  const open = rounds.find((r) => r.state === 'now') ?? null
  const facts = step.loop ? (open ?? rounds[rounds.length - 1])?.facts ?? step.facts.map(factsFrom([])) : step.facts.map(factsFrom(lane.stamps))
  const isTrue = step.loop ? rounds.length > 0 && rounds.every((r) => r.state === 'done') : stepTrue(step, facts)
  const wasTrue = (x: FactReading) => x.mark === 'ok' || x.mark === 'bad'
  const lapsed =
    !step.loop && !isTrue && facts.some((x) => x.mark === 'bad') && (step.join === 'or' ? facts.some(wasTrue) : facts.every(wasTrue))
  const typed = stamps.skips.find((k) => k.stepId === step.id && k.jobId === jobId) ?? null
  const oneJob =
    !typed && step.skipOneJob && stamps.jobIds.length <= 1 && !isTrue
      ? { stepId: step.id, jobId, why: `One job, so no ${step.name.toLowerCase()}.`, by: null, at: null }
      : null
  const due = step.loop ? (open ?? rounds.find((r) => r.state === 'next'))?.day?.due ?? null : stampDay(lane.dues[step.id])
  return { step, facts, rounds, open, isTrue, lapsed, skip: typed ?? oneJob, due }
}

function readLane(def: FlowLaneDef, lane: LaneStamps, person: LaneStamps, jobId: string | null, stamps: FlowStamps, now: Date): LaneReading {
  const pre = def.steps.map((s) => preRead(s, lane, person, jobId, stamps, now))
  // A Per job lane with nothing on it yet is not started: nobody is on its first step until the job gives a stamp.
  const started = def.lane !== 'per_job' || lane.stamps.some((x) => x.mark !== 'no') || Object.values(lane.rounds).some((rs) => !!rs?.length)
  // A loop that ends on what follows it is done once a later step in its lane that runs once has read true (draws end
  // at closeout). Another loop's round ends nothing: a certified pay application does not finish the submittals.
  const laterTrue = (i: number) => pre.slice(i + 1).some((p) => !p.step.aside && !p.step.loop && (p.isTrue || p.lapsed))
  const loopPasses = (p: StepPre, i: number) => (p.step.loopEnds === 'next' ? laterTrue(i) : p.isTrue)

  let head: number | null = null
  let ended: FactId | null = null
  let nextGiven = false
  const states: StepState[] = pre.map((p, i) => {
    const s = p.step
    if (p.skip) return 'skipped'
    if (s.aside) return p.open ? 'now' : p.isTrue ? 'done' : 'later'
    if (ended) return 'later'
    if (head == null && started) {
      if (s.loop) {
        if (loopPasses(p, i)) return p.open ? 'now' : 'done'
        head = i
        return 'now'
      }
      if (p.isTrue) {
        ended = s.fork ? p.facts.find((x) => x.mark === 'ok' && x.fact.endsLane)?.fact.id ?? null : null
        return 'done'
      }
      if (p.lapsed) return 'lapsed'
      if (!s.facts.length) return 'later'
      head = i
      return 'now'
    }
    if (s.loop && p.open) return 'now'
    if (s.loop ? loopPasses(p, i) : p.isTrue) return 'done'
    if (p.lapsed) return 'lapsed'
    if (nextGiven) return 'later'
    nextGiven = true
    return 'next'
  })

  const steps: StepReading[] = pre.map((p, i) => {
    const state = states[i] ?? 'later'
    let since: string | null = null
    if (state === 'lapsed') {
      const bad = p.facts.find((x) => x.mark === 'bad')
      since = bad?.at ?? bad?.until ?? null
    } else if (state === 'now' && p.open) since = p.open.opened
    else if (state === 'now' && p.rounds.some((r) => r.state === 'done')) {
      // A loop between two rounds: since the last round finished.
      since = finishedOn(p.rounds.filter((r) => r.state === 'done').flatMap((r) => r.facts))
    } else if (state === 'now') {
      // The day the step before it in the chain finished.
      for (let j = i - 1; j >= 0 && since == null; j--) {
        const b = pre[j]
        if (!b || b.skip || b.step.aside || !b.step.facts.length) continue
        since = b.step.loop ? finishedOn(b.rounds.filter((r) => r.state === 'done').flatMap((r) => r.facts)) : finishedOn(b.facts)
        break
      }
    }
    const day = state === 'done' || state === 'skipped' ? null : stepDay(p.due, now)
    const wait = stamps.waits.find((w) => w.stepId === p.step.id && w.jobId === jobId)
    return {
      stepId: p.step.id,
      jobId,
      lane: def.lane,
      state,
      isTrue: p.isTrue,
      facts: p.facts,
      rounds: p.rounds,
      since,
      day,
      due: day?.due ?? null,
      lateDays: day?.lateDays ?? null,
      waitingOn: state === 'now' && wait ? { ...wait.waitingOn, since: stampDay(wait.waitingOn.since) ?? wait.waitingOn.since } : null,
      lapsedPaper: state === 'lapsed' ? p.facts.find((x) => x.mark === 'bad')?.fact.paper ?? null : null,
      skip: p.skip,
    }
  })
  return { lane: def.lane, jobId, steps, headStepId: head == null ? null : pre[head]?.step.id ?? null, ended }
}

/**
 * Reads where one person stands on a flow, from their stamps alone. The chain in each lane passes a
 * step that is done, lapsed, skipped or has no facts yet, and stops at the first that is none of
 * these: that step is on now. After it, one step is next and the rest are later, except a step
 * whose facts already read true (done) and a loop with a round open (now). An aside step reads from
 * its rounds and is never on the chain. A fork's way out ends its lane.
 */
export function readFlow(flow: FlowDef, stamps: FlowStamps, now: Date): FlowReading {
  const lanes: LaneReading[] = []
  for (const def of flow.lanes) {
    if (def.lane === 'per_job') {
      for (const jobId of stamps.jobIds) lanes.push(readLane(def, stamps.jobs[jobId] ?? EMPTY_LANE, stamps.person, jobId, stamps, now))
    } else {
      lanes.push(readLane(def, stamps.person, stamps.person, null, stamps, now))
    }
  }
  let nowStepId: string | null = null
  let nowJobId: string | null = null
  if (!stamps.off) {
    const pick =
      lanes.find((l) => l.lane === 'once' && l.headStepId) ??
      lanes.find((l) => l.lane === 'per_job' && l.jobId === stamps.defaultJobId && l.headStepId) ??
      lanes.find((l) => l.lane === 'per_job' && l.headStepId) ??
      lanes.find((l) => l.headStepId)
    if (pick) {
      nowStepId = pick.headStepId
      nowJobId = pick.jobId
    }
  }
  return { kind: flow.kind, off: stamps.off, defaultJobId: stamps.defaultJobId, lanes, nowStepId, nowJobId }
}

/** The lane a step sits on for one job: the job's Per job lane, else the Once or Any time lane. */
export function laneReadingOf(reading: FlowReading, stepId: string, jobId: string | null): LaneReading | null {
  for (const l of reading.lanes) {
    if (!l.steps.some((s) => s.stepId === stepId)) continue
    if (l.lane !== 'per_job' || l.jobId === jobId) return l
  }
  return null
}

/** One step for one person on one job; `jobId` is ignored on the Once and Any time lanes. */
export function stepReading(reading: FlowReading, stepId: string, jobId: string | null): StepReading | null {
  return laneReadingOf(reading, stepId, jobId)?.steps.find((s) => s.stepId === stepId) ?? null
}

export function stepState(reading: FlowReading, stepId: string, jobId: string | null): StepState | null {
  return stepReading(reading, stepId, jobId)?.state ?? null
}

export function isPlace(step: StepReading): step is StepPlaceReading {
  return step.state === 'now' || step.state === 'lapsed'
}

/**
 * Every step a person is on: on now or lapsed, one per job in the Per job lane. The boards and the
 * nudges read these. A person off the flow is on none, so nothing nudges them.
 */
export function placesOf(reading: FlowReading): StepPlaceReading[] {
  if (reading.off) return []
  return reading.lanes.flatMap((l) => l.steps.filter(isPlace))
}

/** A paper's place for one person on one job: the step that turns on it, and its fact's mark. */
export function paperRead(reading: FlowReading, paper: PaperId, jobId: string | null): PaperReading | null {
  for (const l of reading.lanes) {
    if (l.lane === 'per_job' && l.jobId !== jobId) continue
    for (const s of l.steps) {
      const f = s.facts.find((x) => x.fact.paper === paper)
      if (!f) continue
      return { paper, stepId: s.stepId, stepState: s.state, mark: f.mark, on: f.at, expires: f.until }
    }
  }
  return null
}

/** The per-job lane's picker: each job they are on with the step it is on, the default first in `jobIds` order. */
export function perJobJobs(reading: FlowReading): PerJobRow[] {
  return reading.lanes
    .filter((l): l is LaneReading & { jobId: string } => l.lane === 'per_job' && l.jobId != null)
    .map((l) => ({
      jobId: l.jobId,
      headStepId: l.headStepId,
      started: l.steps.some((s) => s.state === 'done' || s.state === 'now' || s.state === 'lapsed'),
      isDefault: l.jobId === reading.defaultJobId,
      ended: l.ended,
    }))
}

/**
 * The rail's "4 / 9" for one job: the Once lane and the job's Per job lane. A loop counts once; an
 * aside step and a skipped one not at all; a lapsed step is not done.
 */
export function flowProgress(flow: FlowDef, reading: FlowReading, jobId: string | null): { done: number; of: number } {
  const aside = new Set(flat(flow).filter((s) => s.aside).map((s) => s.id))
  const lanes = reading.lanes.filter((l) => l.lane === 'once' || (l.lane === 'per_job' && l.jobId === jobId))
  const steps = lanes.flatMap((l) => l.steps).filter((s) => s.state !== 'skipped' && !aside.has(s.stepId))
  return { done: steps.filter((s) => s.state === 'done').length, of: steps.length }
}

/** Where a person would be on a flow read now: the editor's preview. */
export function wouldBeNow(flow: FlowDef, stamps: FlowStamps, now: Date): { stepId: string | null; jobId: string | null } {
  const r = readFlow(flow, stamps, now)
  return { stepId: r.nowStepId, jobId: r.nowJobId }
}

/** Who moves when an edit is saved: everyone whose step on now differs between the two flows. */
export function whoMoves(
  before: FlowDef,
  after: FlowDef,
  people: readonly { contactId: string; name: string; stamps: FlowStamps }[],
  now: Date,
): WhoMoves[] {
  const out: WhoMoves[] = []
  for (const p of people) {
    const a = wouldBeNow(before, p.stamps, now)
    const b = wouldBeNow(after, p.stamps, now)
    if (a.stepId === b.stepId && a.jobId === b.jobId) continue
    out.push({ contactId: p.contactId, name: p.name, from: a.stepId, to: b.stepId, fromJobId: a.jobId, toJobId: b.jobId })
  }
  return out
}

/** What changed between two readings of one person, lane by lane in the flow's order. */
export function flowMoves(before: FlowReading, after: FlowReading): FlowMove[] {
  const moves: FlowMove[] = []
  for (const l of after.lanes) {
    const prior = before.lanes.find((x) => x.lane === l.lane && x.jobId === l.jobId)
    for (const s of l.steps) {
      const was = prior?.steps.find((x) => x.stepId === s.stepId)?.state ?? 'later'
      if (was !== s.state) moves.push({ stepId: s.stepId, jobId: l.jobId, from: was, to: s.state })
    }
  }
  return moves
}

/** The thread's event line for a change: "Papers in is done. MSA signed is on now." Empty when nothing a person reads moved. */
export function moveWords(flow: FlowDef, moves: readonly FlowMove[]): string {
  const said: string[] = []
  for (const m of moves) {
    const name = stepById(flow, m.stepId)?.name
    if (!name) continue
    if (m.to === 'done') said.push(`${name} is done.`)
    else if (m.to === 'now') said.push(`${name} is on now.`)
    else if (m.to === 'lapsed') said.push(`${name} lapsed.`)
    else if (m.to === 'skipped') said.push(`${name} is skipped.`)
  }
  return said.join(' ')
}
