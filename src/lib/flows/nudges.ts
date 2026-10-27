/**
 * Messages, cut 4: the flow's reminders, lifted from the prototype v1.178 (branch spike/gc-mode,
 * `to-dos/gc-mode/messages/prototype.html`: `nudgeRows`, `nudgeNow`, `holdNudge` and the step card's Reminder line).
 * One rule, `nudgeDue`, says whether a step's reminder is on Follow up today; Follow up's rows and the step card both
 * read it, so the card never says a row is there when it is not. Pure and free of the browser: the morning dispatcher
 * (`messages-nudge-dispatch`, cut 5) reads it on the edge.
 *
 * In: each person's flow as `flows/state.ts` reads it, with what the reading does not hold (`PersonFlow`): their quiet
 * days, our last message, the marks Remind now and Hold until leave, a paper's sends, their portal's reads, the team's
 * notes. Days are YYYY-MM-DD in the company calendar and instants are ISO timestamps, as in `state.ts`.
 */
import { formatDenverTimeOnly, todayYmdInAppTz, ymdAddDays, ymdDaysBetween } from '../../utils/dateUtils'
import { shortDate, weekdayDate } from '../gc/words'
import { FLOW_PAPERS, factsWords, type FlowKind, type PaperId } from './facts'
import {
  NUDGE_DAY_WORDS,
  NUDGE_HOW_WORDS,
  lapsedWhy as railLapsedWhy,
  moverOf,
  placesOf,
  stampDay,
  stepById,
  stepReading,
  type FactReading,
  type FlowDef,
  type FlowReading,
  type FlowStep,
  type NudgeHow,
  type StepDay,
  type StepReading,
} from './state'

// ---------- the person, with what the flow reading does not hold ----------

/** Remind now and Hold until on one person's step (`nudge_holds`). */
export interface NudgeMark {
  stepId: string
  /** The job of a Per job step; null on the Once and Any time lanes. */
  jobId: string | null
  /** When Remind now was pressed, an ISO timestamp. */
  nudgedAt?: string | null
  /** The day the hold ends, YYYY-MM-DD: the reminder is quiet through the day before. */
  holdUntil?: string | null
}

/** A team note tied to a step (cluster 1's `messages.step_id`). */
export interface StepNote {
  stepId: string
  jobId: string | null
  by: string
  text: string
  /** An ISO timestamp or a YYYY-MM-DD. */
  at: string
}

/** What their portal says they opened: a paper's first view, an ISO timestamp, and the change order out to them. */
export interface PortalRead {
  views: Partial<Record<PaperId, string>>
  openChange: { name: string } | null
}

export interface PersonFlow {
  id: string
  first: string
  flow: FlowDef
  reading: FlowReading
  /** `quietDays` of `flows/state.ts`: days since their last word; null when they have said nothing yet. */
  quietDays: number | null
  /** Our last message to them, an ISO timestamp (cluster 1's `lastOut`), so a reminder never doubles one we sent. */
  lastOutAt: string | null
  /** Whose court the thread is in (cluster 1's `courtOf`) and whether we owe them (cluster 2): the move on the step on now. */
  court: 'ours' | 'theirs' | null
  owe: boolean
  marks: readonly NudgeMark[]
  notes: readonly StepNote[]
  /** The names of their jobs by id (cluster 1's `contact_jobs`), for a Follow up row that spans two. */
  jobs?: Partial<Record<string, string>>
  /** Each paper's sends, the first and then each reminder, as ISO timestamps (the paper send's own read). */
  sends: Partial<Record<PaperId, readonly string[]>>
  portal: PortalRead | null
}

// ---------- the paper words ----------

/** The papers we send that nobody signs: each finishes its step when it goes. */
const UNSIGNED: ReadonlySet<PaperId> = new Set<PaperId>(['invitation', 'bid', 'schedule', 'payapp', 'estimate', 'bill'])

/** Whether the paper waits on their signature once it goes. */
export const paperSigned = (paper: PaperId): boolean => !UNSIGNED.has(paper)

