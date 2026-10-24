/**
 * Messages, cut 4: the step card in plain words, lifted from the prototype v1.178 (branch spike/gc-mode,
 * `to-dos/gc-mode/messages/prototype.html`: `stepCardHtml`, `offCardHtml`, `portalSoFar`, `paperAct`, `factWords`,
 * `whoNow`). A title, one sentence that says where the step stands, then only the sections that apply: what we need
 * (or have, or each round), until then, next, the reminder, so far. The sentences are the prototype's; a day or a
 * name inside one comes from the stamps (`FactReading`'s day and who), where the prototype had them typed. The card
 * is a model the screen draws, with each press named and its hover card as `{ name, does, changes }`.
 *
 * In: the person (`PersonFlow` in `nudges.ts`: the flow, its reading, and what the reading does not hold), the step
 * and its job, and the other people, for a step that waits on someone else's.
 *
 * `stepStrip` folds the card to one line above the reply box (residential R4 · 3, integration 5): the step's name, whose
 * move, the days, and the presses that move it, each with what it opens and what it writes.
 */
import { FLOW_PAPERS, factById, type PaperId } from './facts'
import {
  clock,
  dayOf,
  daysSince,
  doneWords,
  factsNow,
  monthDay,
  nothingToPress,
  nudgeDue,
  paperName,
  paperSigned,
  plural,
  reminderWords,
  weekday,
  type NudgeOptions,
  type PersonFlow,
} from './nudges'
import type { AppSends } from './nudgeDispatch'
import { laneReadingOf, moverOf, stepById, type FactReading, type FlowStep, type LaneReading, type StepReading } from './state'

// ---------- the model ----------

/** A press on the card. `paper`, `round`, `who`, `stepId` and `jobId` say what it acts on. */
export interface CardPress {
  id: PressId
  label: string
  tip?: Tip
  primary?: true
  paper?: PaperId
  /** The round's key, for a press on one round of a loop. */
  round?: string
  who?: string
  stepId?: string
  jobId?: string | null
}

export type PressId =
  | 'open'
  | 'remindThem'
  | 'sendIt'
  | 'askForIt'
  | 'askAgain'
  | 'remind'
  | 'ask'
  | 'fileByHand'
  | 'sendItNow'
  | 'openThread'
  | 'remindOtherNow'
  | 'remindNow'
  | 'holdUntilMon'
  | 'seeIt'
  | 'addNote'
  | 'skip'
  | 'putBack'
  | 'seeTheirPage'
  | 'openBid'
  | 'putBackOn'
  | 'approveFor'
  | 'moveTheDay'
  | 'sendAgain'
  | 'declined'
  | 'sendBillAgain'
  | 'markPaidByCheck'
  | 'askForReview'
  // Add their qualifications (spike): the owner's scale for the trades, on a candidate's or a sub's Rated step.
  | 'qualifications'

/** A hover card: the press's name, what it does, what it changes. */
export interface Tip {
  name: string
  does: string
  changes: string
}

/** A run of words; a part may read late (orange) or be a press inside the sentence. */
export type Words = { text: string; late?: true; press?: CardPress }[]

/** The words alone, as one string. */
export const wordsText = (words: Words): string => words.map((x) => x.text).join('')

/** A line with its mark: ✓ ok, ○ no, ↗ wait, ! bad, – off, → next. */
export interface CardLine {
  mark: FactReading['mark'] | 'off' | 'next'
  text: string
  small: Words
  presses: CardPress[]
}

export type SectionId = 'need' | 'have' | 'rounds' | 'untilThen' | 'next' | 'reminder' | 'soFar' | 'why' | 'stops' | 'backOn'

/** One section, drawn in this order: lines, says, history (or empty), team notes, presses. */
export interface CardSection {
  id: SectionId
  heading: string
  lines: CardLine[]
  says: Words[]
  history: { label: string; words: string }[]
  teamNotes: { by: string; text: string; when: string }[]
  /** 'None yet.' under a loop with no rounds; 'Nothing yet.' under So far with no history. */
  empty: string | null
  presses: CardPress[]
}

export interface StepCard {
  title: string
  status: Words
  sections: CardSection[]
}

// ---------- the hover cards ----------

