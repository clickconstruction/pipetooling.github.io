/**
 * Messages, cut 2: what a line was read as. A day heard on a call, a voicemail or a text is offered as a promise,
 * never written on its own; a text that reads like a plans question is offered to the architect. Lifted from the
 * Messages prototype v1.178 (branch spike/gc-mode, `to-dos/gc-mode/messages/prototype.html`: `promiseKinds`,
 * `promiseOffer`, `writeDown`, `notPromise`, `askArchitect`, `answerMyself` and the Follow up row's offers; the why
 * is `MESSAGES_PLAN.md` → *A day was heard*, v1.7 and v1.9). The day arrives already read, from cut 5's summaries:
 * this file parses no transcript. Pure: the writes are cut 2's RPCs on `message_promises`.
 */
import { firstName, type ContactKind } from '../contacts/kernel'
import type { PromiseKind } from '../gc/types'
import { dayLabel } from './owed'

/**
 * What a heard day can be a promise of. Three by a trade partner, three by a customer, two by an architect; and `said`,
 * the day they gave on a call the office logged (punch list #140 PR 7, `log_call`), written on the call's line with no
 * kind of its own and never offered.
 */
export type HeardPromiseKind = 'quote' | 'start' | 'papers' | 'payment' | 'decision' | 'access' | 'answer' | 'cert' | 'said'

/** A heard day: offered until someone says what it is, then written down, or *just talk*. */
export type HeardPromiseState = 'offered' | 'written' | 'no'

/** A plans question: offered, then sent to the architect or answered by us. */
export type QuestionState = 'offered' | 'asked' | 'answered'

/** The row a written promise lands on, where main keeps that kind of date. */
export type PromiseTarget =
  | 'boardAsk' // a quote: the company's ask on the Board (`gc/followUp.ts` → `askPromise`)
  | 'tradePromise' // a start or delivery, insurance or a W-9 (`gc/promises.ts`)
  | 'paymentPromise' // a customer's payment (`jobs/paymentPromises.ts`)
  | 'bidFollowUp' // a customer's answer on our bid
  | 'scheduleWait' // a day we can be on site
  | 'planQuestion' // an architect's answer
  | 'payAppCertificate' // an architect's certificate

/** One choice on the offer line: the button, its tag, and what it writes where. */
export interface PromiseChoice {
  kind: HeardPromiseKind
  /** What the day is a promise of, as the written line repeats it. */
  what: string
  /** Where it goes, as the button's hover says it. */
  where: string
  /** The button. */
  label: string
  /** The short tag for where it goes. */
  tag: string
  target: PromiseTarget
  /**
   * A choice that stands for two of main's kinds writes the first of them (the lead, 2026-10-12): a start or
   * delivery writes a start, insurance or a W-9 writes insurance. The written line and the pill name the one written.
   */
  writes?: { kind: Extract<PromiseKind, 'start' | 'insurance'>; other: Extract<PromiseKind, 'delivery' | 'w9'>; what: string }
}

/** The person a promise is heard from, in the fields this file reads. */
export interface PromisePerson {
  kind: ContactKind
  name: string
  goesBy?: string | null
  company?: string | null
  trade?: string | null
}

/**
 * The kinds of promise a heard day could be, by who they are, the likely one first (v1.7). `jobName` is the
 * message's job; a line tied to no job reads *a job*. A trade partner's company names it; with no company their first
 * name does, and a number nobody has named reads *their*.
 */
export function promiseChoices(person: PromisePerson, jobName: string | null): PromiseChoice[] {
  const jn = jobName || 'a job'
  if (person.kind === 'customer')
    return [
      { kind: 'payment', what: `a payment on ${jn}`, where: 'the Pipeline’s payment promises', label: 'A payment', tag: 'Pipeline', target: 'paymentPromise' },
      { kind: 'decision', what: `their answer on our bid for ${jn}`, where: 'the bid’s follow-up', label: 'Their answer on our bid', tag: 'Bid', target: 'bidFollowUp' },
      { kind: 'access', what: `a day we can be on site at ${jn}`, where: 'the schedule, as a wait', label: 'A day we can be on site', tag: 'Schedule', target: 'scheduleWait' },
    ]
  if (person.kind === 'arch')
    return [
      { kind: 'answer', what: `the architect’s answer on ${jn}`, where: 'the plan question', label: 'Their answer', tag: 'Plan question', target: 'planQuestion' },
      { kind: 'cert', what: `the certificate for ${jn}`, where: 'the pay application', label: 'The certificate', tag: 'Pay app', target: 'payAppCertificate' },
    ]
  const owner = ownerWord(person)
  const trade = person.trade?.trim()
  return [
    { kind: 'quote', what: `${owner} ${trade ? `${trade} ` : ''}quote for ${jn}`, where: 'their ask on the Board', label: 'Their quote', tag: 'Board', target: 'boardAsk' },
    {
      kind: 'start',
      what: `${owner} start or delivery on ${jn}`,
      where: 'the schedule',
      label: 'A start or delivery',
      tag: 'Schedule',
      target: 'tradePromise',
      writes: { kind: 'start', other: 'delivery', what: `${owner} start on ${jn}` },
    },
    {
      kind: 'papers',
      what: `${owner} insurance or W-9`,
      where: 'the company’s papers',
      label: 'Insurance or W-9',
      tag: 'Papers',
      target: 'tradePromise',
      writes: { kind: 'insurance', other: 'w9', what: `${owner} insurance` },
    },
  ]
}