/** 'their certificate of insurance', as a sentence names it. */
export const paperName = (paper: PaperId): string => FLOW_PAPERS[paper]?.name ?? paper

// ---------- days, in the company calendar ----------

/** Whole company-calendar days from a day or an instant to today; negative when it is ahead. */
export function daysSince(at: string, now: Date): number {
  return ymdDaysBetween(stampDay(at) ?? '', todayYmdInAppTz(now)) ?? 0
}
/** 'Tue Sep 29'. */
export const weekday = (at: string): string => weekdayDate(stampDay(at))
/** 'Sep 29'. */
export const monthDay = (at: string): string => shortDate(stampDay(at))
/** '8:05 AM', with a plain space whatever the runtime's ICU puts before the AM. */
export const clock = (iso: string): string => formatDenverTimeOnly(Date.parse(iso)).replace(/ /g, ' ')
/** '1 day', '4 days'. */
export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

/** The YYYY-MM-DD of the Monday after today: Hold until Mon. */
export function nextMonday(now: Date): string {
  const today = todayYmdInAppTz(now)
  const [y, m, d] = today.split('-').map(Number)
  const dow = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()
  return ymdAddDays(today, (8 - dow) % 7 || 7)
}

// ---------- the reads a reminder needs ----------

/** The step's day: its own, or the day of its round on now. */
export const dayOf = (step: StepReading): StepDay | null => step.day ?? step.rounds.find((r) => r.state === 'now')?.day ?? null

/** The facts that say what the step waits on: a loop's round on now, else the step's own. */
export const factsNow = (step: StepReading): FactReading[] => step.rounds.find((r) => r.state === 'now')?.facts ?? step.facts

/** What finishes the step, in words: 'their W-9 is signed and their insurance is current'. */
export const doneWords = (def: FlowStep): string => factsWords(def.facts, def.join)

/** 'lapsed · insurance expired', the reason beside a step whose done fact stopped being true. */
export const lapsedWhy = (step: StepReading): string => railLapsedWhy(step, (p) => FLOW_PAPERS[p]?.short ?? p) ?? 'lapsed'

/** The first paper of theirs the step still waits on: what Remind now asks for, and what the row says we wait on. */
export function paperToAsk(def: FlowStep, step: StepReading): PaperId | null {
  const facts = factsNow(step)
  for (const paper of def.papers) {
    const read = facts.find((x) => x.fact.paper === paper)
    if (read && !read.fact.ours && read.mark !== 'ok') return paper
  }
  return null
}