export const CARD_TIPS = {
  open: (name: string): Tip => ({ name: 'Open', does: `Opens ${name} as it is on file.`, changes: 'Nothing changes.' }),
  remindThem: (name: string): Tip => ({
    name: 'Remind them',
    does: `Opens the reminder to sign ${name}. It shows when it first went and how many reminders followed.`,
    changes: 'Nothing goes until Send the reminder.',
  }),
  sendIt: (name: string, signed: boolean): Tip => ({
    name: 'Send it',
    does: `Sends ${name} as an email with the paper, the way the company window does. The sent copy is filed and shown in the thread.`,
    changes: signed ? 'The step waits on their signature after that.' : 'The step is done once it goes.',
  }),
  askForIt: {
    name: 'Ask for it',
    does: "Fills the reply box with the step's line and their portal link, where they upload it.",
    changes: 'Nothing sends until you press Send.',
  },
  fileByHand: {
    name: 'File one we were handed',
    does: 'A paper handed to us in the office is filed here. It keeps a file or a photo, the date and who filed it.',
    changes: 'The step finishes the same way as an upload.',
  },
  sendItNow: { name: 'Send it now', does: 'Gets one step ahead: sends it while this step is still open.', changes: 'Never two steps ahead.' },
  remindNow: {
    name: 'Remind now',
    does: "Puts it on Follow up today, with the step's line ready in the reply box.",
    changes: 'Nothing sends until you press Send.',
  },
  holdUntilMon: { name: 'Hold until Mon', does: 'Keeps the reminder quiet until Monday.', changes: 'The step does not move.' },
  seeIt: { name: 'See it', does: 'What the reminder looks like when it goes.', changes: 'Nothing sends.' },
  addNote: { name: 'Add a note', does: 'A team note on this step. It reads here and in the thread.', changes: 'Only the team sees it.' },
  skip: (first: string): Tip => ({
    name: `Skip for ${first}`,
    does: `Skips this step for ${first} alone, with a reason.`,
    changes: 'The step stays for everyone else.',
  }),
  seeTheirPage: {
    name: 'See their page',
    does: "Their portal's first page, where this flow reads from their side.",
    changes: 'What they see. Nothing of ours shows.',
  },
} as const

/** The strip's own presses' hover cards: a residential step's, keyed on the step they are on (`stepStrip`). */
export const STRIP_TIPS = {
  approveFor: (first: string, me: string): Tip => ({
    name: `Approve for ${first}`,
    does: `Marks the estimate approved, the same as ${first}'s own press on it.`,
    changes: `The step is done. The record says ${me || 'you'} pressed it by phone.`,
  }),
  moveTheDay: { name: 'Move the day', does: 'Opens dispatch at this job, to move its day.', changes: 'Nothing changes until you move it there.' },
  sendAgain: (first: string): Tip => ({
    name: 'Send it again',
    does: `Sends the estimate to ${first} again, the way it went the first time.`,
    changes: `The step keeps waiting on ${first}.`,
  }),
  declined: (first: string): Tip => ({
    name: `${first} declined`,
    does: `Marks the estimate declined, the same as ${first}'s own decline on it.`,
    changes: 'The estimate reads declined. A new one can go after.',
  }),
  sendBillAgain: (first: string): Tip => ({
    name: 'Send the bill again',
    does: `Sends the bill to ${first} again, the way it went the first time.`,
    changes: `The step keeps waiting on ${first}.`,
  }),
  markPaidByCheck: {
    name: 'Mark paid by check',
    does: 'Opens the record payment window for this bill, set to a check.',
    changes: 'Nothing changes until you save the amount, the day and the check number.',
  },
  askForReview: {
    name: 'Ask for a review',
    does: 'Fills the reply box with the review line.',
    changes: 'Nothing sends until you press Send.',
  },
} as const

// ---------- the words the card is made of ----------

const section = (id: SectionId, heading: string, parts: Partial<Omit<CardSection, 'id' | 'heading'>> = {}): CardSection => ({
  id,
  heading,
  lines: [],
  says: [],
  history: [],
  teamNotes: [],
  empty: null,
  presses: [],
  ...parts,
})

const said = (text: string): Words => [{ text }]