/** "Hillside Excavation’s", "Dee’s", or "their" for a number nobody has named. */
function ownerWord(person: PromisePerson): string {
  const company = person.company?.trim()
  if (company) return `${company}’s`
  const first = firstName(person)
  return first ? `${first}’s` : 'their'
}

/** What a written promise says it is: the one kind written, for a choice that stands for two. */
export function writtenWhat(choice: PromiseChoice): string {
  return choice.writes?.what ?? choice.what
}

/** The offer line's words before its buttons: "Wed Oct 7 is a promise of". */
export function promiseOfferWords(day: string): string {
  return `${day} is a promise of`
}

/** The offer's last press: the day was not a promise. */
export const JUST_TALK = 'just talk'

/** The button's hover: where the choice is written. */
export function promiseGoesOn(choice: PromiseChoice): string {
  return `Goes on ${choice.where}`
}

/** The word after a written promise's day on the pill: its kind, or the one kind written. */
export function promiseWord(choice: Pick<PromiseChoice, 'kind' | 'writes'>): string {
  return choice.writes?.kind ?? choice.kind
}

/**
 * What the office reads after *Written down*: where, then exactly what and by when. Two sentences, so a long job name
 * keeps each under twenty words (the prototype's one sentence ran to 22 on *Fair Oaks Shops, Building D*).
 */
export function promiseWrittenWords(choice: PromiseChoice, day: string): string {
  const what = writtenWhat(choice)
  return `Written down on ${choice.where.split(',')[0]}. ${what.charAt(0).toUpperCase()}${what.slice(1)} by ${day}.`
}

/** The Follow up row's press on a line with a day still offered. */
export function heardDayButton(day: string): string {
  return `A day was heard: ${day} · say what it is`
}

/** A line read as a promise or a plans question, as `message_promises` keeps it, with the line's own time. */
export type HeardLine = {
  messageId: string
  contactId: string
  /** The message's time, ISO. */
  at: string
} & (
  | { kind: 'question'; state: QuestionState }
  | {
      /** Null while the day is offered and nobody has said what it is. */
      kind: HeardPromiseKind | null
      state: HeardPromiseState
      /** The day as a date, when it read as one. */
      dayYmd: string | null
      /** The day in the words heard, when it did not. */
      dayWords?: string | null
      /** For a double kind, the one written (start or delivery, insurance or w9). */
      writes?: Extract<PromiseKind, 'start' | 'delivery' | 'insurance' | 'w9'> | null
    }
)

/** A heard day's words: the date as "Wed Oct 7", or the words heard when there was no date. */
export function heardDay(line: Extract<HeardLine, { state: HeardPromiseState }>): string {
  return line.dayYmd ? dayLabel(line.dayYmd) : line.dayWords?.trim() || 'a day'
}

/** The promise a thread is waiting on, which the move line reads as "Their move · until Wed Oct 7 · quote". */
export interface RunningPromise {
  messageId: string
  dayYmd: string
  /** The pill under the name: "promised Wed Oct 7 · quote". */
  pill: string
  /** The move line's tail: "until Wed Oct 7 · quote". */
  until: string
}

/**
 * The written promise that still runs: the newest one whose day is today or later. The prototype kept it on the
 * contact for good (`c.promise`); a day that has passed no longer holds the move, so it is read, never stored.
 */
export function runningPromise(lines: ReadonlyArray<HeardLine>, contactId: string, todayYmd: string): RunningPromise | null {
  let best: RunningPromise | null = null
  let bestAt = -Infinity
  for (const line of lines) {
    if (line.contactId !== contactId || line.kind === 'question' || line.state !== 'written') continue
    if (!line.dayYmd || line.dayYmd < todayYmd || !line.kind) continue
    const at = Date.parse(line.at)
    if (best && at <= bestAt) continue
    const word = line.writes ?? (line.kind === 'said' ? 'their word' : line.kind)
    const day = dayLabel(line.dayYmd)
    best = { messageId: line.messageId, dayYmd: line.dayYmd, pill: `promised ${day} · ${word}`, until: `until ${day} · ${word}` }
    bestAt = at
  }
  return best
}

/** A press a Follow up row carries for a line still offered: a heard day, or a plans question. */
export interface RowOffer {
  messageId: string
  kind: 'day' | 'question'
  label: string
}

/** The offers on one person's Follow up row, oldest line first (v1.12). */
export function rowOffers(lines: ReadonlyArray<HeardLine>, contactId: string): RowOffer[] {
  return lines
    .filter((l) => l.contactId === contactId && l.state === 'offered')
    .slice()
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((l) =>
      l.kind === 'question'
        ? { messageId: l.messageId, kind: 'question' as const, label: ASK_THE_ARCHITECT }
        : { messageId: l.messageId, kind: 'day' as const, label: heardDayButton(heardDay(l)) },
    )
}

/** The plans question's two presses. */
export const ASK_THE_ARCHITECT = 'Ask the architect'
export const ANSWER_IT_MYSELF = 'Answer it myself'

/** The team note *Ask the architect* leaves in the thread. */
export function askArchitectNote(text: string): string {
  return `Sent to the architect as a plan question: “${text}”`
}

/** What the office reads after *Ask the architect*. */
export const ASKED_ARCHITECT_TOAST = 'Sent to the architect as a plan question.'