/** A paper's sends in words: 'First sent Sep 30, 2 days ago. No reminder yet.' */
export function historyWords(sends: readonly string[] | undefined, now: Date): string {
  const first = sends?.[0]
  if (!first || !sends) return ''
  const n = daysSince(first, now)
  const head = `First sent ${monthDay(first)}, ${n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`}.`
  const reminders = sends.slice(1)
  const last = reminders[reminders.length - 1]
  if (!last) return `${head} No reminder yet.`
  return `${head} Reminded ${reminders.length === 1 ? 'once' : `${reminders.length} times`}, last ${monthDay(last)}.`
}

// ---------- the one rule ----------

/** A lapsed paper's reminder waits this many quiet days at most, whatever the step's own count. */
const LAPSED_AFTER = 3

export type NudgeReason =
  | 'off'
  | 'not on'
  | 'none open'
  | 'waiting'
  /** The review ask (v2.5943): the customer waits on an answer from us, so no ask goes. */
  | 'they wait'
  /** The review ask (v2.5943): due, the step before it turned true its count of days ago. */
  | 'after prior'
  | 'portal'
  | 'no reminder'
  | 'ours'
  | 'held'
  | 'pressed'
  | 'late'
  | 'quiet'
  | 'lapsed'
  | 'we wrote'
  | 'not yet'

export interface NudgeDue {
  /** The step's reminder is on Follow up today. */
  due: boolean
  reason: NudgeReason
  /** The quiet days the reminder waits for: the step's own, or three for a lapsed paper when that is fewer. */
  after: number
  /** Their quiet days; null when they have said nothing yet. */
  quiet: number | null
}

export interface NudgeOptions {
  /**
   * A paper Follow up already shows on a portal row in Needs you (an open change order they opened and left, or never
   * opened), by the person, the paper and its open round's key: its nudge stays out before the row's line is written,
   * since the portal row wins. The key is `NudgeStep.round`'s, a change order's `gc_change_orders` row id. Follow up's
   * queue passes the papers its portal rows show; the card passes the same, so its Reminder line agrees.
   */
  skip?: (contactId: string, paper: PaperId, key: string | null) => boolean
}

/** A person's mark on one step. */
export const markOf = (person: PersonFlow, stepId: string, jobId: string | null): NudgeMark | null =>
  person.marks.find((m) => m.stepId === stepId && (m.jobId ?? null) === jobId) ?? null

/** The hold's day, while it still holds today. */
export const heldUntil = (mark: NudgeMark | null, now: Date): string | null =>
  mark?.holdUntil && todayYmdInAppTz(now) < mark.holdUntil ? mark.holdUntil : null

/** Remind now holds until we next send them anything. */
const pressed = (mark: NudgeMark | null, person: PersonFlow): boolean =>
  !!mark?.nudgedAt && (person.lastOutAt == null || Date.parse(person.lastOutAt) <= Date.parse(mark.nudgedAt))

/** Days since our last message to them; never written counts as forever. */
const oursQuiet = (person: PersonFlow, now: Date): number =>
  person.lastOutAt == null ? Number.POSITIVE_INFINITY : daysSince(person.lastOutAt, now)

// ---------- the review ask: the one reminder on our own move (v2.5943, punch list #185) ----------

/** The steps whose reminder counts from the step before them turning true, our move or not: the residential review ask after Paid. */
const AFTER_PRIOR: Readonly<Partial<Record<FlowKind, readonly string[]>>> = { residential: ['review'] }
export const afterPrior = (kind: FlowKind, stepId: string): boolean => (AFTER_PRIOR[kind] ?? []).includes(stepId)

/** The step before this one in its lane, once it turned true: its name and the days since the latest of its facts. Null before. */
export function priorDone(person: PersonFlow, step: Pick<StepReading, 'stepId' | 'jobId' | 'lane'>, now: Date): { name: string; days: number } | null {
  const lane = person.reading.lanes.find((l) => l.lane === step.lane && (l.jobId ?? null) === (step.jobId ?? null))
  if (!lane) return null
  const i = lane.steps.findIndex((x) => x.stepId === step.stepId)
  const prior = i > 0 ? lane.steps[i - 1] : null
  if (!prior || prior.state !== 'done') return null
  const today = todayYmdInAppTz(now)
  const days = prior.facts.flatMap((f) => {
    const d = f.at ? ymdDaysBetween(f.at, today) : null
    return d == null ? [] : [d]
  })
  if (!days.length) return null
  return { name: stepById(person.flow, prior.stepId)?.name ?? prior.stepId, days: Math.min(...days) }
}

const agoWords = (days: number): string => (days === 0 ? 'today' : `${plural(days, 'day')} ago`)

/**
 * Whether a step's reminder is on Follow up today, and why: the step is on now or lapsed, it is their move or both
 * sides', nothing holds it, it waits on nobody else, and Remind now was pressed, its day passed, or the thread has
 * been quiet its count of days. Quiet needs their last word and our last message both that far back, as the
 * prototype's one count did, so a reminder we just sent is never sent again the next morning. A step aside (change
 * orders) is on now while a round is open, and nudges like any other; where Follow up already shows its paper on a
 * portal row (`NudgeOptions.skip`), the portal row wins and carries whether they opened it (the lead's ruling).
 */
export function nudgeDue(person: PersonFlow, step: StepReading, now: Date, options: NudgeOptions = {}): NudgeDue {
  const def = stepById(person.flow, step.stepId)
  const n = def?.nudge ?? null
  const lapsed = step.state === 'lapsed'
  const after = lapsed ? Math.min(LAPSED_AFTER, n && n.days > 0 ? n.days : LAPSED_AFTER) : (n?.days ?? 0)
  const quiet = person.quietDays
  const say = (due: boolean, reason: NudgeReason): NudgeDue => ({ due, reason, after, quiet })
  const { reading } = person
  if (reading.off || reading.kind === 'unknown') return say(false, 'off')
  if (!(step.state === 'now' || lapsed)) return say(false, 'not on')
  // A loop on now with no round open waits on us to open one: nothing is asked of them yet.
  if (def?.loop && !lapsed && !step.rounds.some((r) => r.state === 'now')) return say(false, 'none open')
  if (step.waitingOn) return say(false, 'waiting')
  const open = step.rounds.find((r) => r.state === 'now')
  const skip = options.skip
  if (def && skip && def.papers.some((p) => skip(person.id, p, open?.key ?? null))) return say(false, 'portal')
  if (!def || !n) return say(false, 'no reminder')
  // The review ask (v2.5943): our move, so quiet days mean nothing. It counts from the step before it turning true (Paid)
  // and never goes while the customer waits on an answer from us.
  if (afterPrior(reading.kind, def.id)) {
    const mark = markOf(person, step.stepId, step.jobId)
    if (heldUntil(mark, now)) return say(false, 'held')
    if (pressed(mark, person)) return say(true, 'pressed')
    if (person.court === 'ours') return say(false, 'they wait')
    const prior = priorDone(person, step, now)
    if (!prior) return say(false, 'not yet')
    return prior.days >= after ? say(true, 'after prior') : say(false, 'not yet')
  }
  // Whose move by its facts (`moverOf`): an addendum the architect filed is ours to send on, so no reminder goes to them.
  if (moverOf(def, step) === 'us') return say(false, 'ours')
  const mark = markOf(person, step.stepId, step.jobId)
  if (heldUntil(mark, now)) return say(false, 'held')
  if (pressed(mark, person)) return say(true, 'pressed')
  if (dayOf(step)?.late) return say(true, 'late')
  if (after > 0 && (quiet ?? Number.POSITIVE_INFINITY) >= after) {
    if (oursQuiet(person, now) < after) return say(false, 'we wrote')
    return say(true, lapsed ? 'lapsed' : 'quiet')
  }
  return say(false, 'not yet')
}

/** Remind now: the step's row is on Follow up today, and a hold on it ends. */
export const nudgeNow = (mark: NudgeMark, now: Date): NudgeMark => ({ ...mark, nudgedAt: now.toISOString(), holdUntil: null })

/** Hold until Mon: the reminder stays quiet through Sunday. The step does not move. */
export const holdNudge = (mark: NudgeMark, now: Date): NudgeMark => ({ ...mark, holdUntil: nextMonday(now) })

/** A step with no reminder of its own: nothing to press on its card. */
export const noReminder = (reason: NudgeReason): boolean => reason === 'off' || reason === 'no reminder' || reason === 'ours'

/** A reminder the card shows without its presses: none of its own, the portal row's, or nothing open to remind of. */
export const nothingToPress = (reason: NudgeReason): boolean => noReminder(reason) || reason === 'portal' || reason === 'none open'

/** The step card's Reminder line: what the step's reminder does, and whether it is on Follow up now. */
export function reminderWords(person: PersonFlow, step: StepReading, now: Date, options: NudgeOptions = {}): string {
  const due = nudgeDue(person, step, now, options)
  const n = stepById(person.flow, step.stepId)?.nudge
  const first = person.first
  if (noReminder(due.reason) || !n) return 'No reminder on this step.'
  if (due.reason === 'none open') return `Nothing is open with ${first} on this step yet.`
  if (due.reason === 'held') return `Held until ${weekdayDate(markOf(person, step.stepId, step.jobId)?.holdUntil ?? null)}.`
  if (due.reason === 'pressed') return 'Remind now put it on Follow up today.'
  if (afterPrior(person.reading.kind, step.stepId)) {
    const prior = priorDone(person, step, now)
    const head = `${n.how.charAt(0).toUpperCase()}${n.how.slice(1)} ${n.days <= 1 ? 'the morning after' : `${n.days} days after`} ${prior?.name ?? 'the step before'}${n.send === 'app' ? ', sent by the app' : ''}.`
    if (due.reason === 'they wait') return `${head} ${first} is waiting on an answer from us, so not yet.`
    if (!prior) return `${head} Not there yet.`
    return `${head} ${prior.name} was ${agoWords(prior.days)}, so ${due.due ? 'it is on Follow up now' : 'not yet'}.`
  }
  if (due.reason === 'late') return `${first} passed the day. It is on Follow up now.`
  if (due.after <= 0) return `At ${n.dayFact ? NUDGE_DAY_WORDS[n.dayFact] : 'its day'}.`
  const head = `${n.how.charAt(0).toUpperCase()}${n.how.slice(1)} after ${plural(due.after, 'quiet day')}${n.send === 'app' ? ', sent by the app' : ''}.`
  const quiet =
    due.quiet == null ? `${first} has not written yet` : due.quiet === 0 ? `${first} wrote today` : `${first} has been quiet ${plural(due.quiet, 'day')}`
  if (due.reason === 'portal') return `${head} Follow up shows it as a portal row instead.`
  if (due.reason === 'we wrote' && person.lastOutAt) return `${head} ${quiet}. We wrote ${weekday(person.lastOutAt)}, so not yet.`
  return `${head} ${quiet}, so ${due.due ? 'it is on Follow up now' : 'not yet'}.`
}

// ---------- Follow up's rows ----------

/**
 * One step a Follow up row carries: a step of theirs on now (on any job), a lapsed step, or a step of theirs someone
 * else's waits on.
 */
export interface NudgeStep {
  stepId: string
  jobId: string | null
  /** Its reminder is due today. */
  due: boolean
  /** Days past its day (above 0), on it (0) or before it (below 0); null when it has no day. */
  lateDays: number | null
  /** The row's one message names it: the worst step, and any other that is due today, late, or due within the week. */
  named: boolean
  lapsed: boolean
  /** Its line: 'late 2 days · waiting on their quote'. */
  why: string
  how: NudgeHow
  /** The paper of theirs it waits on, for the reply box's ask. */
  paper: PaperId | null
  /** The person whose step waits on this one: Elena, on Jonah's certificate. */
  waitedOnBy: string | null
  /**
   * The key of its round on now (`RoundReading.key`), for a loop: the row the round is. A change order's is its
   * `gc_change_orders` row id, the same id as helper 4's `RoundStamp.key` and helper 8's `PaperView.id`, so Follow
   * up's portal rows and these steps name a change order by one id.
   */
  round: string | null
}

/**
 * One row of Follow up's *Nudges from the flow*. **One row per person, never one per job**: Follow up is one queue,
 * and Greg on two bids is still one call. The row carries each of their steps on now that has a reminder, on every
 * job, worst first (`worstFirst`), so "one row per step on now" holds inside the row; their lapsed steps fold into it;
 * a step of theirs that someone else's waits on joins it. The nudge is one message: it names the worst step and any
 * other that is due today, late, or due within the week (`NudgeStep.named`). The row's step, job, channel and paper
 * are its worst step's.
 */
export interface NudgeRow {
  contactId: string
  stepId: string
  jobId: string | null
  /** The channel the flow asked for (`NUDGE_HOW_WORDS` has the words). */
  how: NudgeHow
  /** The row's line: the worst step's, then each other step with its job or its name, then the lapsed ones folded in. */
  why: string
  paper: PaperId | null
  /** Every step the row carries, worst first. */
  steps: NudgeStep[]
}

/** Within this many days, a step's day is named in the row's one message. */
const NAMED_WITHIN = 7

/** Worst first: due today before not, then the most days late (or the soonest day), then a dated step before one with none. */
export function worstFirst(a: Pick<NudgeStep, 'due' | 'lateDays'>, b: Pick<NudgeStep, 'due' | 'lateDays'>): number {
  if (a.due !== b.due) return a.due ? -1 : 1
  const la = a.lateDays ?? Number.NEGATIVE_INFINITY
  const lb = b.lateDays ?? Number.NEGATIVE_INFINITY
  return la === lb ? 0 : lb > la ? 1 : -1
}

const quietWords = (quiet: number | null): string =>
  quiet == null ? 'no word from them yet' : quiet === 0 ? 'wrote today' : `quiet ${plural(quiet, 'day')}`

function rowWhy(person: PersonFlow, def: FlowStep, step: StepReading, due: NudgeDue, now: Date): string {
  const paper = paperToAsk(def, step)
  // What the step waits on: a paper of theirs by name, else what finishes it ('done when their answer came').
  const waitingOn = paper ? `waiting on ${paperName(paper)}` : `done when ${doneWords(def)}`
  if (due.reason === 'after prior') {
    const prior = priorDone(person, step, now)
    return `${prior ? `${prior.name} was ${agoWords(prior.days)}` : 'the step before is done'} · the flow says ${def.nudge ? NUDGE_HOW_WORDS[def.nudge.how] : 'a reminder'}. ${waitingOn.charAt(0).toUpperCase()}${waitingOn.slice(1)}.`
  }
  const facts = factsNow(step)
  const sent = def.papers.find((p) => paperSigned(p) && facts.some((x) => x.fact.paper === p && x.fact.ours && x.mark === 'wait'))
  if (sent) {
    const history = historyWords(person.sends[sent], now)
    return `${paperName(sent)} went to sign${history ? ` · ${history}` : ''}`
  }
  const day = dayOf(step)
  if (day?.late) return `${day.words} · ${waitingOn}`
  if (step.state === 'lapsed') return `${lapsedWhy(step)} · ${quietWords(due.quiet)}`
  const tail = paper ? `We are waiting on ${paperName(paper)}.` : `Done when ${doneWords(def)}.`
  return `${quietWords(due.quiet)} · the flow says ${def.nudge ? NUDGE_HOW_WORDS[def.nudge.how] : 'a reminder'}. ${tail}`
}

/** A step someone else's waits on is due once their own hold, Remind now and our last message to them allow, as any other. */
function waitingDue(other: PersonFlow, step: StepReading, days: number, now: Date): boolean {
  const n = stepById(other.flow, step.stepId)?.nudge
  if (!n || other.reading.off || other.reading.kind === 'unknown') return false
  const mark = markOf(other, step.stepId, step.jobId)
  if (heldUntil(mark, now)) return false
  if (pressed(mark, other)) return true
  return days >= n.days && oursQuiet(other, now) >= n.days
}

/** A step on now that is not ours, not held, has a reminder and waits on nobody else: a row can carry it. */
const CARRIED: ReadonlySet<NudgeReason> = new Set<NudgeReason>(['pressed', 'late', 'quiet', 'lapsed', 'we wrote', 'not yet', 'after prior'])

interface Carried extends NudgeStep {
  /** Its words beside another step's in the row's line: its day, how long it has waited, or what lapsed. */
  short: string
}

/** The steps of one person a row would carry, in the order a tie keeps: the step on now, the others, the lapsed. */
function carried(person: PersonFlow, people: readonly PersonFlow[], now: Date, options: NudgeOptions): Carried[] {
  const { reading } = person
  if (reading.off || reading.kind === 'unknown') return []
  const isNow = (s: StepReading) => s.stepId === reading.nowStepId && s.jobId === reading.nowJobId
  const places = placesOf(reading).sort((a, b) => Number(isNow(b)) - Number(isNow(a)) || Number(a.state === 'lapsed') - Number(b.state === 'lapsed'))
  const out: Carried[] = []
  for (const step of places) {
    const def = stepById(person.flow, step.stepId)
    const due = nudgeDue(person, step, now, options)
    const lapsed = step.state === 'lapsed'
    if (!def?.nudge || (!lapsed && !CARRIED.has(due.reason))) continue
    const day = dayOf(step)
    out.push({
      stepId: step.stepId,
      jobId: step.jobId,
      due: due.due,
      lateDays: day?.lateDays ?? null,
      named: false,
      lapsed,
      why: lapsed && !due.due ? lapsedWhy(step) : rowWhy(person, def, step, due, now),
      how: def.nudge.how,
      paper: paperToAsk(def, step),
      waitedOnBy: null,
      round: step.rounds.find((r) => r.state === 'now')?.key ?? null,
      short: lapsed ? lapsedWhy(step).replace(/^lapsed · /, '') : (day?.words ?? (due.due ? (due.reason === 'after prior' ? `after ${(priorDone(person, step, now)?.name ?? 'the step before').toLowerCase()}` : quietWords(due.quiet)) : '')),
    })
  }
  for (const waiter of people) {
    if (waiter === person) continue
    for (const step of placesOf(waiter.reading)) {
      const w = step.waitingOn
      if (w?.contactId !== person.id) continue
      const theirs = stepReading(reading, w.stepId, step.jobId) ?? reading.lanes.flatMap((l) => l.steps).find((x) => x.stepId === w.stepId)
      const n = stepById(person.flow, w.stepId)?.nudge
      if (!theirs || !n) continue
      const days = daysSince(w.since, now)
      if (!waitingDue(person, theirs, days, now)) continue
      const name = stepById(waiter.flow, step.stepId)?.name.toLowerCase() ?? 'step'
      const why = `with ${person.first} ${plural(days, 'day')} · ${waiter.first}'s ${name} waits on it`
      const own = out.find((x) => x.stepId === theirs.stepId && x.jobId === theirs.jobId)
      if (own) Object.assign(own, { due: true, why, paper: null, waitedOnBy: waiter.id, short: `with ${person.first} ${plural(days, 'day')}` })
      else
        out.push({
          stepId: theirs.stepId,
          jobId: theirs.jobId,
          due: true,
          lateDays: null,
          named: false,
          lapsed: false,
          why,
          how: n.how,
          paper: null,
          waitedOnBy: waiter.id,
          round: theirs.rounds.find((r) => r.state === 'now')?.key ?? null,
          short: `with ${person.first} ${plural(days, 'day')}`,
        })
    }
  }
  return out
}