const capital = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`

const label = (paper: PaperId): string => FLOW_PAPERS[paper]?.label ?? paper

/** A paper after 'the': 'the start date letter', and 'the contract' where the label says 'Our contract'. */
const theLabel = (paper: PaperId): string => label(paper).toLowerCase().replace(/^our /, '')

/** The facts that read 'signed' when true, where the rest read 'on file': the W-9, the agreements, the contract. */
const SIGNED_FACT = /_signed$/

/**
 * The latest day among facts that came true: the day a step or a round was done. A fact that ran out is left out, so
 * a lapsed step keeps the day it was done, not the day its paper ran out.
 */
function latestDay(facts: readonly FactReading[]): string | null {
  let last: string | null = null
  for (const f of facts) if (f.mark === 'ok' && f.at && (last == null || f.at > last)) last = f.at
  return last
}

/** The day a step was done: its facts', or its last done round's. */
const doneDay = (step: StepReading): string | null =>
  latestDay(step.facts) ?? latestDay(step.rounds.filter((r) => r.state === 'done').flatMap((r) => r.facts))

/** A fact's line on the card: 'signed Sep 12', 'ran out Sep 30', 'not sent yet', or the day and who of a fact. */
export function factWords(f: FactReading): string {
  const { fact, mark } = f
  if (!fact.paper) {
    if (mark !== 'ok') return 'not yet'
    if (!f.at) return 'done'
    return f.by ? `${f.by}, ${weekday(f.at)}` : weekday(f.at)
  }
  if (mark === 'ok') return `${SIGNED_FACT.test(fact.id) ? 'signed' : 'on file'}${f.at ? ` ${monthDay(f.at)}` : ''}`
  if (mark === 'bad') return `ran out${f.until ? ` ${monthDay(f.until)}` : ''}`
  if (mark === 'wait') return `sent${f.at ? ` ${monthDay(f.at)}` : ''}, waiting on their signature`
  return fact.ours ? 'not sent yet' : 'nothing yet'
}

/** A fact's name on the card: the paper's label, or the fact's own words. */
const factLabel = (f: FactReading): string => (f.fact.paper ? label(f.fact.paper) : capital(f.fact.text))

/** What can be done about a paper from its line: open it, remind them, send it, or ask for it. */
function paperPresses(f: FactReading): CardPress[] {
  const paper = f.fact.paper
  if (!paper) return []
  const name = paperName(paper)
  if (f.mark === 'ok') return [{ id: 'open', label: 'Open', tip: CARD_TIPS.open(name), paper }]
  if (f.mark === 'wait') return f.fact.ours ? [{ id: 'remindThem', label: 'Remind them', tip: CARD_TIPS.remindThem(name), paper }] : []
  if (f.fact.ours) return [{ id: 'sendIt', label: 'Send it', tip: CARD_TIPS.sendIt(name, paperSigned(paper)), primary: true, paper }]
  return [{ id: 'askForIt', label: 'Ask for it', tip: CARD_TIPS.askForIt, primary: true, paper }]
}

/**
 * Whose move a step is (the prototype's `whoNow`): waiting when it waits on someone else; the step's own side when it
 * is not on now, or is a per-job step that is one side's; otherwise ours when we owe them, then the thread's court.
 */
export function whoseMove(
  step: Pick<FlowStep, 'who'>,
  at: { onNow: boolean; waiting: boolean; perJob: boolean; owe: boolean; court: 'ours' | 'theirs' | null },
): 'us' | 'them' | 'both' | 'wait' {
  if (at.waiting) return 'wait'
  if (!at.onNow) return step.who
  if (at.perJob && step.who !== 'both') return step.who
  if (at.owe || at.court === 'ours') return 'us'
  if (at.court === 'theirs') return 'them'
  return step.who
}

/** The lanes one job reads, in the flow's order: the Once lane, the job's Per job lane, Any time. */
const lanesFor = (person: PersonFlow, jobId: string | null): LaneReading[] =>
  person.reading.lanes.filter((l) => l.lane !== 'per_job' || l.jobId === jobId)

// ---------- the card ----------

interface At {
  person: PersonFlow
  def: FlowStep
  step: StepReading
  /** The step's state as the card reads it: a step aside (change orders) has none of its own; its rounds say it. */
  state: StepReading['state']
  /** The steps this job reads, in the flow's order, and where this one sits. */
  order: StepReading[]
  index: number
  lane: LaneReading
  other: PersonFlow | null
  now: Date
  options: NudgeOptions
}

/** Whose move a step on now is, by its facts and the thread. */
function moveOnNow({ person, def, step }: Pick<At, 'person' | 'def' | 'step'>): 'us' | 'them' | 'both' | 'wait' {
  // Whose move by its facts: Jonah filed the addendum, so sending it on is ours (`moverOf`).
  return whoseMove({ who: moverOf(def, step) }, {
    onNow: step.stepId === person.reading.nowStepId && step.jobId === person.reading.nowJobId,
    waiting: false,
    perJob: step.lane === 'per_job',
    owe: person.owe,
    court: person.court,
  })
}

/** The sentence under the title that says where the step stands. */
function statusWords({ person, def, step, state, order, index, other, now }: At): Words {
  const first = person.first
  if (def.aside && state !== 'skipped') {
    const open = step.rounds.filter((r) => r.state === 'now').length
    const n = step.rounds.length
    return said(n ? `Any time in the job. ${n} so far${open ? `, ${open} open` : ''}.` : 'Any time in the job. None yet.')
  }
  if (state === 'done') {
    const day = doneDay(step)
    return said(day ? `Done ${weekday(day)}.` : 'Done.')
  }
  if (state === 'skipped') return said(`Skipped for ${first}: ${(step.skip?.why ?? '').replace(/\.$/, '')}.`)
  if (state === 'lapsed') {
    const bad = step.facts.find((x) => x.mark === 'bad')
    const what = step.lapsedPaper ? label(step.lapsedPaper).toLowerCase() : (bad?.fact.text ?? 'paper')
    return said(`${first}'s ${what} ran out${bad?.until ? ` ${monthDay(bad.until)}` : ''}. We need a new one.`)
  }
  if (step.waitingOn) {
    const days = daysSince(step.waitingOn.since, now)
    return said(`Waiting on ${other?.first ?? 'someone else'}, ${plural(days, 'day')}. Not ${first}'s move and not ours.`)
  }
  if (state === 'now') {
    const move = moveOnNow({ person, def, step })
    const who = move === 'us' ? 'Our move' : move === 'them' ? `${first}'s move` : 'Both sides'
    const onFor = step.since ? daysSince(step.since, now) : null
    const forWords = onFor != null ? ` On it ${plural(onFor, 'day')}${def.usual ? `, usually ${def.usual}` : ''}.` : ''
    const day = dayOf(step)
    if (day?.late) return [{ text: `${who}.${forWords} ` }, { text: `Late ${plural(day.lateDays, 'day')}.`, late: true }]
    return said(`${who}.${forWords}${day ? ` Due ${weekday(day.due)}.` : ''}`)
  }
  const prev = order[index - 1]
  const prevName = prev ? stepById(person.flow, prev.stepId)?.name : null
  return said(`Not started yet.${prevName ? ` Comes after ${prevName}.` : ''}`)
}

/** What we need (or have): each fact with its paper's day and what to do about it. */
function needSection({ def, step, state }: At): CardSection {
  const lines = step.facts.map((f): CardLine => ({ mark: f.mark, text: factLabel(f), small: said(factWords(f)), presses: paperPresses(f) }))
  const handed = step.facts.some((x) => x.fact.paper && !x.fact.ours && x.mark !== 'ok' && x.mark !== 'wait')
  const done = state === 'done'
  return section(done ? 'have' : 'need', done ? 'What we have' : 'What we need', {
    lines,
    says: def.join === 'or' ? [said('Either one finishes it.')] : [],
    presses: handed ? [{ id: 'fileByHand', label: 'File one we were handed', tip: CARD_TIPS.fileByHand, stepId: step.stepId, jobId: step.jobId }] : [],
  })
}

/** Each round of a loop: done, on now (late or due), or not asked yet. */
function roundsSection({ def, step }: At): CardSection {
  const lines = step.rounds.map((r): CardLine => {
    if (r.state === 'done') {
      const day = latestDay(r.facts)
      return { mark: 'ok', text: r.name, small: said(day ? weekday(day) : 'done'), presses: [{ id: 'open', label: 'Open', round: r.key }] }
    }
    if (r.state === 'now') {
      const small: Words = r.day
        ? r.day.late
          ? [{ text: `late ${plural(r.day.lateDays, 'day')}`, late: true }, { text: `, promised ${weekday(r.day.due)}` }]
          : said(`due ${weekday(r.day.due)}`)
        : said(r.opened ? `since ${weekday(r.opened)}` : 'their move')
      // The round's own open fact says whose move: an addendum filed waits on us to send it on.
      const them = moverOf(def, { facts: r.facts, rounds: [] }) === 'them'
      const press: CardPress = { id: them ? 'askAgain' : 'remind', label: them ? 'Ask again' : 'Remind', primary: true, round: r.key }
      if (def.papers[0]) press.paper = def.papers[0]
      return { mark: 'wait', text: r.name, small, presses: [press] }
    }
    return { mark: 'no', text: r.name, small: said(r.day ? `${r.day.words}, not asked yet` : 'not asked yet'), presses: [{ id: 'ask', label: 'Ask', round: r.key }] }
  })
  return section('rounds', capital(def.loop ?? ''), { lines, empty: lines.length ? null : 'None yet.' })
}