/**
 * The rows Follow up lists under *Nudges from the flow*, one per person with anything due (`NudgeRow` has the rule),
 * the quietest first.
 */
export function nudgeRows(people: readonly PersonFlow[], now: Date, options: NudgeOptions = {}): NudgeRow[] {
  const out: NudgeRow[] = []
  for (const person of people) {
    const steps = carried(person, people, now, options).sort(worstFirst)
    const first = steps[0]
    if (!first?.due) continue
    steps.forEach((s, i) => {
      s.named = i === 0 || s.due || (s.lateDays != null && s.lateDays >= -NAMED_WITHIN)
    })
    const jobs = new Set(steps.filter((s) => !s.lapsed && s.jobId).map((s) => s.jobId))
    const label = (s: Carried) => {
      const name = stepById(person.flow, s.stepId)?.name ?? s.stepId
      return jobs.size > 1 && s.jobId ? (person.jobs?.[s.jobId] ?? name) : name
    }
    const parts = [jobs.size > 1 ? `${label(first)}: ${first.why}` : first.why]
    for (const s of steps.slice(1)) if (!s.lapsed) parts.push(s.short ? `${label(s)}: ${s.short}` : label(s))
    const folded = steps.slice(1).filter((s) => s.lapsed)
    const why = parts.join(' · ') + (folded.length ? ` · ${folded.map((s) => s.short).join(', ')}` : '')
    out.push({
      contactId: person.id,
      stepId: first.stepId,
      jobId: first.jobId,
      how: first.how,
      why,
      paper: first.paper,
      steps: steps.map(({ short: _short, ...s }) => s),
    })
  }
  const quiet = new Map(people.map((p) => [p.id, p.quietDays ?? Number.MAX_SAFE_INTEGER]))
  return out.sort((a, b) => (quiet.get(b.contactId) ?? 0) - (quiet.get(a.contactId) ?? 0))
}