/** The step after this one in its lane, while this one is on: whose move, and the paper we send for it. */
function nextSection({ person, step, state, lane }: At): CardSection | null {
  if (state !== 'now' && state !== 'lapsed') return null
  const at = lane.steps.findIndex((x) => x.stepId === step.stepId)
  const next = lane.steps.slice(at + 1).find((x) => x.state !== 'skipped' && !stepById(person.flow, x.stepId)?.aside)
  const def = next ? stepById(person.flow, next.stepId) : null
  if (!next || !def || next.state === 'done') return null
  const ours = def.papers.map((p) => next.facts.find((x) => x.fact.paper === p)).find((x) => x?.fact.ours)
  const paper = ours?.fact.paper
  const mover = moverOf(def, next)
  const who = mover === 'us' ? 'our move' : mover === 'them' ? `${person.first}'s move` : 'both sides'
  const small =
    !ours || !paper
      ? `Done when ${doneWords(def)}.`
      : ours.mark === 'wait'
        ? `${label(paper)} is sent, waiting on their signature.`
        : `We send the ${theLabel(paper)} once this is done.`
  const presses: CardPress[] =
    ours && paper && ours.mark === 'no'
      ? [{ id: 'sendItNow', label: 'Send it now', tip: CARD_TIPS.sendItNow, paper, stepId: next.stepId, jobId: next.jobId }]
      : []
  return section('next', 'Next', { lines: [{ mark: 'next', text: `${def.name}, ${who}.`, small: said(small), presses }] })
}

/** The step's reminder, with Remind now and Hold until Mon when the step has one. */
function reminderSection({ person, step, now, options }: At): CardSection {
  const due = nudgeDue(person, step, now, options)
  const on = { stepId: step.stepId, jobId: step.jobId }
  const presses: CardPress[] = nothingToPress(due.reason)
    ? []
    : [
        { id: 'remindNow', label: 'Remind now', tip: CARD_TIPS.remindNow, ...on },
        { id: 'holdUntilMon', label: 'Hold until Mon', tip: CARD_TIPS.holdUntilMon, ...on },
        { id: 'seeIt', label: '⌕ see it', tip: CARD_TIPS.seeIt, ...on },
      ]
  return section('reminder', 'Reminder', { says: [said(reminderWords(person, step, now, options))], presses })
}

/** What their portal says about the papers of this step we sent: opened when, or not yet. */
export function portalSoFar(person: PersonFlow, step: StepReading): string[] {
  const portal = person.portal
  const def = stepById(person.flow, step.stepId)
  if (!portal || !def) return []
  const facts = factsNow(step)
  const out: string[] = []
  for (const paper of def.papers) {
    const f = facts.find((x) => x.fact.paper === paper)
    if (!f?.fact.ours) continue
    const open = portal.openChange
    const sent = paper === 'co' ? !!open : f.mark === 'wait' || (f.mark === 'ok' && !paperSigned(paper))
    if (!sent) continue
    const what = paper === 'co' && open ? (open.name.split(' · ')[0] ?? open.name).toLowerCase() : theLabel(paper)
    const seen = portal.views[paper]
    out.push(
      seen
        ? `${person.first} opened the ${what} ${weekday(seen)} ${clock(seen)}.${paperSigned(paper) ? ' Not signed.' : ''}`
        : `${person.first} has not opened the ${what} yet.`,
    )
  }
  return out
}

/** So far: the steps done before this one with their days, this one's own day, the portal, the team's notes. */
function soFarSection({ person, def, step, state, order, index }: At): CardSection {
  const first = person.first
  const history: CardSection['history'] = []
  const dayWords = (x: StepReading) => {
    const day = doneDay(x)
    return day ? weekday(day) : 'done'
  }
  for (const x of order.slice(0, index)) {
    const name = stepById(person.flow, x.stepId)?.name
    if (name && (x.state === 'done' || x.state === 'lapsed')) history.push({ label: name, words: dayWords(x) })
  }
  if (state === 'done' || state === 'lapsed') history.push({ label: def.name, words: dayWords(step) })
  if (state === 'lapsed') {
    const bad = step.facts.find((x) => x.mark === 'bad')
    history.push({ label: 'Ran out', words: `${bad?.until ? monthDay(bad.until) : 'Its day'}. Nobody did this. The date passed.` })
  }
  if (state === 'now' && step.since) {
    const have = def.loop ? [] : step.facts.filter((x) => x.mark === 'ok')
    const words = have.map((x) => `. ${x.fact.paper ? label(x.fact.paper) : x.fact.text} ${factWords(x)}`).join('')
    history.push({ label: def.name, words: `since ${weekday(step.since)}${words}` })
  }
  if (state === 'now' || def.loop) for (const words of portalSoFar(person, step)) history.push({ label: 'Portal', words })
  const on = { stepId: step.stepId, jobId: step.jobId }
  const presses: CardPress[] = [{ id: 'addNote', label: '+ a note', tip: CARD_TIPS.addNote, ...on }]
  if (state !== 'done' && state !== 'skipped') presses.push({ id: 'skip', label: `Skip for ${first}`, tip: CARD_TIPS.skip(first), ...on })
  if (state === 'skipped') presses.push({ id: 'putBack', label: 'Put it back', ...on })
  presses.push({ id: 'seeTheirPage', label: 'See their page', tip: CARD_TIPS.seeTheirPage, who: person.id })
  const notes = person.notes.filter((n) => n.stepId === step.stepId && (n.jobId == null || n.jobId === step.jobId))
  return section('soFar', 'So far', {
    history,
    empty: history.length ? null : 'Nothing yet.',
    teamNotes: notes.map((n) => ({ by: n.by, text: n.text, when: weekday(n.at) })),
    presses,
  })
}

/** The card for a person off the flow: why, what stops and what stays, and how they come back on. */
export function offCard(person: PersonFlow): StepCard {
  const off = person.reading.off
  const first = person.first
  const ended = person.reading.lanes.map((l) => l.ended).find((x) => x != null)
  const outcome = ended ? factById(ended)?.text : null
  return {
    title: 'Off the flow',
    status: said(`Since ${off ? weekday(off.since) : 'today'}.${outcome ? ` ${capital(outcome)}.` : ''}`),
    sections: [
      section('why', 'Why', {
        lines: [
          {
            mark: 'off',
            text: off?.why ?? '',
            small: said(off?.by ? `${off.by} marked ${first} off the flow with that reason.` : `${first} is off the flow with that reason.`),
            presses: ended ? [{ id: 'openBid', label: 'Open the bid', who: person.id }] : [],
          },
        ],
      }),
      section('stops', 'What stops, what stays', {
        says: [
          said(
            `Nudges stop. The thread, the papers and the jobs stay. ${first} stays in Messages and Customers under a filter, off the flow, folded by default.`,
          ),
        ],
      }),
      section('backOn', 'Back on', {
        says: [
          [
            { text: 'A new ask, a new bid, or ' },
            { text: `Put ${first} back on`, press: { id: 'putBackOn', label: `Put ${first} back on`, who: person.id } },
            { text: ` with a reason. ${first} re-enters at the step the facts say, not at the start.` },
          ],
        ],
      }),
    ],
  }
}

/**
 * The step card for one person's step on one job (null on the Once and Any time lanes), or the off-the-flow card when
 * they are off it and the step is not done. `people` holds whoever a step can wait on, for their name; `options` are
 * Follow up's (`nudgeRows`), so the Reminder line reads as the row does.
 */
export function stepCard(
  person: PersonFlow,
  stepId: string,
  jobId: string | null,
  now: Date,
  people: readonly PersonFlow[] = [],
  options: NudgeOptions = {},
): StepCard | null {
  const lane = laneReadingOf(person.reading, stepId, jobId)
  const step = lane?.steps.find((x) => x.stepId === stepId)
  const def = stepById(person.flow, stepId)
  if (!lane || !step || !def) return null
  if (person.reading.off && step.state !== 'done' && step.state !== 'lapsed') return offCard(person)
  const order = lanesFor(person, step.jobId).flatMap((l) => l.steps)
  const index = order.findIndex((x) => x === step)
  const w = step.waitingOn
  const other = w ? (people.find((p) => p.id === w.contactId) ?? null) : null
  const state = def.aside && step.state !== 'skipped' ? 'later' : step.state
  const at: At = { person, def, step, state, order, index, lane, other, now, options }
  const sections: CardSection[] = [def.loop ? roundsSection(at) : needSection(at)]
  const first = person.first
  if (state === 'lapsed') {
    const coi = step.lapsedPaper === 'coi'
    sections.push(
      section('untilThen', 'Until then', {
        says: [said(coi ? `No statement of work can go to ${first}. ${first} can still quote.` : 'The steps after this one wait.')],
      }),
    )
  }
  if (w) {
    const of = other?.first ?? 'Someone else'
    const paper = other ? stepById(other.flow, w.stepId)?.papers[0] : undefined
    sections.push(
      section('untilThen', 'Until then', {
        says: [said(`${of} has it${paper ? ` for ${paperName(paper)}` : ''}. Nothing reminds ${first}. The reminder goes to ${of}.`)],
        presses: [
          { id: 'openThread', label: `Open ${of}'s thread`, who: w.contactId },
          { id: 'remindOtherNow', label: `Remind ${of} now`, who: w.contactId, stepId: w.stepId },
        ],
      }),
    )
  }
  const next = nextSection(at)
  if (next) sections.push(next)
  // A step aside has a Reminder line while a round is open, though it reads by its rounds everywhere else.
  const reminds = state === 'now' || state === 'lapsed' || (def.aside && step.state === 'now')
  if (reminds && !w) sections.push(reminderSection(at))
  sections.push(soFarSection(at))
  return { title: def.name, status: statusWords(at), sections }
}

// ---------- the strip above the box ----------

/** What a strip press writes, for the screen that does it. The kernel calls nothing. */
export type StripWrite =
  /**
   * Approve for them: accept-estimate's write on the job's sent estimate (`estimates`, guarded on `status = 'sent'`, to
   * `customer_accepted` with `acceptor_consented_at` now and `acceptor_printed_name`). The printed name is the office
   * user's, with "by phone" on the audit row's note, so the trail says a person pressed it for them. No IP, browser or
   * signature. `how` has no column yet: the edge PR that lets accept-estimate take it reads this.
   */
  | { kind: 'accept_estimate'; jobId: string | null; printedName: string; auditNote: 'by phone'; how: 'office' }
  /** They declined: accept-estimate's decline path (`status = 'declined'` and its `declined` event), from the office. */
  | { kind: 'decline_estimate'; jobId: string | null; by: string; how: 'office' }
  /**
   * Mark paid by check: the record payment window's `mark_invoice_paid(p_invoice_id, p_amount, p_paid_on, p_note,
   * p_payment_type, p_reference_number)` with the type 'check'. The window asks the amount, the day and the number.
   */
  | { kind: 'mark_invoice_paid'; invoiceId: string; paymentType: 'check' }

/** Where a strip press opens: dispatch, a send window, the record payment window, or the reply box. */
export type StripOpens = 'dispatch' | 'send_estimate' | 'send_bill' | 'record_payment' | 'reply_box'

/** A press on the strip: the card's press, with what it opens and what it writes. A card press folded in has neither. */
export interface StripPress extends CardPress {
  opens: StripOpens | null
  writes: StripWrite | null
}

/** The step card folded to one line, in parts the screen draws side by side, each in plain words. */
export interface StepStrip {
  stepId: string
  jobId: string | null
  /** The step's name: "Approved". */
  name: string
  /** Whose move: "Dana's move", "Our move", "Both sides", "Waiting on Jonah". */
  move: string
  /** How long it has been on, "2 days", or how late, "Late 3 days". Null with no day. */
  days: string | null
  late: boolean
  presses: StripPress[]
}

export interface StripOptions {
  /** The signed-in user's name: the printed name on Approve for them, and who marked the decline. */
  me: string
  people?: readonly PersonFlow[]
  options?: NudgeOptions
  /** The steps the app sends by itself. The review ask shows while the review step's send is off. */
  appSends?: AppSends
}

/** The card's presses that move a step, in the card's order. Its housekeeping (hold, see it, a note, skip, their page, open) stays on the card. */
const MOVES_THE_STEP: ReadonlySet<PressId> = new Set<PressId>(['sendIt', 'askForIt', 'remindThem', 'fileByHand', 'remind', 'askAgain', 'ask', 'remindNow', 'sendItNow'])

/** The card's own presses that move the step, each once. */
function foldedPresses(card: StepCard): StripPress[] {
  const out: StripPress[] = []
  for (const s of card.sections) {
    for (const p of [...s.lines.flatMap((l) => l.presses), ...s.presses]) {
      if (MOVES_THE_STEP.has(p.id) && !out.some((x) => x.id === p.id)) out.push({ ...p, opens: null, writes: null })
    }
  }
  return out
}

/**
 * A residential step's presses on now, keyed on the step they are on: their yes on the estimate (Approved), their
 * payment on a bill (Paid), the review ask after it, and the visit's days. Null for a step with none of its own, which
 * folds the card's presses instead.
 */
function residentialPresses(person: PersonFlow, step: StepReading, opts: StripOptions): StripPress[] | null {
  const first = person.first
  const on = { stepId: step.stepId, jobId: step.jobId }
  const moveTheDay: StripPress = { id: 'moveTheDay', label: 'Move the day', tip: STRIP_TIPS.moveTheDay, ...on, opens: 'dispatch', writes: null }
  switch (step.stepId) {
    case 'approved':
      return [
        {
          id: 'approveFor',
          label: `Approve for ${first}`,
          tip: STRIP_TIPS.approveFor(first, opts.me),
          primary: true,
          ...on,
          opens: null,
          writes: { kind: 'accept_estimate', jobId: step.jobId, printedName: opts.me, auditNote: 'by phone', how: 'office' },
        },
        moveTheDay,
        { id: 'sendAgain', label: 'Send it again', tip: STRIP_TIPS.sendAgain(first), paper: 'estimate', ...on, opens: 'send_estimate', writes: null },
        {
          id: 'declined',
          label: `${first} declined`,
          tip: STRIP_TIPS.declined(first),
          ...on,
          opens: null,
          writes: { kind: 'decline_estimate', jobId: step.jobId, by: opts.me, how: 'office' },
        },
      ]
    case 'paid': {
      // The oldest bill still out: its round's key is the bill's id (`paidRounds` in `load.ts`).
      const bill = step.rounds.find((r) => r.state === 'now')
      return [
        { id: 'sendBillAgain', label: 'Send the bill again', tip: STRIP_TIPS.sendBillAgain(first), paper: 'bill', ...on, opens: 'send_bill', writes: null },
        ...(bill
          ? [
              {
                id: 'markPaidByCheck',
                label: 'Mark paid by check',
                tip: STRIP_TIPS.markPaidByCheck,
                round: bill.key,
                ...on,
                opens: 'record_payment',
                writes: { kind: 'mark_invoice_paid', invoiceId: bill.key, paymentType: 'check' },
              } satisfies StripPress,
            ]
          : []),
      ]
    }
    case 'review':
      return opts.appSends?.residential?.review
        ? []
        : [{ id: 'askForReview', label: 'Ask for a review', tip: STRIP_TIPS.askForReview, primary: true, ...on, opens: 'reply_box', writes: null }]
    case 'onway':
    case 'arrived':
    case 'working':
      return [moveTheDay]
    default:
      return null
  }
}

/**
 * The step card folded to one line above the reply box: the step's name, whose move, the days, and the presses that
 * move it. A residential step offers its own presses (Approve for them, Move the day, Send it again, They declined;
 * Send the bill again and Mark paid by check; the review ask while the app does not send it). Every other step keeps
 * the card's own presses that move it. Null when they are off the flow, or the step is not on now.
 */
export function stepStrip(person: PersonFlow, stepId: string, jobId: string | null, now: Date, opts: StripOptions): StepStrip | null {
  if (person.reading.off) return null
  const lane = laneReadingOf(person.reading, stepId, jobId)
  const step = lane?.steps.find((x) => x.stepId === stepId)
  const def = stepById(person.flow, stepId)
  if (!step || !def || (step.state !== 'now' && step.state !== 'lapsed')) return null
  const card = stepCard(person, stepId, jobId, now, opts.people ?? [], opts.options ?? {})
  if (!card) return null
  const first = person.first
  const w = step.waitingOn
  const other = w ? (opts.people ?? []).find((p) => p.id === w.contactId) : null
  const move = w ? 'wait' : moveOnNow({ person, def, step })
  const day = dayOf(step)
  const late = !!day?.late
  const since = w ? w.since : step.since
  const onFor = since ? daysSince(since, now) : null
  const own = person.reading.kind === 'residential' ? residentialPresses(person, step, opts) : null
  return {
    stepId,
    jobId: step.jobId,
    name: def.name,
    move: move === 'wait' ? `Waiting on ${other?.first ?? 'someone else'}` : move === 'us' ? 'Our move' : move === 'them' ? `${first}'s move` : 'Both sides',
    days: late && day ? `Late ${plural(day.lateDays, 'day')}` : onFor != null ? plural(onFor, 'day') : null,
    late,
    presses: own ?? foldedPresses(card),
  }
}
